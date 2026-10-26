<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Rendering\TemplateRenderContext;

/**
 * Renders a resolved template through an explicitly registered driver.
 *
 * @api
 */
interface TemplateRenderer
{
    /**
     * Render one fully validated template context.
     *
     * @return array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}
     */
    public function render(TemplateRenderContext $context): array;
}
