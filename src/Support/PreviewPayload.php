<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

use Illuminate\Validation\ValidationException;

/**
 * Bounds the exact default JSON encoding of native browser/editor result arrays.
 *
 * @internal
 */
final class PreviewPayload
{
    public static function limit(): int
    {
        $limit = config('nvl-templates.limits.preview_bytes', 8388608);
        if (! is_int($limit) || $limit < 1) {
            throw new \LogicException('Configure a positive integer preview byte limit.');
        }

        return $limit;
    }

    /** @param array<array-key,mixed> $payload */
    public static function check(array $payload): void
    {
        if (strlen(json_encode($payload, JSON_THROW_ON_ERROR)) > self::limit()) {
            throw ValidationException::withMessages(['preview' => ['Serialized preview exceeds the byte limit. Omit inline assets or reduce preview media.']]);
        }
    }
}
