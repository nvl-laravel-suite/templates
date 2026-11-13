<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Services;

use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Models\FamilyChange;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateGroupRevision;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Services\FamilyLifecycle;
use Nvl\Templates\Services\TemplateFamilies;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Tests\Support\Documents;
use Nvl\Templates\Tests\Support\MigratesInMemorySqlite;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class FamilyRevisionAuthorizationTest extends TestCase
{
    use MigratesInMemorySqlite;

    protected function getPackageProviders($app): array
    {
        return [LocaleServiceProvider::class, TranslatableServiceProvider::class, TemplatesServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite.database', ':memory:');
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->denyRevision(null);
        $this->migrateInMemorySqlite();
    }

    #[DataProvider('editorSources')]
    public function test_inherited_editor_reads_require_the_exact_family_revision(bool $saveDraft): void
    {
        [$template, , $base, $target] = $this->variant($saveDraft);
        $reader = app(TemplateReader::class);
        $denied = $saveDraft ? $base : $target;
        self::assertSame($denied->id, $reader->load($template->id, SystemActor::Background)['family']['revisionId']);
        $this->denyRevision($denied->id);

        $this->assertRevisionDenied(fn () => $reader->load($template->id, SystemActor::Background));
    }

    /** @return iterable<string,array{bool}> */
    public static function editorSources(): iterable
    {
        yield 'inherited before first draft' => [false];
        yield 'saved exact family pin' => [true];
    }

    public function test_a_denied_source_revision_cannot_prepare_a_detached_copy(): void
    {
        [$template, $source, $base] = $this->variant();
        $this->denyRevision($base->id);

        $this->assertRevisionDenied(fn () => app(FamilyLifecycle::class)->prepare($template->id, 'detach', null, 1, CanonicalJson::hash($source), SystemActor::Background));

        self::assertSame(0, FamilyChange::query()->count());
        $this->assertDraftUnchanged($template, $source);
    }

    #[DataProvider('targetOperations')]
    public function test_target_preparation_requires_read_of_the_exact_revision(string $operation): void
    {
        [$template, $source, , $target] = $this->variant();
        if ($operation === 'regroup') {
            $families = app(TemplateFamilies::class);
            $group = $families->create(['key' => 'other-family', 'name' => 'Other family'], SystemActor::Background);
            $target = $families->publish($group->id, Documents::standalone('Family copy'), 0, SystemActor::Background);
        }
        $this->denyRevision($target->id);

        $this->assertRevisionDenied(fn () => app(FamilyLifecycle::class)->prepare($template->id, $operation, ['groupId' => $target->group_id, 'revision' => $target->revision], 1, CanonicalJson::hash($source), SystemActor::Background));

        self::assertSame(0, FamilyChange::query()->count());
        $this->assertDraftUnchanged($template, $source);
    }

    /** @return iterable<string,array{string}> */
    public static function targetOperations(): iterable
    {
        yield 'newer same-family revision' => ['upgrade'];
        yield 'different family revision' => ['regroup'];
    }

    #[DataProvider('storedCandidateReads')]
    public function test_stored_candidates_recheck_newly_denied_source_and_target_revisions(string $operation, string $deniedRole): void
    {
        [$template, $source, $base, $target] = $this->variant();
        $families = app(FamilyLifecycle::class);
        $checksum = CanonicalJson::hash($source);
        $candidate = $families->prepare($template->id, 'upgrade', ['groupId' => $target->group_id, 'revision' => $target->revision], 1, $checksum, SystemActor::Background);
        $id = $candidate['id'];
        self::assertIsString($id);
        self::assertCount(1, $families->listing($template->id, SystemActor::Background));
        $this->denyRevision(($deniedRole === 'source' ? $base : $target)->id);

        if ($operation === 'listing') {
            self::assertSame([], $families->listing($template->id, SystemActor::Background));
        } else {
            $this->assertRevisionDenied(fn () => match ($operation) {
                'get' => $families->get($template->id, $id, SystemActor::Background),
                'review' => $families->review($template->id, $id, [], 1, $checksum, SystemActor::Background),
                'apply' => $families->apply($template->id, $id, [], 1, $checksum, SystemActor::Background),
                default => self::fail('Unknown candidate operation.'),
            });
        }

        $this->assertDraftUnchanged($template, $source);
        $stored = FamilyChange::query()->findOrFail($id);
        self::assertSame('pending', $stored->status);
        self::assertNull($stored->applied_version);
        self::assertSame(1, FamilyChange::query()->count());
    }

    /** @return iterable<string,array{string,string}> */
    public static function storedCandidateReads(): iterable
    {
        foreach (['get', 'listing', 'review', 'apply'] as $operation) {
            foreach (['source', 'target'] as $role) {
                yield $operation.' denies '.$role => [$operation, $role];
            }
        }
    }

    public function test_authorized_upgrade_remains_reviewable_and_applies_to_the_draft(): void
    {
        [$template, $source, , $target] = $this->variant();
        $families = app(FamilyLifecycle::class);
        $checksum = CanonicalJson::hash($source);
        $candidate = $families->prepare($template->id, 'upgrade', ['groupId' => $target->group_id, 'revision' => $target->revision], 1, $checksum, SystemActor::Background);
        $id = $candidate['id'];
        self::assertIsString($id);
        self::assertSame([], $families->review($template->id, $id, [], 1, $checksum, SystemActor::Background)['conflicts']);

        $applied = $families->apply($template->id, $id, [], 1, $checksum, SystemActor::Background);

        self::assertSame(2, $applied['version']);
        self::assertSame('applied', $applied['candidate']['status']);
        self::assertSame(['id' => $target->group_id, 'revision' => 2], $applied['source']['source']['group']);
        self::assertNull($template->fresh()?->current_revision_id, 'Applying a reviewed family change does not publish it.');
    }

    /** @return array{Template,array<array-key,mixed>,TemplateGroupRevision,TemplateGroupRevision} */
    private function variant(bool $saveDraft = true): array
    {
        $families = app(TemplateFamilies::class);
        $group = $families->create(['key' => 'family', 'name' => 'Family'], SystemActor::Background);
        $base = $families->publish($group->id, Documents::standalone('Family copy'), 0, SystemActor::Background);
        $target = $families->publish($group->id, Documents::standalone('Family copy'), 1, SystemActor::Background);
        $templates = app(TemplateLifecycle::class);
        $template = $templates->create(['key' => 'variant', 'name' => 'Variant', 'groupId' => $group->id], SystemActor::Background);
        $source = Documents::variant($group->id, 1, 'Family copy');
        if ($saveDraft) {
            $templates->saveDraft($template->id, $source, 0, SystemActor::Background);
        }

        return [$template, $source, $base, $target];
    }

    private function denyRevision(?string $id): void
    {
        $this->app->instance(TemplateAuthorization::class, new class($id) implements TemplateAuthorization
        {
            public function __construct(private readonly ?string $id) {}

            public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void
            {
                $record = $context['resource'] ?? null;
                if ($ability === TemplateAbility::Read && $record instanceof TemplateGroupRevision && $record->id === $this->id) {
                    throw new AuthorizationException('Exact family revision read denied.');
                }
            }
        });
    }

    private function assertRevisionDenied(Closure $operation): void
    {
        try {
            $operation();
        } catch (AuthorizationException $error) {
            self::assertSame('Exact family revision read denied.', $error->getMessage());

            return;
        }

        self::fail('The operation exposed or copied a family revision denied by the current policy.');
    }

    /** @param array<array-key,mixed> $source */
    private function assertDraftUnchanged(Template $template, array $source): void
    {
        $draft = TemplateDraft::query()->where('template_id', $template->id)->sole();
        self::assertSame(1, $draft->version);
        self::assertSame($source, $draft->document);
        self::assertNull($draft->proposed_basis);
        self::assertSame($template->group_id, $template->fresh()?->group_id);
    }
}
