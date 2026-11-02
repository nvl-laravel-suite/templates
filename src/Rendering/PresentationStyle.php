<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use Illuminate\Validation\ValidationException;

final class PresentationStyle
{
    public static function format(string $property, mixed $value, string $unit = ''): string
    {
        if (! is_string($value) && ! is_int($value) && ! is_float($value)) {
            throw ValidationException::withMessages(['settings' => ['A presentation value must be a string or number.']]);
        }
        $raw = is_int($value) || is_float($value) || preg_match('/^-?(?:\d+(?:\.\d+)?|\.\d+)$/D', $value) ? (string) $value.$unit : $value;
        if (in_array($property, ['color', 'background-color'], true)) {
            $valid = (bool) preg_match('/^(#[a-f0-9]{3}(?:[a-f0-9]{3})?|transparent|currentColor)$/iD', $raw);
        } elseif ($property === 'text-align') {
            $valid = in_array($raw, ['left', 'right', 'center', 'justify'], true);
        } elseif ($property === 'font-weight') {
            $valid = (bool) preg_match('/^(normal|bold|bolder|lighter|[1-9]00)$/D', $raw);
        } elseif ($property === 'line-height') {
            $valid = $raw === 'normal' || (preg_match('/^(?:\d+(?:\.\d+)?|\.\d+)$/D', $raw) && (float) $raw <= 1000) || self::length($raw, false);
        } else {
            $parts = preg_split('/\\s+/', trim($raw));
            if ($parts === false) {
                throw ValidationException::withMessages(['settings' => ['The presentation value could not be parsed.']]);
            }
            $multiple = in_array($property, ['margin', 'padding', 'border-radius'], true);
            $valid = count($parts) <= ($multiple ? 4 : 1);
            foreach ($parts as $part) {
                $valid = $valid && (self::length($part, str_starts_with($property, 'margin')) || ($part === 'auto' && (str_starts_with($property, 'margin') || in_array($property, ['width', 'height'], true))));
            }
        }
        if (! $valid) {
            throw ValidationException::withMessages(['settings' => ['Unsupported typed CSS value for '.$property.'.']]);
        }

        return $raw;
    }

    private static function length(string $value, bool $negative): bool
    {
        if ($value === '0') {
            return true;
        }
        if (! preg_match('/^(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))(px|mm|pt|rem|%)$/D', $value, $m)) {
            return false;
        }

        return (float) $m[1] <= 1000 && (float) $m[1] >= ($negative ? -1000 : 0);
    }
}
