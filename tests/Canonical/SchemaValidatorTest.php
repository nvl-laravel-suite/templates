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
}
