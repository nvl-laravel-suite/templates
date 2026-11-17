<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

use Illuminate\Validation\ValidationException;

/**
 * Reject a revision, version or generation that the portable 32-bit integer columns cannot hold, before any query.
 */
final class StoredInteger
{
    public const int Maximum = 2147483647;

    public static function assert(string $field, mixed $value, int $minimum = 0): int
    {
        if (! is_int($value) || $value < $minimum || $value > self::Maximum) {
            throw ValidationException::withMessages([$field => ["Use an integer between {$minimum} and ".self::Maximum.'.']]);
        }

        return $value;
    }
}
