<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Validation\ValidationException;

/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * @internal
 */
final class RuntimeDataResolver
{
    public function __construct(private SchemaValidator $schemas) {}

    /** @param array<array-key,mixed> $document
     * @param  array<array-key,mixed>  $facts
     * @param  array<array-key,mixed>  $context
     * @param  array<array-key,mixed>  $inputs
     * @param  array<array-key,mixed>  $settings
     * @return array<array-key,mixed>
     */
    public function resolve(array $document, array $facts, array $context, array $inputs, array $settings, bool $preparing = false): array
    {
        $data = ['facts' => $facts, 'context' => $context, 'content' => $document['content'] ?? [],
            'inputs' => $this->patch(DocumentInputs::map($document['inputDefaults'] ?? [], 'inputDefaults'), $inputs, DocumentInputs::strings($document['exposedInputs'] ?? [], 'exposedInputs'), 'inputs'),
            'settings' => $this->patch(DocumentInputs::map($document['settingsDefaults'] ?? [], 'settingsDefaults'), $settings, DocumentInputs::strings($document['exposedSettings'] ?? [], 'exposedSettings'), 'settings')];
        $schema = DocumentInputs::map($document['dataSchema'] ?? null, 'dataSchema');
        if ($preparing) {
            // A published contract already proves hidden defaults are satisfiable.
            // Preparation opens an editor before the customer fills required values.
            $properties = DocumentInputs::map($schema['properties'] ?? [], 'dataSchema.properties');
            foreach (['inputs', 'settings'] as $namespace) {
                $properties[$namespace] = $this->partialCustomerSchema(DocumentInputs::map($properties[$namespace] ?? [], 'dataSchema.properties.'.$namespace));
            }
            $schema['properties'] = $properties;
        }
        $this->schemas->validate($data, $schema);

        return $data;
    }

    /** @param array<array-key,mixed> $schema
     * @return array<array-key,mixed>
     */
    private function partialCustomerSchema(array $schema): array
    {
        if (($schema['type'] ?? null) === 'object') {
            unset($schema['required']);
            $properties = DocumentInputs::map($schema['properties'] ?? [], 'schema.properties');
            foreach ($properties as $key => $child) {
                $properties[$key] = $this->partialCustomerSchema(DocumentInputs::map($child, 'schema.properties.'.$key));
            }
            $schema['properties'] = $properties;
        }
        if (($schema['type'] ?? null) === 'array' && is_array($schema['items'] ?? null)) {
            $schema['items'] = $this->partialCustomerSchema(DocumentInputs::map($schema['items'], 'schema.items'));
        }

        return $schema;
    }

    /** @param array<array-key,mixed> $base
     * @param  array<array-key,mixed>  $values
     * @param  list<string>  $allowed
     * @return array<array-key,mixed>
     */
    private function patch(array $base, array $values, array $allowed, string $namespace, string $prefix = ''): array
    {
        foreach ($values as $key => $value) {
            $path = $prefix === '' ? (string) $key : $prefix.'.'.$key;
            if (! preg_match('/^[a-zA-Z][a-zA-Z0-9_]*$/D', (string) $key) || in_array($key, ['__proto__', 'constructor', 'prototype'], true)) {
                throw ValidationException::withMessages([$namespace => ['Invalid input path.']]);
            }
            if (in_array($path, $allowed, true)) {
                $base[$key] = $value;

                continue;
            }
            if (is_array($value) && array_filter($allowed, fn ($id) => str_starts_with($id, $path.'.'))) {
                $base[$key] = $this->patch(is_array($base[$key] ?? null) ? DocumentInputs::map($base[$key], $namespace) : [], DocumentInputs::map($value, $namespace), $allowed, $namespace, $path);

                continue;
            }
            throw ValidationException::withMessages([$namespace => ['Only selected '.$namespace.' may be changed.']]);
        }

        return $base;
    }
}
