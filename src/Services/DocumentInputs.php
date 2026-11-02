<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Validation\ValidationException;

/**
 * Closed native service input schemas.
 *
 * @internal
 */
final class DocumentInputs
{
    /** @param array{key: string, name: string, groupId?: ?string} $data */
    public static function identity(array $data, bool $template = false): void
    {
        if (array_diff(array_keys($data), $template ? ['key', 'name', 'groupId'] : ['key', 'name'])) {
            throw ValidationException::withMessages(['data' => ['Unknown or protected template fields.']]);
        }
        foreach (['key', 'name'] as $key) {
            if (! is_string($data[$key] ?? null) || trim($data[$key]) === '' || strlen($data[$key]) > 191 || preg_match('/[\x00-\x1f\x7f]/', $data[$key])) {
                throw ValidationException::withMessages([$key => ['Use a nonempty bounded string.']]);
            }
        }
        if (isset($data['groupId']) && (! is_string($data['groupId']) || $data['groupId'] === '')) {
            throw ValidationException::withMessages(['groupId' => ['Use a family identity or null.']]);
        }
    }

    /** @param array{facts?: array<array-key,mixed>, context?: array<array-key,mixed>, inputs?: array<array-key,mixed>, settings?: array<array-key,mixed>} $data */
    public static function runtime(array $data): void
    {
        if (array_diff(array_keys($data), ['facts', 'context', 'inputs', 'settings'])) {
            throw ValidationException::withMessages(['data' => ['Unknown or protected render fields.']]);
        }
        foreach ($data as $key => $value) {
            if (! is_array($value)) {
                throw ValidationException::withMessages([$key => ['Runtime values must be arrays.']]);
            }
        }
    }

    /** Require an object-shaped decoded document field.
     * @return array<array-key,mixed>
     */
    public static function map(mixed $value, string $field): array
    {
        if (! is_array($value)) {
            throw ValidationException::withMessages([$field => ['A document object is required.']]);
        }

        return $value;
    }

    /** @return list<string> */
    public static function strings(mixed $value, string $field): array
    {
        if (! is_array($value) || ! array_is_list($value)) {
            throw ValidationException::withMessages([$field => ['An ordered string list is required.']]);
        }
        $strings = [];
        foreach ($value as $item) {
            if (! is_string($item)) {
                throw ValidationException::withMessages([$field => ['List entries must be strings.']]);
            }
            $strings[] = $item;
        }

        return $strings;
    }

    /** @return array<array-key,array<array-key,mixed>> */
    public static function maps(mixed $value, string $field): array
    {
        $items = self::map($value, $field);
        $maps = [];
        foreach ($items as $key => $item) {
            $maps[$key] = self::map($item, $field.'.'.$key);
        }

        return $maps;
    }

    public static function text(mixed $value, string $field): string
    {
        if (! is_string($value)) {
            throw ValidationException::withMessages([$field => ['A string value is required.']]);
        }

        return $value;
    }
}
