<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Nvl\Media\Contracts\MediaAuthorization;
use Nvl\Media\Enums\MediaAbility;
use Nvl\Media\Models\Media;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Services\ResourceManager;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Services\TemplateCatalog;
use Nvl\Templates\Services\TemplateFamilies;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateOperation;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Tests\CanonicalTestCase;

final class CatalogTest extends CanonicalTestCase
{
    use RefreshDatabase;

    /** @var array<string, class-string<Model>> */
    private array $originalMorphMap = [];

    protected function setUp(): void
    {
        $this->originalMorphMap = Relation::morphMap();
        parent::setUp();
    }

    protected function tearDown(): void
    {
        try {
            parent::tearDown();
        } finally {
            Relation::morphMap($this->originalMorphMap, false);
        }
    }

    /** @param Application $app */
    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $app->make('config')->set('nvl-templates.models.template', CatalogTemplate::class);
    }

    public function test_templates_and_groups_use_native_pages_and_stable_name_identity_order(): void
    {
        $templates = app(TemplateLifecycle::class);
        $families = app(TemplateFamilies::class);
        foreach (['Zulu', 'Alpha', 'Alpha'] as $index => $name) {
            $templates->create(['key' => 'template-'.$index, 'name' => $name], $this->actor());
            $families->create(['key' => 'family-'.$index, 'name' => $name], $this->actor());
        }
        $catalog = app(TemplateCatalog::class);
        $first = $catalog->templates(['per_page' => 2], $this->actor());
        self::assertInstanceOf(LengthAwarePaginator::class, $first);
        self::assertSame(3, $first->total());
        self::assertSame(2, $first->perPage());
        self::assertSame(1, $first->currentPage());
        self::assertSame(['Alpha', 'Alpha'], $first->getCollection()->pluck('name')->all());
        self::assertInstanceOf(CatalogTemplate::class, $first->getCollection()->first());
        $ids = $first->getCollection()->pluck('id')->all();
        $sorted = $ids;
        sort($sorted);
        self::assertSame($sorted, $ids);
        $second = $catalog->templates(['page' => 2, 'per_page' => 2], $this->actor());
        self::assertSame(['Zulu'], $second->getCollection()->pluck('name')->all());
        self::assertSame(2, $second->lastPage());
        $groups = $catalog->groups(['page' => 2, 'per_page' => 2], $this->actor());
        self::assertSame(3, $groups->total());
        self::assertSame(['Zulu'], $groups->getCollection()->pluck('name')->all());
        self::assertInstanceOf(TemplateGroup::class, $groups->getCollection()->sole());
    }

    public function test_native_controls_are_honest_and_do_not_use_an_ambient_page_resolver(): void
    {
        Paginator::currentPageResolver(static fn (): int => 999);
        $catalog = app(TemplateCatalog::class);
        try {
            self::assertSame(1, $catalog->templates([], $this->actor())->currentPage());
            self::assertSame(25, $catalog->groups([], $this->actor())->perPage());
            self::assertSame(30, $catalog->assets([], $this->actor())->perPage());
            self::assertSame(1000000, $catalog->templates(['page' => 1000000, 'per_page' => 100], $this->actor())->currentPage());
            foreach ([['page' => 0], ['page' => 1000001], ['page' => '2'], ['page' => null], ['per_page' => 101], ['per_page' => 0], ['per_page' => 1.5], ['per_page' => true], ['perPage' => 3], ['scope_id' => 'other'], ['sort' => 'name']] as $query) {
                foreach (['templates', 'groups', 'assets'] as $method) {
                    try {
                        $catalog->{$method}($query, $this->actor());
                        self::fail('Invalid catalog controls were silently accepted.');
                    } catch (ValidationException $error) {
                        self::assertNotEmpty($error->errors());
                    }
                }
            }
            foreach ([['target' => null], ['target' => 'pdf'], ['target' => ['email']]] as $query) {
                try {
                    $catalog->assets($query, $this->actor());
                    self::fail('Invalid asset target was silently accepted.');
                } catch (ValidationException $error) {
                    self::assertNotEmpty($error->errors());
                }
            }
            foreach (['templates', 'groups'] as $method) {
                try {
                    $catalog->{$method}(['target' => 'email'], $this->actor());
                    self::fail('Asset-only controls were admitted to a different catalog.');
                } catch (ValidationException $error) {
                    self::assertNotEmpty($error->errors());
                }
            }
        } finally {
            Paginator::currentPageResolver(static fn (): int => 1);
        }
    }

    public function test_record_filtering_retains_honest_scoped_totals_and_original_pages(): void
    {
        $lifecycle = app(TemplateLifecycle::class);
        $hidden = $lifecycle->create(['key' => 'hidden', 'name' => 'Alpha hidden'], $this->actor());
        $visible = $lifecycle->create(['key' => 'visible', 'name' => 'Beta visible'], $this->actor());
        Gate::define('templates.read', static fn ($user, ?Model $record = null): bool => $record?->getKey() !== $hidden->id);
        $catalog = app(TemplateCatalog::class);
        $first = $catalog->templates(['page' => 1, 'per_page' => 1], $this->actor());
        self::assertSame(2, $first->total());
        self::assertSame(2, $first->lastPage());
        self::assertCount(0, $first->items());
        $second = $catalog->templates(['page' => 2, 'per_page' => 1], $this->actor());
        self::assertSame($visible->id, $second->getCollection()->sole()->id);
    }

    public function test_catalog_admission_is_required_and_operation_actor_is_restored_on_denial(): void
    {
        Gate::define('templates.read', static fn (): bool => false);
        $catalog = app(TemplateCatalog::class);
        foreach (['templates', 'groups', 'assets'] as $method) {
            try {
                $catalog->{$method}([], $this->actor());
                self::fail('Catalog read admission was bypassed.');
            } catch (AuthorizationException $error) {
                self::assertNotSame('', $error->getMessage());
            }
        }
        $this->expectException(AuthorizationException::class);
        app(TemplateOperation::class)->actor();
    }

    public function test_email_mime_filter_runs_before_pagination_and_metadata_does_not_grant_bytes(): void
    {
        $assets = app(TemplateAssets::class);
        $png = $assets->upload(UploadedFile::fake()->image('older.png', 1, 1), $this->actor());
        $webpBytes = base64_decode('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v02aAA=', true);
        self::assertIsString($webpBytes);
        for ($index = 0; $index < 3; $index++) {
            $assets->upload(UploadedFile::fake()->createWithContent('newer-'.$index.'.webp', $webpBytes), $this->actor());
        }
        app()->instance(MediaAuthorization::class, new class implements MediaAuthorization
        {
            public function allows(Authenticatable|SystemActor $actor, MediaAbility $ability, ?Media $media = null, ?Model $owner = null): bool
            {
                return $ability !== MediaAbility::Download;
            }
        });
        $catalog = app(TemplateCatalog::class);
        $documents = $catalog->assets(['target' => 'document', 'per_page' => 2], $this->actor());
        self::assertSame(4, $documents->total());
        self::assertSame(['image/webp', 'image/webp'], $documents->getCollection()->pluck('mime_type')->all());
        $email = $catalog->assets(['target' => 'email', 'per_page' => 2], $this->actor());
        self::assertSame(1, $email->total());
        self::assertSame($png->id, $email->getCollection()->sole()->id);
        foreach (['url', 'previewUrl', 'content', 'bytes', 'disk', 'path'] as $field) {
            self::assertArrayNotHasKey($field, $email->getCollection()->sole()->toArray());
        }
        $this->expectException(AuthorizationException::class);
        app(TemplateAssets::class)->contents($png->id, $this->actor());
    }

    public function test_assets_exclude_archived_and_uninitialized_retention_before_pagination(): void
    {
        $assets = app(TemplateAssets::class);
        $retained = $assets->upload(UploadedFile::fake()->image('retained.png', 1, 1), $this->actor());
        $archived = $assets->upload(UploadedFile::fake()->image('archived.png', 1, 1), $this->actor());
        $archived->update(['archived_at' => now()]);
        TemplateAsset::query()->create(['name' => 'not-initialized.png', 'mime_type' => 'image/png', 'size' => 1, 'checksum' => str_repeat('a', 64)]);
        $page = app(TemplateCatalog::class)->assets(['per_page' => 1], $this->actor());
        self::assertSame(1, $page->total());
        self::assertSame($retained->id, $page->getCollection()->sole()->id);
        self::assertCount(0, app(TemplateCatalog::class)->assets(['per_page' => 1, 'page' => 2], $this->actor())->items());
    }

    public function test_all_catalogs_and_group_revisions_preserve_current_application_scope(): void
    {
        app(TemplateLifecycle::class)->create(['key' => 'scope-a', 'name' => 'Scope A'], $this->actor());
        $group = app(TemplateFamilies::class)->create(['key' => 'scope-family', 'name' => 'Scope family'], $this->actor());
        app(TemplateFamilies::class)->publish($group->id, $this->document(), 0, $this->actor());
        app(TemplateAssets::class)->upload(UploadedFile::fake()->image('private.png', 1, 1), $this->actor());
        config(['nvl-templates.scope' => 'different-host-scope']);
        $catalog = app(TemplateCatalog::class);
        self::assertSame(0, $catalog->templates([], $this->actor())->total());
        self::assertSame(0, $catalog->groups([], $this->actor())->total());
        self::assertSame(0, $catalog->assets([], $this->actor())->total());
        $this->expectException(ModelNotFoundException::class);
        $catalog->groupRevision($group->id, 1, $this->actor());
    }

    public function test_exact_group_revision_requires_both_family_and_revision_read_permissions(): void
    {
        $families = app(TemplateFamilies::class);
        $group = $families->create(['key' => 'family', 'name' => 'Family'], $this->actor());
        $first = $families->publish($group->id, $this->document(), 0, $this->actor());
        $families->publish($group->id, $this->document(), 1, $this->actor());
        $catalog = app(TemplateCatalog::class);
        self::assertSame($first->id, $catalog->groupRevision($group->id, 1, $this->actor())->id);
        foreach ([$group->id, $first->id] as $deniedId) {
            Gate::define('templates.read', static fn ($user, ?Model $record = null): bool => $record?->getKey() !== $deniedId);
            try {
                $catalog->groupRevision($group->id, 1, $this->actor());
                self::fail('A denied family or revision was returned.');
            } catch (AuthorizationException $error) {
                self::assertNotSame('', $error->getMessage());
            }
        }
        Gate::define('templates.read', static fn (): bool => true);
        try {
            $catalog->groupRevision($group->id, 0, $this->actor());
            self::fail('An unpublished revision number was accepted.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('revision', $error->errors());
        }
        $this->expectException(ModelNotFoundException::class);
        $catalog->groupRevision($group->id, 3, $this->actor());
    }

    public function test_group_revision_denies_materialized_content_when_its_resource_read_is_revoked(): void
    {
        $resources = app(ResourceManager::class);
        $resource = $resources->create('private-copy', 'Private copy', 'content', 'tenant', null, $this->actor());
        $resources->publish($resource->id, ['secret' => 'Retained confidential copy'], 0, $this->actor());
        $document = array_replace_recursive($this->document(), [
            'content' => ['secret' => ['kind' => 'content', 'resourceId' => $resource->id, 'revision' => 1, 'path' => 'secret']],
            'dataSchema' => ['properties' => ['content' => ['properties' => ['secret' => ['type' => 'string']]]]],
        ]);
        $families = app(TemplateFamilies::class);
        $family = $families->create(['key' => 'private-family', 'name' => 'Private family'], $this->actor());
        $release = $families->publish($family->id, $document, 0, $this->actor());
        $catalog = app(TemplateCatalog::class);
        self::assertSame(['secret' => 'Retained confidential copy'], $catalog->groupRevision($family->id, 1, $this->actor())->document['content']);
        Gate::define('templates.read', static fn ($user, ?Model $record = null): bool => $record?->getKey() !== $resource->id);
        app(TemplateOperation::class)->run($this->actor(), function () use ($family, $release): void {
            self::assertTrue(Access::allows('read', $family));
            self::assertTrue(Access::allows('read', $release));
        });
        $this->expectException(AuthorizationException::class);
        $catalog->groupRevision($family->id, 1, $this->actor());
    }

    /** @return array<string,mixed> */
    private function document(): array
    {
        $path = dirname(__DIR__).'/Fixtures/document-bindings.json';
        $bytes = file_get_contents($path);
        if ($bytes === false) {
            throw new \RuntimeException('Missing document fixture.');
        }
        $document = json_decode($bytes, true, flags: JSON_THROW_ON_ERROR);
        if (! is_array($document)) {
            throw new \RuntimeException('Invalid document fixture.');
        }
        $result = [];
        foreach ($document as $key => $value) {
            if (! is_string($key)) {
                throw new \RuntimeException('Invalid document fixture key.');
            }
            $result[$key] = $value;
        }

        return $result;
    }
}

final class CatalogTemplate extends Template {}
