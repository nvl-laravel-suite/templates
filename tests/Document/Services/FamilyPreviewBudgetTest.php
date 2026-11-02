<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Services;

use Illuminate\Foundation\Application;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Models\FamilyChange;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Services\FamilyLifecycle;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Services\TemplateFamilies;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Tests\CanonicalTestCase;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class FamilyPreviewBudgetTest extends CanonicalTestCase
{
    /** @param Application $app */
    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $disk = $this->disk();
        $app->make('config')->set([
            'nvl-templates.media.disk' => $disk,
            'nvl-media.disk' => $disk, 'nvl-media.private_disk' => $disk,
            'nvl-media.allowed_disks' => [$disk],
            'filesystems.disks.'.$disk => ['driver' => 'local', 'root' => sys_get_temp_dir().'/'.$disk],
            'nvl-media.delivery.disks.'.$disk => ['public' => false, 'private' => ['mode' => 'application', 'allowed' => ['application']]],
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake($this->disk());
        self::assertSame(0, Artisan::call('migrate', ['--force' => true]));
    }

    #[DataProvider('candidateOperations')]
    public function test_each_candidate_operation_bounds_real_media_without_changing_draft_authority(string $operation): void
    {
        [$template, $source, $candidate] = $this->variant(true);
        $base = $candidate;
        $base['previewAssets'] = (object) [];
        $limit = strlen(json_encode($base, JSON_THROW_ON_ERROR));
        self::assertGreaterThan($limit, strlen(json_encode($candidate, JSON_THROW_ON_ERROR)));
        config()->set('nvl-templates.limits.preview_bytes', $limit);
        $life = app(FamilyLifecycle::class);
        $id = $this->candidateId($candidate);
        $checksum = CanonicalJson::hash($source);

        try {
            match ($operation) {
                'get' => $life->get($template->id, $id, $this->actor()),
                'prepare' => $life->prepare($template->id, 'detach', null, 1, $checksum, $this->actor()),
                'review' => $life->review($template->id, $id, [], 1, $checksum, $this->actor()),
                'apply' => $life->apply($template->id, $id, [], 1, $checksum, $this->actor()),
                default => self::fail('Unknown family operation fixture.'),
            };
            self::fail('A candidate with retained inline media must fit the serialized preview budget.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('preview', $error->errors());
        }

        $draft = TemplateDraft::query()->where('template_id', $template->id)->sole();
        self::assertSame(1, $draft->version);
        self::assertSame($source, $draft->document);
        self::assertNull($draft->proposed_basis);
        self::assertSame($template->group_id, $template->fresh()?->group_id);
        self::assertSame('pending', FamilyChange::query()->findOrFail($id)->status);
        self::assertNull(FamilyChange::query()->findOrFail($id)->applied_version);
        self::assertSame(1, FamilyChange::query()->count(), 'Rejected preparation must not leave an unreadable pending candidate.');
    }

    /** @return iterable<string,array{string}> */
    public static function candidateOperations(): iterable
    {
        foreach (['get', 'prepare', 'review', 'apply'] as $operation) {
            yield $operation => [$operation];
        }
    }

    public function test_listing_bounds_the_aggregate_and_stops_before_loading_later_candidates(): void
    {
        [$template, $source, $first] = $this->variant(false);
        $life = app(FamilyLifecycle::class);
        $second = $life->prepare($template->id, 'detach', null, 1, CanonicalJson::hash($source), $this->actor());
        $third = $life->prepare($template->id, 'detach', null, 1, CanonicalJson::hash($source), $this->actor());
        $limit = max(array_map(static fn (array $candidate): int => strlen(json_encode([$candidate], JSON_THROW_ON_ERROR)), [$first, $second, $third]));
        self::assertGreaterThan($limit, strlen(json_encode([$first, $second], JSON_THROW_ON_ERROR)));
        config()->set('nvl-templates.limits.preview_bytes', $limit);
        $loaded = 0;
        Event::listen('eloquent.retrieved: '.FamilyChange::class, function () use (&$loaded): void {
            $loaded++;
        });

        try {
            $life->listing($template->id, $this->actor());
            self::fail('Individually bounded candidates must not form an unbounded list.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('preview', $error->errors());
        }
        self::assertSame(2, $loaded, 'The over-budget aggregate must stop iteration before the third source snapshot is loaded.');
        self::assertSame(1, TemplateDraft::query()->where('template_id', $template->id)->sole()->version);
    }

    public function test_apply_bounds_the_complete_response_inside_its_existing_transaction(): void
    {
        [$template, $source, $candidate] = $this->variant(false);
        $life = app(FamilyLifecycle::class);
        $id = $this->candidateId($candidate);
        $checksum = CanonicalJson::hash($source);
        DB::beginTransaction();
        try {
            $successful = $life->apply($template->id, $id, [], 1, $checksum, $this->actor());
            $limit = strlen(json_encode($successful['candidate'], JSON_THROW_ON_ERROR));
            self::assertGreaterThan($limit, strlen(json_encode($successful, JSON_THROW_ON_ERROR)));
        } finally {
            DB::rollBack();
        }
        config()->set('nvl-templates.limits.preview_bytes', $limit);

        try {
            $life->apply($template->id, $id, [], 1, $checksum, $this->actor());
            self::fail('The outer applied source and candidate must fit as one serialized response.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('preview', $error->errors());
        }
        $draft = TemplateDraft::query()->where('template_id', $template->id)->sole();
        self::assertSame(1, $draft->version);
        self::assertSame($source, $draft->document);
        self::assertNull($draft->proposed_basis);
        self::assertSame('pending', FamilyChange::query()->findOrFail($id)->status);
        self::assertNull(FamilyChange::query()->findOrFail($id)->applied_version);
    }

    /** @return array{Template,array<array-key,mixed>,array<string,mixed>} */
    private function variant(bool $withMedia): array
    {
        $document = Documents::standalone();
        if ($withMedia) {
            $bytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
            self::assertIsString($bytes);
            $asset = app(TemplateAssets::class)->upload(UploadedFile::fake()->createWithContent('logo.png', $bytes), $this->actor());
            $document['managedAssets'] = ['logo' => $asset->id];
        }
        $families = app(TemplateFamilies::class);
        $family = $families->create(['key' => 'family', 'name' => 'Family'], $this->actor());
        $families->publish($family->id, $document, 0, $this->actor());
        $templates = app(TemplateLifecycle::class);
        $template = $templates->create(['key' => 'variant', 'name' => 'Variant', 'groupId' => $family->id], $this->actor());
        $source = Documents::variant($family->id, 1, 'Local');
        $templates->saveDraft($template->id, $source, 0, $this->actor());
        $candidate = app(FamilyLifecycle::class)->prepare($template->id, 'detach', null, 1, CanonicalJson::hash($source), $this->actor());

        return [$template, $source, $candidate];
    }

    public function test_rejected_regroup_does_not_poison_listing_or_the_small_standalone_editor(): void
    {
        $families = app(TemplateFamilies::class);
        $family = $families->create(['key' => 'large-family', 'name' => 'Large family'], $this->actor());
        $families->publish($family->id, Documents::standalone(str_repeat('Large target ', 4000)), 0, $this->actor());
        $templates = app(TemplateLifecycle::class);
        $template = $templates->create(['key' => 'small', 'name' => 'Small'], $this->actor());
        $source = Documents::standalone('Small current source');
        $templates->saveDraft($template->id, $source, 0, $this->actor());
        $reader = app(TemplateReader::class);
        $before = $reader->load($template->id, $this->actor());
        config()->set('nvl-templates.limits.preview_bytes', strlen(json_encode($before, JSON_THROW_ON_ERROR)) + 1000);
        $before = $reader->load($template->id, $this->actor());
        $life = app(FamilyLifecycle::class);

        try {
            $life->prepare($template->id, 'regroup', ['groupId' => $family->id, 'revision' => 1], 1, CanonicalJson::hash($source), $this->actor());
            self::fail('The oversized target must be rejected without retaining its pending candidate.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('preview', $error->errors());
        }

        self::assertSame(0, FamilyChange::query()->count());
        self::assertSame([], $life->listing($template->id, $this->actor()));
        self::assertEquals($before, $reader->load($template->id, $this->actor()));
        $draft = TemplateDraft::query()->where('template_id', $template->id)->sole();
        self::assertSame(1, $draft->version);
        self::assertSame($source, $draft->document);
        self::assertNull($draft->proposed_basis);
        self::assertNull($template->fresh()?->group_id);
    }

    public function test_automatic_upgrade_uses_a_savepoint_when_its_preview_is_rejected(): void
    {
        $families = app(TemplateFamilies::class);
        $family = $families->create(['key' => 'growing-family', 'name' => 'Growing family'], $this->actor());
        $families->publish($family->id, Documents::standalone('Small family'), 0, $this->actor());
        $templates = app(TemplateLifecycle::class);
        $template = $templates->create(['key' => 'small-variant', 'name' => 'Small variant', 'groupId' => $family->id], $this->actor());
        $source = Documents::variant($family->id, 1, 'Small local headline');
        $templates->saveDraft($template->id, $source, 0, $this->actor());
        $reader = app(TemplateReader::class);
        $before = $reader->load($template->id, $this->actor());
        config()->set('nvl-templates.limits.preview_bytes', strlen(json_encode($before, JSON_THROW_ON_ERROR)) + 1000);
        $before = $reader->load($template->id, $this->actor());

        $revision = $families->publish($family->id, Documents::standalone(str_repeat('Large upgrade ', 4000)), 1, $this->actor());

        self::assertSame(2, $revision->revision, 'The outer publication must commit despite its rejected automatic preview.');
        $publishedFamily = TemplateGroup::query()->findOrFail($family->id);
        self::assertSame(2, $publishedFamily->version);
        self::assertSame($revision->id, $publishedFamily->current_revision_id);
        self::assertSame(0, FamilyChange::query()->count(), 'The nested candidate write must roll back to its own savepoint.');
        self::assertSame([], app(FamilyLifecycle::class)->listing($template->id, $this->actor()));
        self::assertEquals($before, $reader->load($template->id, $this->actor()));
        $draft = TemplateDraft::query()->where('template_id', $template->id)->sole();
        self::assertSame(1, $draft->version);
        self::assertSame($source, $draft->document);
        self::assertNull($draft->proposed_basis);
    }

    /** @param array<string,mixed> $candidate */
    private function candidateId(array $candidate): string
    {
        self::assertIsString($candidate['id']);

        return $candidate['id'];
    }

    private function disk(): string
    {
        return 'family-preview-budget-'.getmypid();
    }
}
