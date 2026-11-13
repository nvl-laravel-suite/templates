<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Media;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Auth\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Nvl\Media\Contracts\MediaAuthorization;
use Nvl\Media\Enums\MediaAbility;
use Nvl\Media\Models\Media;
use Nvl\Media\Models\MediaAssociation;
use Nvl\Media\Providers\MediaServiceProvider;
use Nvl\Media\Services\MediaAssetService;
use Nvl\Media\Services\MediaModelRegistry;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Rendering\RenderedDocument;
use Nvl\Templates\Services\AssetManager;
use Nvl\Templates\Services\RenderArtifacts;
use Nvl\Templates\Services\RetainedMedia;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Services\TemplateOperation;
use Nvl\Templates\Tests\Support\MigratesInMemorySqlite;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;

final class RetainedMediaTest extends TestCase
{
    use MigratesInMemorySqlite;

    private MutableMediaPolicy $policy;

    protected function getPackageProviders($app): array
    {
        return [LocaleServiceProvider::class, TranslatableServiceProvider::class, MediaServiceProvider::class, TemplatesServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set([
            'database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array',
            'nvl-templates.media.disk' => 'retained',
            'nvl-media.disk' => 'retained', 'nvl-media.private_disk' => 'retained',
            'nvl-media.allowed_disks' => ['retained'],
            'filesystems.disks.retained' => ['driver' => 'local', 'root' => sys_get_temp_dir().'/nvl-retained-tests'],
            'nvl-media.delivery.disks.retained' => ['public' => false, 'private' => ['mode' => 'application', 'allowed' => ['application']]],
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->policy = new MutableMediaPolicy;
        $this->app->instance(MediaAuthorization::class, $this->policy);
        $this->app->instance(TemplateAuthorization::class, new class implements TemplateAuthorization
        {
            public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void {}
        });
        Storage::fake('retained');
        $this->migrateInMemorySqlite();
    }

    public function test_native_upload_has_private_owner_identity_and_never_deduplicates_retained_assets(): void
    {
        $first = $this->asset();
        $second = $this->asset();
        self::assertNotSame($first->media_id, $second->media_id);
        self::assertSame(2, MediaModelRegistry::query()->count());
        self::assertSame(2, MediaAssociation::query()->where('collection', 'retained_asset')->count());
        self::assertArrayNotHasKey('disk', $first->getAttributes());
        self::assertArrayNotHasKey('path', $first->getAttributes());
        [$stored, $bytes] = $this->app->make(TemplateAssets::class)->contents($first->id, SystemActor::Background);
        self::assertSame($first->checksum, hash('sha256', $bytes));
        self::assertSame($first->media_id, $stored->media_id);
        self::assertFalse(MediaModelRegistry::query()->findOrFail($first->media_id)->is_public);
    }

    public function test_current_download_policy_is_required_for_every_byte_read(): void
    {
        $asset = $this->asset();
        $this->policy->denied = [MediaAbility::Download];
        $this->expectException(AuthorizationException::class);
        $this->app->make(TemplateAssets::class)->contents($asset->id, SystemActor::Background);
    }

    public function test_current_view_policy_is_required_for_every_byte_read(): void
    {
        $asset = $this->asset();
        $this->policy->denied = [MediaAbility::View];
        $this->expectException(AuthorizationException::class);
        $this->app->make(TemplateAssets::class)->contents($asset->id, SystemActor::Background);
    }

    public function test_download_policy_receives_fresh_actor_after_revocation_inside_an_operation(): void
    {
        Schema::create('retained_test_users', function (Blueprint $table): void {
            $table->id();
            $table->boolean('can_download')->default(true);
        });
        $actor = RetainedTestUser::query()->create(['can_download' => true]);
        $asset = $this->app->make(TemplateAssets::class)->upload(UploadedFile::fake()->image('logo.png', 2, 2), $actor);
        $this->app->make(TemplateOperation::class)->run($actor, function () use ($actor, $asset): void {
            RetainedTestUser::query()->whereKey($actor->id)->update(['can_download' => false]);
            $this->expectException(AuthorizationException::class);
            $this->app->make(AssetManager::class)->contents($asset->id);
        });
    }

    public function test_changed_native_revision_is_rejected_even_with_unchanged_bytes(): void
    {
        $asset = $this->asset();
        MediaModelRegistry::query()->whereKey($asset->media_id)->increment('revision');
        $this->expectException(ValidationException::class);
        $this->app->make(TemplateAssets::class)->contents($asset->id, SystemActor::Background);
    }

    public function test_changed_storage_bytes_are_rejected_even_at_the_same_size(): void
    {
        $asset = $this->asset();
        $media = MediaModelRegistry::query()->findOrFail($asset->media_id);
        $resolved = $this->app->make(MediaAssetService::class)->resolve($media);
        Storage::disk($resolved['disk'])->put($resolved['path'], str_repeat('x', $asset->size));
        $this->expectException(ValidationException::class);
        $this->app->make(TemplateAssets::class)->contents($asset->id, SystemActor::Background);
    }

    public function test_attachment_denial_rolls_back_asset_media_and_native_file_effects(): void
    {
        $this->policy->denied = [MediaAbility::Associate];
        try {
            $this->asset();
            self::fail('Association denial was bypassed.');
        } catch (AuthorizationException) {
            self::assertSame(0, TemplateAsset::query()->count());
            self::assertSame(0, MediaModelRegistry::query()->count());
            self::assertSame([], Storage::disk('retained')->allFiles());
        }
    }

    public function test_outer_rollback_removes_nested_successful_upload_bytes(): void
    {
        $connection = (new TemplateAsset)->getConnection();
        $connection->beginTransaction();
        try {
            $this->asset();
            self::assertNotEmpty(Storage::disk('retained')->allFiles());
        } finally {
            $connection->rollBack();
        }
        self::assertSame(0, TemplateAsset::query()->count());
        self::assertSame(0, MediaModelRegistry::query()->count());
        self::assertSame([], Storage::disk('retained')->allFiles());
    }

    public function test_different_actual_connection_is_rejected_before_writes(): void
    {
        config(['database.connections.other' => config('database.connections.sqlite')]);
        $owner = (new TemplateAsset)->setConnection('other');
        try {
            $this->app->make(RetainedMedia::class)->connection($owner);
            self::fail('A separate connection was admitted.');
        } catch (\LogicException $error) {
            self::assertStringContainsString('same actual database connection', $error->getMessage());
            self::assertSame([], Storage::disk('retained')->allFiles());
            self::assertSame(0, TemplateAsset::query()->count());
        }
    }

    public function test_retained_identity_cannot_be_reassigned(): void
    {
        $asset = $this->asset();
        $asset->media_revision++;
        $this->expectException(\LogicException::class);
        $asset->save();
    }

    public function test_complete_email_bundle_survives_native_retention_and_deletion(): void
    {
        $render = $this->renderOwner();
        $document = new RenderedDocument('<img src="cid:logo">', '.email{}', 'Subject', 'Plain text', 'revision', 'digest', [
            ['cid' => 'logo', 'name' => 'logo.png', 'mimeType' => 'image/png', 'content' => base64_encode('inline bytes')],
        ]);
        $this->app->make(TemplateOperation::class)->run(SystemActor::Background, function () use ($render, $document): void {
            $artifacts = $this->app->make(RenderArtifacts::class);
            $manifest = $artifacts->store($render, $document);
            self::assertArrayNotHasKey('disk', $manifest);
            self::assertArrayNotHasKey('path', $manifest);
            $render->result = $manifest;
            $render->save();
            self::assertSame($document->toArray(), json_decode($artifacts->read($render), true, flags: JSON_THROW_ON_ERROR));
            self::assertTrue($artifacts->delete($render, $manifest));
            self::assertSame([], Storage::disk('retained')->allFiles());
        });
    }

    public function test_binary_pdf_is_preserved_exactly_in_native_media(): void
    {
        $render = $this->renderOwner();
        $bytes = file_get_contents(__DIR__.'/retained.pdf');
        $this->app->make(TemplateOperation::class)->run(SystemActor::Background, function () use ($render, $bytes): void {
            $artifacts = $this->app->make(RenderArtifacts::class);
            $render->result = $artifacts->write($render, $bytes, 'pdf', 'application/pdf', 'retained.pdf');
            $render->save();
            self::assertSame($bytes, $artifacts->read($render));
            self::assertSame('application/pdf', $render->result['mimeType']);
            self::assertSame(hash('sha256', $bytes), $render->result['checksum']);
        });
    }

    public function test_failed_enclosing_output_commit_rolls_back_native_upload(): void
    {
        $render = $this->renderOwner();
        $connection = $render->getConnection();
        $connection->beginTransaction();
        try {
            $this->app->make(TemplateOperation::class)->run(SystemActor::Background, function () use ($render): void {
                $manifest = $this->app->make(RenderArtifacts::class)->write($render, '{"html":"retained"}', 'json', 'application/json', 'render.json');
                $render->update(['result' => $manifest]);
                self::assertCount(1, Storage::disk('retained')->allFiles());
            });
        } finally {
            $connection->rollBack();
        }
        self::assertNull($render->fresh()->result);
        self::assertSame(0, MediaModelRegistry::query()->count());
        self::assertSame([], Storage::disk('retained')->allFiles());
    }

    public function test_current_media_delete_policy_is_required_for_output_cleanup(): void
    {
        $render = $this->renderOwner();
        $this->app->make(TemplateOperation::class)->run(SystemActor::Background, function () use ($render): void {
            $artifacts = $this->app->make(RenderArtifacts::class);
            $manifest = $artifacts->write($render, '{"html":"retained"}', 'json', 'application/json', 'render.json');
            $this->policy->denied = [MediaAbility::Delete];
            try {
                $artifacts->delete($render, $manifest);
                self::fail('Delete denial was bypassed.');
            } catch (AuthorizationException) {
                self::assertSame(1, MediaModelRegistry::query()->count());
                self::assertCount(1, Storage::disk('retained')->allFiles());
            }
        });
    }

    private function asset(): TemplateAsset
    {
        return $this->app->make(TemplateAssets::class)->upload(UploadedFile::fake()->image('logo.png', 2, 2), SystemActor::Background);
    }

    private function renderOwner(): TemplateRender
    {
        $template = TemplateModelRegistry::create(['key' => 'media-output', 'name' => 'Media output']);
        $revision = TemplateRevision::query()->create([
            'template_id' => $template->id, 'revision' => 1, 'source' => [], 'document' => [],
            'dependencies' => [], 'checksum' => str_repeat('c', 64), 'published_at' => now(),
        ]);

        return TemplateRender::query()->create([
            'template_revision_id' => $revision->id, 'idempotency_key' => 'native-media',
            'fingerprint' => str_repeat('a', 64), 'output' => 'html', 'status' => 'processing',
            'snapshot' => [], 'snapshot_checksum' => str_repeat('b', 64), 'generation' => 1,
            'available_at' => now(), 'expires_at' => now()->addDay(),
        ]);
    }
}

final class MutableMediaPolicy implements MediaAuthorization
{
    /** @var list<MediaAbility> */
    public array $denied = [];

    public function allows(Authenticatable|SystemActor $actor, MediaAbility $ability, ?Media $media = null, ?Model $owner = null): bool
    {
        return ! in_array($ability, $this->denied, true)
            && ! ($ability === MediaAbility::Download && $actor instanceof RetainedTestUser && ! $actor->can_download);
    }
}

final class RetainedTestUser extends User
{
    protected $table = 'retained_test_users';

    protected $guarded = [];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['can_download' => 'boolean'];
    }
}
