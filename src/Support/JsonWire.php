<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

/** Restore schema-declared JSON objects after Laravel's associative JSON decoding. */
final class JsonWire
{
    /** @param array<array-key,mixed> $document
     * @param  array<array-key,mixed>|null  $family
     * @return array<array-key,mixed>
     */
    public static function document(array $document, ?array $family = null): array
    {
        $source = self::map($document['source'] ?? []);
        $familySource = self::map($family['source'] ?? []);
        $familyDefinition = self::map($familySource['definition'] ?? []);
        $familyProperties = self::map(self::map($family['dataSchema'] ?? [])['properties'] ?? []);
        if (($source['mode'] ?? null) === 'group-variant') {
            $overrides = self::map($source['overrides'] ?? []);
            foreach (['content' => 'content', 'settingsDefaults' => 'settings'] as $key => $namespace) {
                if (array_key_exists($key, $overrides)) {
                    $overrides[$key] = self::value($overrides[$key], self::map($familyProperties[$namespace] ?? ['type' => 'object']));
                }
            }
            if (isset($overrides['variations'])) {
                $definitionSchema = self::definitionSchema();
                $nodesSchema = self::map(self::map($definitionSchema['properties'] ?? [])['nodes'] ?? []);
                $nodeSchema = self::map($nodesSchema['additionalProperties'] ?? []);
                $variations = self::map($overrides['variations']);
                foreach ($variations as $id => $rawPatch) {
                    $patch = self::map($rawPatch);
                    $originalPatch = $patch;
                    if (isset($patch['node'])) {
                        $patch['node'] = self::value($patch['node'], $nodeSchema, $definitionSchema);
                    }
                    if (isset($patch['nodes'])) {
                        $patch['nodes'] = self::value($patch['nodes'], $nodesSchema, $definitionSchema);
                    }
                    if ($family && isset($originalPatch['nodes'])) {
                        self::blockLiterals(self::map($originalPatch['nodes']), self::object($patch['nodes']), $familyDefinition);
                    }
                    if ($family && isset($originalPatch['node'])) {
                        $node = self::map($originalPatch['node']);
                        $nodeId = $node['id'] ?? null;
                        if (! is_string($nodeId)) {
                            throw new \InvalidArgumentException('Fragment nodes require string identities.');
                        }
                        self::blockLiterals([$nodeId => $node], (object) [$nodeId => $patch['node']], $familyDefinition);
                    }
                    $binding = is_array($patch['value'] ?? null) ? $patch['value'] : [];
                    if (($patch['kind'] ?? null) === 'block-property' && ($binding['source'] ?? null) === 'literal' && $family) {
                        foreach (self::map($family['variationPoints'] ?? []) as $rawPoint) {
                            $point = self::map($rawPoint);
                            if (($point['id'] ?? null) === $id && ($point['kind'] ?? null) === 'block-property') {
                                $nodeId = $point['nodeId'] ?? null;
                                $property = $point['property'] ?? null;
                                if (! is_string($nodeId) || ! is_string($property)) {
                                    throw new \InvalidArgumentException('Block variation points require a node and property identity.');
                                }
                                $node = self::map(self::map($familyDefinition['nodes'] ?? [])[$nodeId] ?? []);
                                $schema = self::blockPropertySchema($familyDefinition, $node, $property);
                                if ($schema !== null) {
                                    $binding['value'] = self::value($binding['value'] ?? null, $schema);
                                    $patch['value'] = $binding;
                                }
                            }
                        }
                    }
                    $variations[$id] = $patch;
                }
                $overrides['variations'] = (object) $variations;
            }
            $source['overrides'] = (object) $overrides;
            $document['source'] = $source;
        }
        if (isset($source['definition'])) {
            $original = self::map($source['definition']);
            $definition = self::object(self::value($original, self::definitionSchema()));
            foreach (self::map($original['fields'] ?? []) as $index => $rawField) {
                $field = self::map($rawField);
                foreach (['defaultValue', 'sample'] as $key) {
                    if (array_key_exists($key, $field)) {
                        $fields = self::map($definition->fields);
                        self::object($fields[$index])->{$key} = self::value($field[$key], self::map($field['schema'] ?? []));
                    }
                }
            }
            if (isset($original['nodes'], $definition->nodes)) {
                self::blockLiterals(self::map($original['nodes']), self::object($definition->nodes), $original);
            }
            foreach (self::map($original['blocks'] ?? []) as $index => $rawBlock) {
                $block = self::map($rawBlock);
                $blocks = self::map($definition->blocks);
                $wireBlock = self::object($blocks[$index]);
                self::blockLiterals(self::map($block['nodes'] ?? []), self::object($wireBlock->nodes), $original);
                $props = self::map($block['props'] ?? []);
                foreach (self::map($block['propertyMetadata'] ?? []) as $name => $rawMetadata) {
                    $metadata = self::map($rawMetadata);
                    if (array_key_exists('defaultValue', $metadata) && isset($props[$name])) {
                        $wireMetadata = self::object($wireBlock->propertyMetadata);
                        self::object($wireMetadata->{$name})->defaultValue = self::value($metadata['defaultValue'], self::map($props[$name]));
                    }
                }
            }
            $source['definition'] = $definition;
            $document['source'] = $source;
        }
        if (isset($document['dataSchema'])) {
            $schema = self::map($document['dataSchema']);
            $properties = self::map($schema['properties'] ?? []);
            foreach (['content' => 'content', 'inputDefaults' => 'inputs', 'settingsDefaults' => 'settings'] as $key => $namespace) {
                if (isset($document[$key])) {
                    $document[$key] = self::value($document[$key], self::map($properties[$namespace] ?? ['type' => 'object']));
                }
            }
            $document['dataSchema'] = self::schema($schema);
        }
        if (isset($document['managedAssets'])) {
            $document['managedAssets'] = (object) self::map($document['managedAssets']);
        }
        if (isset($document['settingsSpec'])) {
            $settings = self::map($document['settingsSpec']);
            foreach ($settings as $index => $rawSpec) {
                $spec = self::map($rawSpec);
                $schema = self::map($spec['schema'] ?? []);
                $spec['schema'] = self::schema($schema);
                if (array_key_exists('defaultValue', $spec)) {
                    $spec['defaultValue'] = self::value($spec['defaultValue'], $schema);
                }
                $settings[$index] = $spec;
            }
            $document['settingsSpec'] = $settings;
        }
        if (isset($document['variationPoints'])) {
            $points = self::map($document['variationPoints']);
            foreach ($points as $index => $rawPoint) {
                $point = self::map($rawPoint);
                if (isset($point['schema'])) {
                    $point['schema'] = self::schema(self::map($point['schema']));
                }
                $points[$index] = $point;
            }
            $document['variationPoints'] = $points;
        }

        return $document;
    }

    /** @param array<array-key,mixed> $definition
     * @param array<array-key,mixed> $node
     * @return array<array-key,mixed>|null */
    private static function blockPropertySchema(array $definition, array $node, string $name): ?array
    {
        foreach (self::map($definition['blocks'] ?? []) as $rawBlock) {
            $block = self::map($rawBlock);
            if (($node['kind'] ?? null) === 'block' && ($block['id'] ?? null) === ($node['blockId'] ?? null) && ($block['version'] ?? null) === ($node['version'] ?? null)) {
                $props = self::map($block['props'] ?? []);

                return isset($props[$name]) ? self::map($props[$name]) : null;
            }
        }

        return null;
    }

    /** @param array<array-key,mixed> $nodes
     * @param array<array-key,mixed> $definition */
    private static function blockLiterals(array $nodes, \stdClass $wire, array $definition): void
    {
        foreach ($nodes as $id => $rawNode) {
            $node = self::map($rawNode);
            if (($node['kind'] ?? null) !== 'block') {
                continue;
            }
            foreach (self::map($node['props'] ?? []) as $name => $rawValue) {
                $value = self::map($rawValue);
                $schema = self::blockPropertySchema($definition, $node, (string) $name);
                if ($schema && ($value['source'] ?? null) === 'literal') {
                    $wireNode = self::object($wire->{$id});
                    $wireProps = self::object($wireNode->props);
                    self::object($wireProps->{$name})->value = self::value($value['value'] ?? null, $schema);
                }
            }
        }
    }

    /** @param array<array-key,mixed> $document */
    public static function resource(array $document): mixed
    {
        if (($document['format'] ?? null) === 'gct-template') {
            $wire = self::document(['source' => ['definition' => $document]]);

            return self::map($wire['source'])['definition'];
        }
        if (($document['format'] ?? null) === 'template-document' || isset($document['settingsSpec'])) {
            return self::document($document);
        }
        if (isset($document['library']) && is_array($document['library'])) {
            $document['library'] = self::resource($document['library']);
            if (isset($document['managedAssets'])) {
                $document['managedAssets'] = (object) $document['managedAssets'];
            }

            return $document;
        }
        $name = match ($document['format'] ?? null) {
            'gct-template-block-library' => 'template-block-library.v1', default => null
        };
        if ($name !== null) {
            return self::value($document, self::readSchema($name));
        }

        return $document === [] ? (object) [] : $document;
    }

    /** @return array<array-key,mixed> */
    private static function definitionSchema(): array
    {
        return self::readSchema('template-definition.v1');
    }

    /** @var array<string, array<array-key,mixed>> */
    private static array $cachedSchemas = [];

    /** Read only bundled, source-controlled contracts.
     * @return array<array-key,mixed>
     */
    private static function readSchema(string $name): array
    {
        if (isset(self::$cachedSchemas[$name])) {
            return self::$cachedSchemas[$name];
        }

        $json = file_get_contents(__DIR__.'/../../resources/contracts/'.$name.'.schema.json');
        if ($json === false) {
            throw new \RuntimeException('The bundled JSON schema is unavailable.');
        }

        return self::$cachedSchemas[$name] = self::map(json_decode($json, true, 64, JSON_THROW_ON_ERROR));
    }

    private static function object(mixed $value): \stdClass
    {
        if (! $value instanceof \stdClass) {
            throw new \InvalidArgumentException('Expected a JSON wire object.');
        }

        return $value;
    }

    /** @param array<array-key,mixed> $schema */
    public static function schema(array $schema): object
    {
        $walk = function (mixed $value, ?string $key = null) use (&$walk): mixed {
            if (! is_array($value)) {
                return $value;
            }
            $mapped = [];
            foreach ($value as $k => $v) {
                $mapped[$k] = $walk($v, is_string($k) ? $k : null);
            }

            return ! array_is_list($value) || in_array($key, ['properties', '$defs', 'patternProperties', 'dependentSchemas'], true) ? (object) $mapped : $mapped;
        };

        return (object) $walk($schema);
    }

    /** @param array<array-key,mixed> $schema
     * @param array<array-key,mixed>|null $root */
    public static function value(mixed $value, array $schema, ?array $root = null, int $depth = 0): mixed
    {
        if ($depth > 64) {
            throw new \InvalidArgumentException('JSON schema nesting exceeds the limit.');
        }
        $root ??= $schema;
        if (isset($schema['$ref'])) {
            $ref = $schema['$ref'];
            if (! is_string($ref)) {
                throw new \InvalidArgumentException('Schema references must be strings.');
            }
            if (! str_starts_with($ref, '#/')) {
                throw new \InvalidArgumentException('Only local schema references are supported.');
            }
            $resolved = $root;
            foreach (explode('/', substr($ref, 2)) as $part) {
                $resolved = self::map($resolved[str_replace(['~1', '~0'], ['/', '~'], $part)] ?? []);
            }

            return self::value($value, $resolved, $root, $depth + 1);
        }
        foreach (self::map($schema['anyOf'] ?? $schema['oneOf'] ?? []) as $branch) {
            $branch = self::map($branch);
            $candidate = $branch;
            if (isset($candidate['$ref'])) {
                $candidate = $root;
                $reference = $branch['$ref'];
                if (! is_string($reference) || ! str_starts_with($reference, '#/')) {
                    throw new \InvalidArgumentException('Schema references must be local JSON pointers.');
                }
                foreach (explode('/', substr($reference, 2)) as $part) {
                    $key = str_replace(['~1', '~0'], ['/', '~'], $part);
                    $candidate = self::map($candidate[$key] ?? []);
                }
            }
            $matches = true;
            foreach (self::map($candidate['properties'] ?? []) as $key => $property) {
                $property = self::map($property);
                if (! is_array($value) || ! array_key_exists($key, $value)) {
                    if (in_array($key, self::map($candidate['required'] ?? []), true) && (array_key_exists('const', $property) || isset($property['enum']))) {
                        $matches = false;
                        break;
                    }

                    continue;
                }
                if (array_key_exists('const', $property) && (($value[$key] ?? null) !== $property['const'])) {
                    $matches = false;
                    break;
                }
                if (isset($property['enum']) && (! in_array($value[$key] ?? null, self::map($property['enum']), true))) {
                    $matches = false;
                    break;
                }
            }
            $matches = $matches && self::matchesSchemaType($candidate['type'] ?? null, $value);
            if ($matches) {
                return self::value($value, $branch, $root, $depth + 1);
            }
        }
        if (! is_array($value)) {
            return $value;
        }
        $schemaTypes = is_array($schema['type'] ?? null) ? $schema['type'] : [$schema['type'] ?? null];
        if (in_array('object', $schemaTypes, true) && (! in_array('array', $schemaTypes, true) || ! array_is_list($value) || $value === [])) {
            $result = new \stdClass;
            foreach ($value as $key => $item) {
                $properties = self::map($schema['properties'] ?? []);
                $child = self::map($properties[$key] ?? (is_array($schema['additionalProperties'] ?? null) ? $schema['additionalProperties'] : []));
                $result->{$key} = self::value($item, $child, $root, $depth + 1);
            }

            return $result;
        }
        if (in_array('array', $schemaTypes, true) && array_is_list($value)) {
            return array_map(fn ($item) => self::value($item, self::map($schema['items'] ?? []), $root, $depth + 1), $value);
        }

        return $value;
    }

    private static function matchesSchemaType(mixed $type, mixed $value): bool
    {
        if (is_array($type)) {
            foreach ($type as $candidateType) {
                if (is_string($candidateType) && self::matchesSchemaType($candidateType, $value)) {
                    return true;
                }
            }

            return false;
        }

        return match ($type) {
            'object' => is_array($value) && (! array_is_list($value) || $value === []),
            'array' => is_array($value) && array_is_list($value),
            'string' => is_string($value),
            'number' => is_int($value) || is_float($value),
            'integer' => is_int($value),
            'boolean' => is_bool($value),
            'null' => $value === null,
            default => true,
        };
    }

    /** Require a decoded JSON container without claiming any type for its values.
     * @return array<array-key,mixed>
     */
    private static function map(mixed $value): array
    {
        if (! is_array($value)) {
            throw new \InvalidArgumentException('Expected a decoded JSON container.');
        }

        return $value;
    }
}
