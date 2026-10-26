<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use Illuminate\Contracts\View\Factory;
use Nvl\Templates\Contracts\TemplateRenderer;

/**
 * Renders a source-controlled Blade view with a bounded data context.
 */
final readonly class BladeTemplateRenderer implements TemplateRenderer
{
    public function __construct(private Factory $views) {}

    /**
     * Render one template view as UTF-8 HTML.
     *
     * @return array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}
     */
    public function render(TemplateRenderContext $context): array
    {
        $content = $this->views
            ->make($context->view, $context->viewData())
            ->render();

        return ['subject' => $context->subject, 'suggested_filename' => $context->filename
                ?? "{$context->template->key}-{$context->locale}.html", 'content' => $content, 'mime_type' => 'text/html; charset=UTF-8', 'renderer' => $context->renderer, 'byte_size' => strlen($content), 'checksum' => hash('sha256', $content)];
    }
}
