<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Data\Mutations;

use Nvl\Templates\Tests\Fixtures\ConsumerSupport\DataTransform;
use Spatie\LaravelData\Attributes\MapInputName;
use Spatie\LaravelData\Attributes\MapOutputName;
use Spatie\LaravelData\Data;
use Spatie\LaravelData\Mappers\CamelCaseMapper;

/**
 * Complete draft content replacement with optimistic concurrency.
 *
 * @api
 */
#[MapInputName(CamelCaseMapper::class)]
#[MapOutputName(CamelCaseMapper::class)]
final class UpdateTemplateVersionData extends Data
{
    use DataTransform;

    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public readonly int $expectedRevision,
        public readonly array $metadata = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public static function rules(): array
    {
        return [
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'metadata' => ['array'],
        ];
    }
}
