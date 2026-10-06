<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use Nvl\Templates\Contracts\TemplateRenderer;
use Nvl\Templates\Data\RenderedTemplateData;
use Nvl\Templates\Exceptions\TemplateDependencyUnavailableException;

/** Retains the built-in PDF alias safely while its optional runtime dependency is absent. @internal */
final readonly class UnavailablePdfTemplateRenderer implements TemplateRenderer
{
    /** Report the selected dependency requirement without fabricating PDF output. */
    public function render(TemplateRenderContext $context): RenderedTemplateData
    {
        throw new TemplateDependencyUnavailableException("Built-in PDF requires composer require 'mpdf/mpdf:^8.3.0' --with-all-dependencies and mPDF's GD/mbstring extensions.");
    }
}
