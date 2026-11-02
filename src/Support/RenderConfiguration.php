<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

final class RenderConfiguration
{
    public static function integer(string $key, int $min = 1, int $max = 31536000): int
    {
        $value = config('nvl-templates.rendering.'.$key);
        if (! is_int($value) || $value < $min || $value > $max) {
            throw new \LogicException('Invalid templates.rendering.'.$key.' configuration.');
        }

        return $value;
    }

    public static function backoff(int $attempt): int
    {
        $values = config('nvl-templates.rendering.backoff');
        if (! is_array($values) || ! array_is_list($values) || $values === []) {
            throw new \LogicException('Configure a bounded render retry backoff list.');
        }
        foreach ($values as $value) {
            if (! is_int($value) || $value < 1 || $value > 86400) {
                throw new \LogicException('Invalid render retry backoff.');
            }
        }

        return $values[min(max(0, $attempt - 1), count($values) - 1)];
    }
}
