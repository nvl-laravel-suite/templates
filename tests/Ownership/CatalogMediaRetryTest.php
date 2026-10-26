<?php

declare(strict_types=1);
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Facades\Storage;
use Nvl\Content\Enums\ContentVisibility;
use Nvl\Media\Contracts\MediaCatalogAccess;
use Nvl\Media\Enums\MediaType;
use Nvl\Media\Ownership\MediaOwnerCatalog;
use Nvl\Media\Services\MediaModelRegistry;
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateCatalogAccess;
use Nvl\Templates\Ownership\TemplateOwnerCatalog;
use Nvl\Templates\Tests\Fixtures\MediaRetryTemplateOwnershipTestCase;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateScenario;

uses(MediaRetryTemplateOwnershipTestCase::class);
it('discards every unconsumed physical Media stage on successful idempotent import retries', function (): void {
    Storage::fake('public');
    app()->bind(TemplateCatalogAccess::class, fn () => new class implements TemplateCatalogAccess
    {
        public function assertCanGrant(string $id, int $revision): void {}

        public function assertCanRevoke(string $id): void {}
    });
    app()->bind(MediaCatalogAccess::class, fn () => new class implements MediaCatalogAccess
    {
        public function assertCanGrant(Authenticatable|SystemActor $actor, string $id, int $revision): void {}

        public function assertCanRevoke(Authenticatable|SystemActor $actor, string $id): void {}
    });
    $runner = app(OwnershipRunner::class);
    $actor = OwnershipActor::firstOrFail();
    [$media, $source] = $runner->central('templates-maintain', $actor, function (): array {
        $media = MediaModelRegistry::create(['filename' => 'catalog.png', 'hash' => 'catalog.png', 'extension' => 'png', 'mime_type' => 'image/png', 'size' => 7, 'disk' => 'public', 'folder' => 'catalog', 'storage_path' => 'media/central/catalog/catalog.png', 'type' => MediaType::IMAGE, 'digest' => hash('sha256', 'catalog')]);
        Storage::disk('public')->put($media->storage_path, 'catalog');

        return [$media, OwnershipTemplateScenario::version(values: ['logo' => $media->id], visibility: ContentVisibility::Private)];
    });
    $runner->run(OwnershipCompany::findOrFail(7), $actor, function () use ($media, $source): void {
        $mediaGrant = app(MediaOwnerCatalog::class)->grant(SystemActor::Background, $media->id, $media->revision);
        $catalog = app(TemplateOwnerCatalog::class);
        $grant = $catalog->grant($source->id, $source->revision);
        $data = ['grantId' => $grant->id, 'expectedGrantRevision' => $grant->revision, 'expectedSourceRevision' => $source->revision, 'targetKey' => 'welcome', 'idempotency_key' => 'physical-retry', 'mediaGrantIds' => [$media->id => $mediaGrant->id]];
        $copy = $catalog->import($data, SystemActor::Background);
        $files = Storage::disk('public')->allFiles();
        sort($files);
        expect($files)->toHaveCount(2);
        for ($retry = 0; $retry < 3; $retry++) {
            expect($catalog->import($data, SystemActor::Background)->id)->toBe($copy->id);
            $after = Storage::disk('public')->allFiles();
            sort($after);
            expect($after)->toBe($files)->and(MediaModelRegistry::query()->count())->toBe(1);
        }
    });
});
