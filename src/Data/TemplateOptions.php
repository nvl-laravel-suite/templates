<?php

declare(strict_types=1);

namespace Nvl\Templates\Data;

use Nvl\Data\Traits\DataTransform;
use Spatie\LaravelData\Data;

/**
 * Per-template renderer, locale, naming, and driver-specific overrides.
 *
 * @api
 */
final class TemplateOptions extends Data
{
    use DataTransform;

    /**
     * @param  array<string, mixed>  $rendererOptions
     */
    public function __construct(
        public readonly ?string $renderer = null,
        public readonly ?string $locale = null,
        public readonly ?string $subject = null,
        public readonly ?string $filename = null,
        public readonly ?PdfOptions $pdf = null,
        public readonly array $rendererOptions = [],
    ) {}
}
