<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Data\Mutations;

use Illuminate\Validation\Rule;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Tests\Fixtures\ConsumerSupport\DataTransform;
use Nvl\Translatable\Rules\SupportedLocaleMapRule;
use Spatie\LaravelData\Attributes\MapInputName;
use Spatie\LaravelData\Attributes\MapOutputName;
use Spatie\LaravelData\Data;
use Spatie\LaravelData\Mappers\CamelCaseMapper;

/**
 * Complete structural template replacement with optimistic concurrency.
 *
 * @api
 */
#[MapInputName(CamelCaseMapper::class)]
#[MapOutputName(CamelCaseMapper::class)]
final class UpdateTemplateData extends Data
{
    use DataTransform;

    /**
     * @param  array<string, mixed>  $metadata
     * @param  array<string, array<string, mixed>>  $translations
     */
    public function __construct(
        public readonly TemplateStatus $status,
        public readonly int $expectedRevision,
        public readonly array $metadata = [],
        public readonly array $translations = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public static function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(TemplateStatus::class)],
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'metadata' => ['array'],
            'translations' => ['array', new SupportedLocaleMapRule],
            'translations.*.title' => ['required', 'string', 'max:255'],
            'translations.*.description' => ['nullable', 'string'],
        ];
    }
}
