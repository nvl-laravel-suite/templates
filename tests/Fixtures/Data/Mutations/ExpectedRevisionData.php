<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Data\Mutations;

use Nvl\Templates\Tests\Fixtures\ConsumerSupport\DataTransform;
use Spatie\LaravelData\Attributes\MapInputName;
use Spatie\LaravelData\Attributes\MapOutputName;
use Spatie\LaravelData\Data;
use Spatie\LaravelData\Mappers\CamelCaseMapper;

#[MapInputName(CamelCaseMapper::class)]
#[MapOutputName(CamelCaseMapper::class)]
final class ExpectedRevisionData extends Data
{
    use DataTransform;

    public function __construct(
        public readonly int $expectedRevision,

    ) {}

    /**
     * @return array<string, list<string>>
     */
    public static function rules(): array
    {
        return [
            'expectedRevision' => ['required', 'integer', 'min:1'],

        ];
    }
}
