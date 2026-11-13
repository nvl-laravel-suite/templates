<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Support\JsonPropertyNamesSchemaParser;
use Nvl\Templates\Support\JsonWire;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Schema;
use Opis\JsonSchema\SchemaLoader;
use Opis\JsonSchema\Validator;

/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * @internal
 */
final class SchemaValidator
{
    private const int CachedSchemasLimit = 128;

    /** @var array<string, array{Validator, Schema}> */
    private static array $compiledSchemas = [];

    /** @param array<array-key,mixed> $schema */
    public function validate(mixed $data, array $schema, string $field = 'data'): void
    {
        $key = $this->cacheKey($schema);
        $entry = $key !== null ? (self::$compiledSchemas[$key] ?? null) : null;
        if ($entry === null) {
            $this->assertLocalSchema($schema);
            $loader = new SchemaLoader(new JsonPropertyNamesSchemaParser, null, false);
            $compiled = $loader->loadObjectSchema(JsonWire::schema($schema));
            $entry = [new Validator($loader), $compiled];
            if ($key !== null) {
                if (count(self::$compiledSchemas) >= self::CachedSchemasLimit) {
                    self::$compiledSchemas = [];
                }
                self::$compiledSchemas[$key] = $entry;
            }
        }

        [$validator, $compiledSchema] = $entry;
        $result = $validator->validate(JsonWire::value($data, $schema), $compiledSchema);

        if (! $result->isValid()) {
            $error = $result->error();
            if ($error === null) {
                throw ValidationException::withMessages([$field => ['The document schema could not be validated.']]);
            }
            $errors = (new ErrorFormatter)->format($error);
            throw ValidationException::withMessages([$field => [json_encode($errors, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]]);
        }
    }

    /** @param array<array-key,mixed> $schema */
    private function cacheKey(array $schema): ?string
    {
        try {
            return hash('xxh128', serialize($schema));
        } catch (\Throwable) {
            return null;
        }
    }

    /** @param array<array-key,mixed> $schema */
    private function assertLocalSchema(array $schema): void
    {
        foreach ($schema as $key => $value) {
            if (in_array($key, ['$ref', '$dynamicRef'], true) && (! is_string($value) || ! str_starts_with($value, '#'))) {
                throw ValidationException::withMessages(['schema' => ['Only local schema references are supported.']]);
            }
            if (is_array($value)) {
                $this->assertLocalSchema($value);
            }
        }
    }
}
