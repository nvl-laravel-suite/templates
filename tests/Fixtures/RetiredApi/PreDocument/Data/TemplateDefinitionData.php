<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Data;

use Nvl\Templates\Tests\Fixtures\ConsumerSupport\DataTransform;
use Spatie\LaravelData\Data;

/**
 * Source-controlled executable definition for one template key.
 */
final class TemplateDefinitionData extends Data
{
    use DataTransform;

    /**
     * @param  list<string>  $profiles
     * @param  list<string>  $requiredRegions
     * @param  list<string>  $allowedContentDefinitions
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $rendererOptions
     */
    public function __construct(
        public readonly string $key,
        public readonly string $renderer,
        public readonly string $view,
        public readonly array $profiles = ['default'],
        public readonly array $schema = [],
        public readonly array $rendererOptions = [],
        public readonly ?string $subjectPath = null,
        public readonly array $requiredRegions = [],
        public readonly array $allowedContentDefinitions = [],
    ) {}
}
