<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use Nvl\Templates\Contracts\TemplateRenderer;
use Nvl\Templates\Exceptions\TemplateDependencyUnavailableException;

/** Retains the built-in PDF alias safely while its optional runtime dependency is absent. @internal */
final readonly class UnavailablePdfTemplateRenderer implements TemplateRenderer
{
    /** Report the selected dependency requirement without fabricating PDF output.
     * @return array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}
     */
    public function render(TemplateRenderContext $context): array
    {
        throw new TemplateDependencyUnavailableException("Built-in PDF requires composer require 'mpdf/mpdf:^8.3.0' --with-all-dependencies and mPDF's GD/mbstring extensions.");
    }
}
