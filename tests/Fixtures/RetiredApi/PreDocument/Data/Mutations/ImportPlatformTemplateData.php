<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Data\Mutations;

use Spatie\LaravelData\Attributes\MapInputName;
use Spatie\LaravelData\Attributes\MapOutputName;

/**
 * Scalar-only request for copying one granted platform Template graph.
 *
 * @api
 */
final readonly class ImportPlatformTemplateData
{
    /** @param array<string,string> $mediaGrantIds */
    public function __construct(
        public string $grantId,
        public int $expectedGrantRevision,
        public int $expectedSourceRevision,
        public string $targetKey,
        #[MapInputName('idempotency_key')] #[MapOutputName('idempotency_key')] public string $idempotencyKey,
        public array $mediaGrantIds,
    ) {}
}
