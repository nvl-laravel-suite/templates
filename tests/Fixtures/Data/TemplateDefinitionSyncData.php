<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Data;

use Nvl\Templates\Tests\Fixtures\ConsumerSupport\DataTransform;
use Spatie\LaravelData\Data;

/**
 * Describes one deterministic source-definition synchronization operation.
 *
 * @api
 */
final class TemplateDefinitionSyncData extends Data
{
    use DataTransform;

    public function __construct(
        public readonly string $key,
        public readonly string $operation,
    ) {}
}
