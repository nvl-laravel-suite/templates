<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

final class CanonicalJson
{
    /** @param array<array-key,mixed> $value */
    public static function hash(array $value): string
    {
        $sort = function (mixed $v) use (&$sort): mixed {
            if (! is_array($v)) {
                return $v;
            }
            if (! array_is_list($v)) {
                ksort($v, SORT_STRING);
            }

            return array_map($sort, $v);
        };

        return hash('sha256', json_encode($sort($value), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION));
    }
}
