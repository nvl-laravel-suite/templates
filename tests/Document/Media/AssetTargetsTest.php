<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Media;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\Tests\CanonicalTestCase;

final class AssetTargetsTest extends CanonicalTestCase
{
    use RefreshDatabase;

    public function test_retained_webp_is_document_only_even_when_email_bytes_are_deferred(): void
    {
        $assets = app(TemplateAssets::class);
        $webp = $this->webp();
        self::assertSame('image/webp', $assets->resolve($webp->id, 'document', false, $this->actor())['mimeType']);
        foreach ([true, false] as $embedEmail) {
            try {
                $assets->resolve($webp->id, 'email', $embedEmail, $this->actor());
                self::fail('A retained WebP was accepted as an email asset.');
            } catch (ValidationException $error) {
                self::assertArrayHasKey('asset', $error->errors());
            }
        }
        $png = $assets->upload(UploadedFile::fake()->image('mail.png', 1, 1), $this->actor());
        foreach ([true, false] as $embedEmail) {
            $resolved = $assets->resolve($png->id, 'email', $embedEmail, $this->actor());
            self::assertSame('image/png', $resolved['mimeType']);
            self::assertSame($embedEmail, $resolved['attachment'] !== null);
        }
    }

    public function test_native_email_render_rejects_runtime_webp_image_after_publication(): void
    {
        $lifecycle = app(TemplateLifecycle::class);
        $template = $lifecycle->create(['key' => 'runtime-image', 'name' => 'Runtime image'], $this->actor());
        $draft = $lifecycle->saveDraft($template->id, $this->emailDocument(), 0, $this->actor());
        $release = $lifecycle->publish($template->id, $draft->version, $this->actor());
        $assets = app(TemplateAssets::class);
        $png = $assets->upload(UploadedFile::fake()->image('mail.png', 1, 1), $this->actor());
        $renderer = app(TemplateRenderer::class);
        $result = $renderer->render($release->id, ['facts' => ['code' => 'MAIL', 'logo' => $png->id]], $this->actor());
        self::assertSame('image/png', $result['inlineAssets'][0]['mimeType']);
        $webp = $this->webp();
        $this->expectException(ValidationException::class);
        $renderer->render($release->id, ['facts' => ['code' => 'MAIL', 'logo' => $webp->id]], $this->actor());
    }

    private function webp(): TemplateAsset
    {
        return app(TemplateAssets::class)->upload(UploadedFile::fake()->createWithContent('document.webp', base64_decode('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v02aAA=')), $this->actor());
    }

    /** @return array<array-key,mixed> */
    private function emailDocument(): array
    {
        $bytes = file_get_contents(dirname(__DIR__, 2).'/Fixtures/document-bindings.json');
        if ($bytes === false) {
            throw new \RuntimeException('Missing document fixture.');
        }
        $document = json_decode($bytes, true, flags: JSON_THROW_ON_ERROR);
        if (! is_array($document)) {
            throw new \RuntimeException('Invalid document fixture.');
        }
        $document = array_replace_recursive($document, [
            'target' => 'email',
            'dataSchema' => ['properties' => ['facts' => ['properties' => ['logo' => ['type' => 'string']]]]],
        ]);
        $document['artifacts'] = [
            'engine' => 'bindings', 'html' => '<html><head></head><body><img src="{{logo}}" alt="Logo"></body></html>',
            'css' => '', 'subject' => 'Logo', 'text' => 'Logo',
            'bindings' => [['id' => 'logo', 'path' => 'facts.logo', 'kind' => 'image']],
        ];

        return $document;
    }
}
