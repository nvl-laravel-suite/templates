<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Services;

use Illuminate\Foundation\Application;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Services\ResourceManager;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Tests\CanonicalTestCase;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class PublicationAssetTargetTest extends CanonicalTestCase
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

    #[DataProvider('targetAssets')]
    public function test_publication_checks_known_native_media_against_the_consuming_target(string $target, string $mime, string $reference): void
    {
        $encoded = $mime === 'png'
            ? 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
            : 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v02aAA=';
        $bytes = base64_decode($encoded, true);
        self::assertIsString($bytes);
        $asset = app(TemplateAssets::class)->upload(UploadedFile::fake()->createWithContent('logo.'.$mime, $bytes), $this->actor());
        self::assertSame('image/'.$mime, $asset->mime_type);
        $document = Documents::standalone();
        $document['target'] = $target;
        if ($reference === 'managed') {
            $document['managedAssets'] = ['logo' => $asset->id];
        } else {
            $value = $asset->id;
            if ($reference === 'resource-binding') {
                $resources = app(ResourceManager::class);
                $resource = $resources->create('logo', 'Reusable logo', 'content', 'tenant', null, $this->actor());
                $published = $resources->publish($resource->id, ['logo' => $asset->id], 0, $this->actor());
                self::assertSame($asset->id, $published->document['logo']);
                $value = ['kind' => 'content', 'resourceId' => $resource->id, 'revision' => 1, 'path' => 'logo'];
            }
            data_set($document, 'dataSchema.properties.inputs.properties.logo', ['type' => 'string']);
            data_set($document, 'inputDefaults.logo', $value);
            $html = data_get($document, 'artifacts.html');
            self::assertIsString($html);
            data_set($document, 'artifacts.html', str_replace('</body>', '<img src="{{logo}}" alt="Logo"></body>', $html));
            $bindings = data_get($document, 'artifacts.bindings');
            self::assertIsArray($bindings);
            $bindings[] = ['id' => 'logo', 'path' => 'inputs.logo', 'kind' => 'image'];
            data_set($document, 'artifacts.bindings', $bindings);
        }
        $templates = app(TemplateLifecycle::class);
        $template = $templates->create(['key' => 'publication', 'name' => 'Publication'], $this->actor());
        self::assertIsArray($document);
        $templates->saveDraft($template->id, $document, 0, $this->actor());

        if ($target === 'email' && $mime === 'webp') {
            try {
                $templates->publish($template->id, 1, $this->actor());
                self::fail('Known WebP bytes must fail email publication before an immutable release is created.');
            } catch (ValidationException $error) {
                self::assertArrayHasKey('asset', $error->errors());
            }
            $current = Template::query()->findOrFail($template->id);
            self::assertSame(0, $current->version);
            self::assertNull($current->current_revision_id);
            self::assertSame(0, TemplateRevision::query()->count());
        } else {
            $revision = $templates->publish($template->id, 1, $this->actor());
            self::assertSame(1, $revision->revision);
            self::assertSame($target, $revision->document['target']);
            self::assertSame($revision->id, Template::query()->findOrFail($template->id)->current_revision_id);
        }
    }

    /** @return iterable<string,array{string,string,string}> */
    public static function targetAssets(): iterable
    {
        foreach (['email', 'document'] as $target) {
            foreach (['png', 'webp'] as $mime) {
                foreach (['managed', 'default-binding', 'resource-binding'] as $reference) {
                    yield $target.' '.$mime.' '.$reference => [$target, $mime, $reference];
                }
            }
        }
    }

    private function disk(): string
    {
        return 'publication-asset-target-'.getmypid();
    }
}
