<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Templates\Contracts\TemplateRenderer;
use Nvl\Templates\Rendering\TemplateRenderContext;
use Nvl\Templates\Services\TemplateContentGuard;

/**
 * Deterministic renderer used by package isolation tests.
 */
final class TestTemplateRenderer implements TemplateRenderer
{
    /**
     * Render deterministic text from a Content composition and template data.
     *
     * @return array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}
     */
    public function render(TemplateRenderContext $context): array
    {
        $text = app(TemplateContentGuard::class)->compositionValue($context->composition() ?? [], 'body.text');
        $name = $context->data()['name'] ?? '';
        $content = (is_string($text) ? $text : '').':'.
            (is_string($name) ? $name : '');

        return ['subject' => $context->subject, 'suggested_filename' => null, 'content' => $content, 'mime_type' => 'text/plain', 'renderer' => $context->renderer, 'byte_size' => strlen($content), 'checksum' => hash('sha256', $content)];
    }
}
