<?php

declare(strict_types=1);

namespace Nvl\Templates\Data;

use Nvl\Data\Traits\DataTransform;
use Spatie\LaravelData\Attributes\MapOutputName;
use Spatie\LaravelData\Data;
use Spatie\LaravelData\Mappers\CamelCaseMapper;

/**
 * Source-controlled identity and editor-facing capabilities for one template class.
 *
 * @api
 */
#[MapOutputName(CamelCaseMapper::class)]
final class TemplateMetadataData extends Data
{
    use DataTransform;

    /**
     * @param  list<string>  $supportedVariants
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public readonly string $title,
        public readonly ?string $description = null,
        public readonly ?string $group = null,
        public readonly array $supportedVariants = [],
        public readonly array $metadata = [],
    ) {}
}
