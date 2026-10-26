<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Data\Mutations;

use Nvl\Templates\Tests\Fixtures\ConsumerSupport\DataTransform;
use Spatie\LaravelData\Attributes\MapInputName;
use Spatie\LaravelData\Attributes\MapOutputName;
use Spatie\LaravelData\Data;
use Spatie\LaravelData\Mappers\CamelCaseMapper;

/**
 * Validated template-to-owner assignment contract.
 *
 * @api
 */
#[MapInputName(CamelCaseMapper::class)]
#[MapOutputName(CamelCaseMapper::class)]
final class AssignTemplateData extends Data
{
    use DataTransform;

    /**
     * @param  array<string, mixed>  $settings
     */
    public function __construct(
        public readonly string $ownerType,
        public readonly string $ownerId,
        public readonly string $profile = 'default',
        public readonly ?string $versionId = null,
        public readonly array $settings = [],
        #[MapInputName('expected_revision')] #[MapOutputName('expected_revision')] public readonly int $expectedRevision = 0,
    ) {}

    /**
     * @return array<string, list<mixed>>
     */
    public static function rules(): array
    {
        return [
            'ownerType' => ['required', 'string', 'max:100'],
            'ownerId' => ['required', 'string', 'max:255'],
            'profile' => ['required', 'string', 'max:100'],
            'versionId' => ['nullable', 'uuid'],
            'settings' => ['array'],
            'expected_revision' => ['required', 'integer', 'min:0'],
        ];
    }
}
