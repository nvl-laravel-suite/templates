<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Nvl\Media\Contracts\MediaAuthorization;
use Nvl\Media\Enums\MediaAbility;
use Nvl\Media\Models\Media;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Contracts\ContextProvider;
use Nvl\Templates\Contracts\RenderExecutionContext;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Exceptions\DraftConflict;
use Nvl\Templates\Exceptions\RenderConflict;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Services\ConfiguredTemplateAuthorization;
use Nvl\Templates\Services\FamilyLifecycle;
use Nvl\Templates\Services\RenderRequests;
use Nvl\Templates\Services\ResourceManager;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Services\TemplateFamilies;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateOperation;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Tests\Support\Documents;
use Nvl\Templates\Tests\Support\MigratesInMemorySqlite;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;

final class DocumentServicesTest extends TestCase
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
        $app['config']->set([
            'nvl-templates.media.disk' => 'preview', 'nvl-media.disk' => 'preview', 'nvl-media.private_disk' => 'preview',
            'nvl-media.allowed_disks' => ['preview'],
            'filesystems.disks.preview' => ['driver' => 'local', 'root' => sys_get_temp_dir().'/nvl-preview-tests'],
            'nvl-media.delivery.disks.preview' => ['public' => false, 'private' => ['mode' => 'application', 'allowed' => ['application']]],
        ]);

    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->app->instance(TemplateAuthorization::class, new class implements TemplateAuthorization
        {
            public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void {}
        });
        $this->app->instance(MediaAuthorization::class, new class implements MediaAuthorization
        {
            public function allows(Authenticatable|SystemActor $actor, MediaAbility $ability, ?Media $media = null, ?Model $owner = null): bool
            {
                return true;
            }
        });
        $this->migrateInMemorySqlite();
    }

    private function document(): array
    {
        return json_decode(file_get_contents(dirname(__DIR__, 2).'/Fixtures/document-bindings.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    private function published(): array
    {
        $lifecycle = $this->app->make(TemplateLifecycle::class);
        $template = $lifecycle->create(['key' => 'native', 'name' => 'Native'], SystemActor::Background);
        $lifecycle->saveDraft($template->id, $this->document(), 0, SystemActor::Background);

        return [$template, $lifecycle->publish($template->id, 1, SystemActor::Background)];
    }

    public function test_closed_create_schema_rejects_protected_fields_without_writes(): void
    {
        try {
            $this->app->make(TemplateLifecycle::class)->create(['key' => 'bad', 'name' => 'Bad', 'scope_id' => 'other'], SystemActor::Background);
            self::fail('Protected scope accepted.');
        } catch (ValidationException) {
            self::assertSame(0, Template::query()->count());
        }
        $this->expectException(AuthorizationException::class);
        $this->app->make(TemplateOperation::class)->actor();
    }

    public function test_stale_draft_save_preserves_published_source_and_revision(): void
    {
        [$template, $revision] = $this->published();
        $document = $this->document();
        $document['content']['headline'] = 'new value';
        $lifecycle = $this->app->make(TemplateLifecycle::class);
        $lifecycle->saveDraft($template->id, $document, 1, SystemActor::Background);
        try {
            $lifecycle->saveDraft($template->id, $document, 1, SystemActor::Background);
            self::fail('Stale save succeeded.');
        } catch (DraftConflict) {
            self::assertSame(2, TemplateDraft::query()->where('template_id', $template->id)->firstOrFail()->version);
            self::assertSame($this->document(), $revision->refresh()->source);
        }
    }

    public function test_outer_rollback_cancels_complete_lifecycle_writes(): void
    {
        $connection = (new Template)->getConnection();
        $connection->beginTransaction();
        $this->published();
        self::assertSame(1, Template::query()->count());
        $connection->rollBack();
        self::assertSame(0, Template::query()->count());
    }

    public function test_replaced_family_resource_is_absent_from_effective_dependency_closure(): void
    {
        $actor = SystemActor::Background;
        $families = $this->app->make(TemplateFamilies::class);
        $group = $families->create(['key' => 'family', 'name' => 'Family'], $actor);
        $resources = $this->app->make(ResourceManager::class);
        $resource = $resources->create('copy', 'Copy', 'content', 'group', $group->id, $actor);
        $resources->publish($resource->id, ['value' => 'Inherited'], 0, $actor);
        $document = $this->document();
        $document['dataSchema']['properties']['content']['properties']['headline'] = ['type' => 'string'];
        $document['content']['headline'] = ['kind' => 'content', 'resourceId' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $families->publish($group->id, $document, 0, $actor);
        $lifecycle = $this->app->make(TemplateLifecycle::class);
        $template = $lifecycle->create(['key' => 'variant', 'name' => 'Variant', 'groupId' => $group->id], $actor);
        $source = ['format' => 'template-document', 'schemaVersion' => 1, 'target' => $document['target'], 'source' => ['mode' => 'group-variant', 'group' => ['id' => $group->id, 'revision' => 1], 'overrides' => ['content' => ['headline' => 'Local']]]];
        $lifecycle->saveDraft($template->id, $source, 0, $actor);
        $resource->update(['status' => 'revoked']);
        $revision = $lifecycle->publish($template->id, 1, $actor);
        self::assertSame([], $revision->dependencies);
        self::assertSame('Local', $revision->document['content']['headline']);
        self::assertSame($source, $revision->source);
        $candidate = $this->app->make(FamilyLifecycle::class)->prepare($template->id, 'detach', null, 1, CanonicalJson::hash($source), $actor);
        self::assertNotEmpty($candidate['id']);
    }

    public function test_render_acceptance_captures_explicit_actor_and_rejects_changed_replay(): void
    {
        [, $revision] = $this->published();
        $requests = $this->app->make(RenderRequests::class);
        $data = ['facts' => ['code' => 'one'], 'idempotency_key' => 'durable'];
        $request = $requests->accept($revision->id, $data, SystemActor::Background);
        self::assertSame('system', $request->snapshot['execution']['actor']['kind']);
        self::assertSame('disabled', $request->snapshot['execution']['ownership']['mode']);
        self::assertSame($request->id, $requests->accept($revision->id, $data, SystemActor::Background)->id);
        $this->expectException(RenderConflict::class);
        $requests->accept($revision->id, ['facts' => ['code' => 'two'], 'idempotency_key' => 'durable'], SystemActor::Background);
    }

    public function test_native_worker_context_restores_after_exception_without_ambient_auth(): void
    {
        $operation = $this->app->make(TemplateOperation::class);
        $execution = $this->app->make(RenderExecutionContext::class);
        $snapshot = $operation->run(SystemActor::Background, fn () => $execution->capture());
        try {
            $execution->run($snapshot, function () use ($operation): void {
                self::assertSame(SystemActor::Background, $operation->actor());
                throw new \RuntimeException('worker failed');
            });
            self::fail('Expected worker exception.');
        } catch (\RuntimeException $error) {
            self::assertSame('worker failed', $error->getMessage());
        }
        $this->expectException(AuthorizationException::class);
        $operation->actor();
    }

    public function test_system_actor_never_bypasses_native_policy(): void
    {
        $this->app->instance(TemplateAuthorization::class, new ConfiguredTemplateAuthorization);
        try {
            $this->app->make(TemplateLifecycle::class)->create(['key' => 'denied', 'name' => 'Denied'], SystemActor::Background);
            self::fail('Background policy bypass.');
        } catch (AuthorizationException) {
            self::assertSame(0, Template::query()->count());
        }
        $this->expectException(AuthorizationException::class);
        $this->app->make(TemplateOperation::class)->actor();
    }

    public function test_each_policy_boundary_uses_fresh_canonical_actor_facts(): void
    {
        $this->createActorTable();
        $actor = ServiceTestActor::query()->create(['allowed' => true]);
        $operation = $this->app->make(TemplateOperation::class);
        $operation->run($actor, function () use ($operation, $actor): void {
            self::assertTrue($operation->actor()->allowed);
            ServiceTestActor::query()->whereKey($actor->getKey())->update(['allowed' => false]);
            self::assertFalse($operation->actor()->allowed);
        });
        $actor->allowed = true;
        $operation->run($actor, function () use ($operation): void {
            self::assertFalse($operation->actor()->allowed);
        });
    }

    public function test_queued_context_provider_receives_the_refreshed_accepted_actor_without_ambient_auth(): void
    {
        [$template, $revision] = $this->published();
        $this->createActorTable();
        $requester = ServiceTestActor::query()->create(['allowed' => true]);
        $unrelated = ServiceTestActor::query()->create(['allowed' => true]);
        $this->app['auth']->guard()->setUser($unrelated);
        $provider = new class implements ContextProvider
        {
            public array $calls = [];

            public function resolve(TemplateRevision $release, array $owner, Authenticatable|SystemActor $actor): array
            {
                $this->calls[] = ['revision' => $release->id, 'owner' => $owner, 'actor' => $actor];
                if (! $actor instanceof ServiceTestActor || ! $actor->allowed) {
                    throw new AuthorizationException('The requester no longer owns the referenced business record.');
                }

                return ['facts' => [], 'context' => []];
            }
        };
        $this->app->instance(ContextProvider::class, $provider);
        $requests = $this->app->make(RenderRequests::class);
        $request = $requests->accept($revision->id, ['facts' => ['code' => 'one'], 'owner' => ['booking' => 'native']], $requester);
        self::assertSame([], $provider->calls);
        ServiceTestActor::query()->whereKey($requester->id)->update(['allowed' => false]);
        $requester->allowed = true;
        $result = $requests->process($request->id, null, null, SystemActor::Background);
        self::assertSame('failed', $result->status);
        self::assertSame('not_authorized', $result->error);
        self::assertCount(1, $provider->calls);
        $call = $provider->calls[0];
        self::assertSame($revision->id, $call['revision']);
        self::assertSame(['booking' => 'native'], $call['owner']);
        self::assertInstanceOf(ServiceTestActor::class, $call['actor']);
        self::assertSame($requester->id, $call['actor']->id);
        self::assertFalse($call['actor']->allowed);
        self::assertSame($unrelated, $this->app['auth']->user());
    }

    public function test_queued_actor_disappearance_fails_closed_and_restores_state(): void
    {
        $this->createActorTable();
        $actor = ServiceTestActor::query()->create(['allowed' => true]);
        $operation = $this->app->make(TemplateOperation::class);
        $execution = $this->app->make(RenderExecutionContext::class);
        $snapshot = $operation->run($actor, fn () => $execution->capture());
        $actor->delete();
        try {
            $execution->run($snapshot, static fn () => self::fail('Deleted worker actor admitted.'));
            self::fail('Deleted worker actor accepted.');
        } catch (AuthorizationException) {
            $this->expectException(AuthorizationException::class);
            $operation->actor();
        }
    }

    public function test_reader_and_prepare_enforce_the_serialized_preview_budget(): void
    {
        [$template, $revision] = $this->published();
        config()->set('nvl-templates.limits.preview_bytes', 64);
        foreach ([
            fn () => $this->app->make(TemplateReader::class)->load($template->id, SystemActor::Background),
            fn () => $this->app->make(TemplateRenderer::class)->prepare($revision->id, ['facts' => ['code' => 'one']], SystemActor::Background),
        ] as $preview) {
            try {
                $preview();
                self::fail('Oversized native preview accepted.');
            } catch (ValidationException $error) {
                self::assertArrayHasKey('preview', $error->errors());
            }
        }
    }

    public function test_browser_preview_converts_cids_and_bounds_the_exact_native_payload(): void
    {
        Storage::fake('preview');
        $asset = $this->app->make(TemplateAssets::class)->upload(UploadedFile::fake()->image('preview.png', 2, 2), SystemActor::Background);
        $document = Documents::standalone('Здравей, София');
        $document['dataSchema']['properties']['facts']['properties']['logo'] = ['type' => 'string'];
        $document['artifacts']['html'] .= '<img src="{{logo}}" alt="Logo">';
        $document['artifacts']['bindings'][] = ['id' => 'logo', 'path' => 'facts.logo', 'kind' => 'image'];
        $template = $this->app->make(TemplateLifecycle::class)->create(['key' => 'browser', 'name' => 'Browser'], SystemActor::Background);
        $renderer = $this->app->make(TemplateRenderer::class);
        $data = ['facts' => ['code' => 'one', 'logo' => $asset->id]];
        $result = $renderer->previewForBrowser($template->id, $document, $data, true, SystemActor::Background);
        self::assertStringContainsString('src="cid:', $result['html']);
        self::assertStringContainsString('src="data:image/png;base64,', $result['previewHtml']);
        self::assertCount(1, $result['inlineAssets']);
        $without = $renderer->previewForBrowser($template->id, $document, $data, false, SystemActor::Background);
        self::assertSame([], $without['inlineAssets']);
        self::assertSame($result['previewHtml'], $without['previewHtml']);
        $bytes = strlen(json_encode($without, JSON_THROW_ON_ERROR));
        config()->set('nvl-templates.limits.preview_bytes', $bytes);
        self::assertSame($without, $renderer->previewForBrowser($template->id, $document, $data, false, SystemActor::Background));
        config()->set('nvl-templates.limits.preview_bytes', $bytes - 1);
        $this->expectException(ValidationException::class);
        $renderer->previewForBrowser($template->id, $document, $data, false, SystemActor::Background);
    }

    private function createActorTable(): void
    {
        (new Template)->getConnection()->getSchemaBuilder()->create('service_test_actors', function (Blueprint $table): void {
            $table->id();
            $table->boolean('allowed');
        });
    }
}

/** Canonical persisted actor fixture, independent of an ambient guard. */
final class ServiceTestActor extends Model implements Authenticatable
{
    use \Illuminate\Auth\Authenticatable;

    protected $table = 'service_test_actors';

    protected $guarded = [];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['allowed' => 'boolean'];
    }
}
