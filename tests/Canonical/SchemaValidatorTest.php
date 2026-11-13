<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Services\SchemaValidator;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;

final class SchemaValidatorTest extends TestCase
{
    private function numericNamesSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'nodes' => [
                    'type' => 'object',
                    'propertyNames' => ['$ref' => '#/$defs/id'],
                    'additionalProperties' => ['type' => 'string'],
                ],
            ],
            '$defs' => ['id' => ['type' => 'string', 'pattern' => '^[0-9]+$', 'enum' => ['0', '123']]],
        ];
    }

    public function test_json_property_names_remain_strings_for_numeric_nested_map_keys(): void
    {
        app(SchemaValidator::class)->validate(['nodes' => ['0' => 'Zero', '123' => 'One two three']], $this->numericNamesSchema());
        self::assertTrue(true);
    }

    public function test_numeric_names_still_obey_referenced_enumeration_constraints(): void
    {
        $this->expectException(ValidationException::class);
        app(SchemaValidator::class)->validate(['nodes' => ['456' => 'Disallowed']], $this->numericNamesSchema());
    }

    public function test_names_still_obey_referenced_pattern_constraints(): void
    {
        $schema = $this->numericNamesSchema();
        $schema['$defs']['id']['enum'][] = 'invalid';
        $this->expectException(ValidationException::class);
        app(SchemaValidator::class)->validate(['nodes' => ['invalid' => 'Disallowed']], $schema);
    }

    public function test_distinct_schemas_with_identical_root_id_remain_isolated_in_compiled_cache(): void
    {
        $validator = app(SchemaValidator::class);
        $first = [
            '$id' => 'https://schemas.example.test/document.json',
            'type' => 'object',
            'required' => ['code'],
            'properties' => ['code' => ['type' => 'string']],
            'additionalProperties' => false,
        ];
        $second = [
            '$id' => 'https://schemas.example.test/document.json',
            'type' => 'object',
            'required' => ['amount'],
            'properties' => ['amount' => ['type' => 'integer']],
            'additionalProperties' => false,
        ];

        $validator->validate(['code' => 'INV-1'], $first);
        $validator->validate(['amount' => 42], $second);

        try {
            $validator->validate(['code' => 'INV-1'], $second);
            self::fail('Expected the second schema to reject data matching only the first schema.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('data', $error->errors());
        }

        try {
            $validator->validate(['amount' => 42], $first);
            self::fail('Expected the first schema to remain enforced on subsequent validations.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('data', $error->errors());
        }
    }

    public function test_non_local_schema_references_are_rejected_across_repeated_calls(): void
    {
        $validator = app(SchemaValidator::class);
        $remoteSchema = [
            'type' => 'object',
            'properties' => ['item' => ['$ref' => 'https://schemas.example.test/external.json']],
        ];

        foreach ([1, 2] as $attempt) {
            try {
                $validator->validate(['item' => 'value'], $remoteSchema);
                self::fail('Expected external schema reference rejection on attempt '.$attempt.'.');
            } catch (ValidationException $error) {
                self::assertSame(['Only local schema references are supported.'], $error->errors()['schema'] ?? []);
            }
        }
    }

    public function test_null_const_escaped_pointer_refs_and_nullable_composite_types_compile_without_corruption(): void
    {
        $validator = app(SchemaValidator::class);
        $schema = [
            'type' => 'object',
            'required' => ['marker', 'meta', 'items'],
            'properties' => [
                'marker' => ['const' => null],
                'meta' => [
                    'type' => ['object', 'null'],
                    'properties' => ['tag' => ['$ref' => '#/$defs/slash~1tilde~0name']],
                ],
                'items' => [
                    'type' => ['array', 'null'],
                    'items' => ['type' => 'string'],
                ],
            ],
            '$defs' => [
                'slash/tilde~name' => ['type' => 'string', 'enum' => ['ok']],
            ],
        ];

        $validator->validate(['marker' => null, 'meta' => null, 'items' => null], $schema);
        $validator->validate(['marker' => null, 'meta' => ['tag' => 'ok'], 'items' => ['a']], $schema);

        $this->expectException(ValidationException::class);
        $validator->validate(['marker' => 'not-null', 'meta' => null, 'items' => null], $schema);
    }
}
