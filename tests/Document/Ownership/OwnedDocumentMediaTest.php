<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Ownership;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Nvl\Media\MediaRegistration;
use Nvl\Media\Services\MediaAttachments;
use Nvl\Media\Services\MediaModelRegistry;
use Nvl\Ownership\Providers\OwnershipServiceProvider;
use Nvl\Ownership\Services\OwnershipAdoptionCoordinator;
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Ownership\ValueObjects\OwnershipOperation;
use Nvl\Support\Ownership\Contracts\OwnershipContext;
use Nvl\Support\Ownership\Exceptions\OwnershipConfigurationInvalid;
use Nvl\Support\Ownership\Exceptions\OwnershipViolation;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Services\FamilyLifecycle;
use Nvl\Templates\Services\RenderRequests;
use Nvl\Templates\Services\ResourceManager;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Services\TemplateFamilies;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;

final class OwnedDocumentMediaTest extends TestCase
{
    private array $originalMorphMap = [];

    protected function getPackageProviders($app): array
    {
        return [HostProvider::class, LocaleServiceProvider::class, TranslatableServiceProvider::class,
            OwnershipServiceProvider::class, TemplatesServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set([
            'database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array', 'nvl-ownership.enabled' => true, 'nvl-ownership.migrations.enabled' => true,
            'nvl-core.owners' => [TestCompany::class, TestActor::class],
            'nvl-templates.models.template' => OwnedTemplate::class, 'nvl-media.models.media' => OwnedMedia::class,
            'auth.providers.users.model' => TestActor::class,
            'nvl-templates.media.disk' => 'retained', 'nvl-media.disk' => 'retained', 'nvl-media.private_disk' => 'retained',
            'nvl-media.allowed_disks' => ['retained'], 'nvl-media.locks.deduplication.store' => 'array',
            'filesystems.disks.retained' => ['driver' => 'local', 'root' => sys_get_temp_dir().'/nvl-owned-template-tests'],
            'nvl-media.delivery.disks.retained' => ['public' => false, 'private' => ['mode' => 'application', 'allowed' => ['application']]],
        ]);
    }

    protected function setUp(): void
    {
        $this->originalMorphMap = Relation::morphMap();
        parent::setUp();
        $schema = DB::getSchemaBuilder();
        $schema->create('template_test_companies', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary();
        });
        $schema->create('template_test_actors', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary();
            $table->unsignedBigInteger('company_id');
            $table->foreign('company_id')->references('id')->on('template_test_companies');
        });
        TestCompany::query()->insert([['id' => 7], ['id' => 8]]);
        TestActor::query()->insert([['id' => 1, 'company_id' => 7], ['id' => 2, 'company_id' => 8]]);
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        foreach ([TemplateModelRegistry::newInstance()->getTable(), MediaModelRegistry::newInstance()->getTable()] as $table) {
            $schema->table($table, function (Blueprint $table): void {
                $table->unsignedBigInteger('company_id')->nullable();
                $table->foreign('company_id')->references('id')->on('template_test_companies');
            });
        }
        Storage::fake('retained');
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        Relation::morphMap($this->originalMorphMap, false);
    }

    private function activate(): void
    {
        $operation = new OwnershipOperation('install-templates', 'operator', '1');
        $coordinator = $this->app->make(OwnershipAdoptionCoordinator::class);
        $plan = $coordinator->prepare(['templates', 'media'], [], $operation);
        self::assertTrue($coordinator->backfill($plan, 100, $operation));
        self::assertTrue($coordinator->verify($plan)->passed());
        $coordinator->activate($plan, $operation);
    }

    private function within(int $company, \Closure $callback): mixed
    {
        $actor = TestActor::query()->where('company_id', $company)->firstOrFail();

        return $this->app->make(OwnershipRunner::class)->run(TestCompany::query()->findOrFail($company), $actor, fn () => $callback($actor));
    }

    private function document(): array
    {
        return json_decode(file_get_contents(dirname(__DIR__, 2).'/Fixtures/document-bindings.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    private function published(TestActor $actor): array
    {
        $lifecycle = $this->app->make(TemplateLifecycle::class);
        $template = $lifecycle->create(['key' => 'native', 'name' => 'Native'], $actor);
        $lifecycle->saveDraft($template->id, $this->document(), 0, $actor);

        return [$template, $lifecycle->publish($template->id, 1, $actor)];
    }

    public function test_fresh_owned_installation_supports_native_document_and_retained_media_workflows(): void
    {
        $this->activate();
        $this->within(7, function (TestActor $actor): void {
            self::assertNull(Auth::user());
            [$template, $revision] = $this->published($actor);
            self::assertInstanceOf(OwnedTemplate::class, $template);
            self::assertSame('7', (string) $template->company_id);
            $result = $this->app->make(TemplateRenderer::class)->render($revision->id, ['facts' => ['code' => 'OWNER-A'], 'inputs' => ['message' => 'Owned message']], $actor);
            self::assertStringContainsString('OWNER-A', $result['html']);
            self::assertStringContainsString('Owned message', $result['html']);
            $requests = $this->app->make(RenderRequests::class);
            $request = $requests->accept($revision->id, ['facts' => ['code' => 'RETAINED-A'], 'inputs' => ['message' => 'Durable owned result']], $actor);
            self::assertSame('actor', $request->snapshot['execution']['actor']['kind']);
            self::assertSame((string) $actor->id, $request->snapshot['execution']['actor']['id']);
            $completed = $requests->process($request->id, null, null, $actor);
            self::assertSame('completed', $completed->status, $completed->error ?? '');
            self::assertArrayHasKey('mediaId', $completed->result);
            self::assertArrayNotHasKey('path', $completed->result);
            self::assertStringContainsString('RETAINED-A', $requests->result($request->id, $actor)['html']);
            $asset = $this->app->make(TemplateAssets::class)->upload(UploadedFile::fake()->image('logo.png', 2, 2), $actor);
            [$retained, $bytes] = $this->app->make(TemplateAssets::class)->contents($asset->id, $actor);
            self::assertSame($asset->checksum, hash('sha256', $bytes));
            $media = MediaModelRegistry::query()->findOrFail($retained->media_id);
            self::assertInstanceOf(OwnedMedia::class, $media);
            self::assertSame('7', (string) $media->company_id);
            self::assertSame($template->owner_scope_key, $asset->owner_scope_key);
            self::assertSame($asset->owner_scope_key, $media->owner_scope_key);
            self::assertSame($template->getConnection(), $media->getConnection());
            self::assertSame($template->getConnection(), $asset->getConnection());
            $completed->update(['expires_at' => now()->subSecond()]);
            self::assertSame(1, $requests->prune(10, $actor));
            self::assertSame(1, MediaModelRegistry::query()->count());
            self::assertSame($asset->media_id, MediaModelRegistry::query()->sole()->id);
        });
        self::assertNull($this->app->make(OwnershipContext::class)->snapshot()->principal);
    }

    public function test_owned_family_resources_and_variant_review_use_the_native_graph(): void
    {
        $this->activate();
        $this->within(7, function (TestActor $actor): void {
            $families = $this->app->make(TemplateFamilies::class);
            $group = $families->create(['key' => 'family', 'name' => 'Family'], $actor);
            $resources = $this->app->make(ResourceManager::class);
            $resource = $resources->create('copy', 'Copy', 'content', 'group', $group->id, $actor);
            $resources->publish($resource->id, ['value' => 'Inherited'], 0, $actor);
            $document = $this->document();
            $document['dataSchema']['properties']['content']['properties']['headline'] = ['type' => 'string'];
            $document['content']['headline'] = ['kind' => 'content', 'resourceId' => $resource->id, 'revision' => 1, 'path' => 'value'];
            $family = $families->publish($group->id, $document, 0, $actor);
            $lifecycle = $this->app->make(TemplateLifecycle::class);
            $template = $lifecycle->create(['key' => 'variant', 'name' => 'Variant', 'groupId' => $group->id], $actor);
            $source = ['format' => 'template-document', 'schemaVersion' => 1, 'target' => $document['target'], 'source' => ['mode' => 'group-variant', 'group' => ['id' => $group->id, 'revision' => 1], 'overrides' => []]];
            $lifecycle->saveDraft($template->id, $source, 0, $actor);
            $release = $lifecycle->publish($template->id, 1, $actor);
            self::assertSame($family->id, $release->group_revision_id);
            self::assertSame('Inherited', $release->document['content']['headline']);
            self::assertSame($group->owner_scope_key, $resource->owner_scope_key);
            self::assertSame($resource->id, $resources->catalog($template->id, 'content', $actor)->sole()->id);
            $candidate = $this->app->make(FamilyLifecycle::class)->prepare($template->id, 'detach', null, 1, CanonicalJson::hash($source), $actor);
            self::assertNotEmpty($candidate['id']);
        });
    }

    public function test_owner_b_cannot_read_or_reuse_owner_a_template_revision_or_asset_ids(): void
    {
        $this->activate();
        [$template, $revision, $asset, $resource, $media, $group] = $this->within(7, function (TestActor $actor): array {
            [$template, $revision] = $this->published($actor);
            $asset = $this->app->make(TemplateAssets::class)->upload(UploadedFile::fake()->image('logo.png', 2, 2), $actor);
            $resource = $this->app->make(ResourceManager::class)->create('private', 'Private', 'content', 'tenant', null, $actor);
            $group = $this->app->make(TemplateFamilies::class)->create(['key' => 'private-family', 'name' => 'Private family'], $actor);

            return [$template, $revision, $asset, $resource, MediaModelRegistry::query()->findOrFail($asset->media_id), $group];
        });
        $this->within(8, function (TestActor $actor) use ($template, $revision, $asset, $resource, $media, $group): void {
            self::assertSame(0, TemplateModelRegistry::query()->count());
            self::assertSame(0, TemplateAsset::query()->count());
            self::assertSame(0, TemplateResource::query()->count());
            self::assertSame(0, MediaModelRegistry::query()->count());
            $ownTemplate = $this->app->make(TemplateLifecycle::class)->create(['key' => 'native', 'name' => 'Owner B native'], $actor);
            self::assertNotSame($template->id, $ownTemplate->id);
            self::assertSame('8', (string) $ownTemplate->company_id);
            $local = $this->app->make(TemplateAssets::class)->upload(UploadedFile::fake()->image('own.png', 2, 2), $actor);
            $operations = [
                fn () => $this->app->make(TemplateReader::class)->get($template->id, $actor),
                fn () => $this->app->make(TemplateLifecycle::class)->create(['key' => 'reuse-family', 'name' => 'Foreign family', 'groupId' => $group->id], $actor),
                fn () => $this->app->make(TemplateRenderer::class)->render($revision->id, [], $actor),
                fn () => $this->app->make(TemplateAssets::class)->contents($asset->id, $actor),
                fn () => $this->app->make(ResourceManager::class)->publish($resource->id, ['value' => 'foreign'], 0, $actor),
                fn () => $this->app->make(MediaAttachments::class)->attach($actor, $media, $local, collection: 'retained_asset', slot: MediaRegistration::forOwner($local)->getSlot('retained_asset')),
            ];
            foreach ($operations as $operation) {
                try {
                    $operation();
                    self::fail('A foreign owner identifier was admitted.');
                } catch (ModelNotFoundException|OwnershipViolation|AuthorizationException) {
                    self::assertTrue(true);
                }
            }
        });
    }

    public function test_no_context_cannot_create_owned_templates(): void
    {
        $this->activate();
        $this->expectException(OwnershipViolation::class);
        $this->app->make(TemplateLifecycle::class)->create(['key' => 'unscoped', 'name' => 'Unscoped'], TestActor::query()->findOrFail(1));
    }

    public function test_explicit_actor_must_match_the_admitted_principal(): void
    {
        $this->activate();
        $this->within(7, function (): void {
            $this->expectException(AuthorizationException::class);
            $this->app->make(TemplateLifecycle::class)->create(['key' => 'mismatch', 'name' => 'Mismatch'], TestActor::query()->findOrFail(2));
        });
    }

    public function test_fresh_adapter_refuses_populated_graph_without_converting_rows(): void
    {
        $table = TemplateModelRegistry::newInstance()->getTable();
        DB::table($table)->insert(['id' => '00000000-0000-4000-8000-000000000001', 'scope_id' => 'legacy', 'key' => 'legacy', 'name' => 'Legacy', 'company_id' => 7]);
        try {
            $this->activate();
            self::fail('Populated graph was silently adopted.');
        } catch (OwnershipConfigurationInvalid $error) {
            self::assertStringContainsString('empty resources', $error->getMessage());
            self::assertSame('legacy', DB::table($table)->value('scope_id'));
            self::assertSame(1, DB::table($table)->count());
        }
    }
}
