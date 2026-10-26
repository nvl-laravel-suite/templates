<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Data;

use Spatie\LaravelData\Attributes\MapInputName;
use Spatie\LaravelData\Attributes\MapOutputName;
use Spatie\LaravelData\Data;

/**
 * One stable template alias pointing at an exact NVL Media resource.
 */
final class MediaTemplateAssetData extends Data
{
    public function __construct(
        public readonly string $key,
        public readonly string $mediaId,
        public readonly string $scope = 'default',
        public readonly string $type = 'image',
        public readonly string $variation = '',
        public readonly string $delivery = 'path',
        #[MapInputName('expected_revision')] #[MapOutputName('expected_revision')] public readonly ?int $expectedRevision = null,
    ) {}
}
