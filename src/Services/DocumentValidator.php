<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Rendering\BindingManifestValidator;
use Nvl\Templates\Rendering\EmailProfile;
use Nvl\Templates\Rendering\PresentationStyle;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Support\Capabilities;
use Nvl\Templates\Support\Compiler;

/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * The node/definition shapes below describe the bundled definition schema after validation.
 * JSON schema keywords and literal binding values remain open, heterogeneous JSON values.
 *
 * @phpstan-type JsonSchema array<array-key,mixed>
 * @phpstan-type Binding array{source:'literal',value:mixed}|array{source:'field',fieldId:string}|array{source:'item',path:string}|array{source:'prop',name:string}|array{source:'asset',assetId:string}
 * @phpstan-type TextPart array{value:Binding,format:string,currency?:string}
 * @phpstan-type ElementNode array{id:string,name:string,kind:'element',tag:string,children:list<string>,style:array<string,string>,attributes:array<string,string>,attributeBindings:array<string,Binding>}
 * @phpstan-type TextNode array{id:string,name:string,kind:'text',parts:list<TextPart>}
 * @phpstan-type RepeatNode array{id:string,name:string,kind:'repeat',binding:Binding,children:list<string>}
 * @phpstan-type ConditionNode array{id:string,name:string,kind:'condition',binding:Binding,operator:string,value?:mixed,children:list<string>}
 * @phpstan-type BlockNode array{id:string,name:string,kind:'block',blockId:string,version:int,props:array<string,Binding>,slots:array<string,list<string>>}
 * @phpstan-type SlotNode array{id:string,name:string,kind:'slot',slot:string,children:list<string>}
 * @phpstan-type Node ElementNode|TextNode|RepeatNode|ConditionNode|BlockNode|SlotNode
 * @phpstan-type Field array{id:string,schema:JsonSchema}
 * @phpstan-type DefinitionBlock array{id:string,version:int,props:array<string,JsonSchema>,requiredProps:list<string>,propertyMetadata?:array<string,array{defaultValue?:mixed}>,nodes:array<array-key,Node>,roots:list<string>}
 * @phpstan-type Definition array{nodes:array<array-key,Node>,roots:list<string>,fields:list<Field>,assets:list<array{id:string,url:string}>,blocks:list<DefinitionBlock>,styles:array{css:string,theme:string}}
 *
 * @internal
 */
final class DocumentValidator
{
    public function __construct(private SchemaValidator $schemas, private BindingManifestValidator $manifest) {}

    /** @param array<array-key,mixed> $document */
    public function draft(array $document): void
    {
        if (strlen(json_encode($document, JSON_THROW_ON_ERROR)) > config('nvl-templates.limits.document_bytes')) {
            $this->fail('document', 'Document exceeds the configured byte limit.');
        }
        if (($document['format'] ?? null) !== 'template-document' || ($document['schemaVersion'] ?? null) !== 1 || ! in_array($document['target'] ?? null, ['email', 'document'], true)) {
            $this->fail('document', 'Unsupported template document format, version or target.');
        }
        if (! is_array($document['source'] ?? null) || ! in_array($document['source']['mode'] ?? null, ['standalone', 'group-variant'], true)) {
            $this->fail('source', 'Choose a standalone or group-variant source.');
        }
    }

    /** @param array<array-key,mixed> $document */
    public function publication(array $document): void
    {
        $this->draft($document);
        $target = $this->string($document['target'], 'target');
        $source = $this->map($document['source'] ?? [], 'source');
        if (! isset($source['definition'], $document['dataSchema'], $document['artifacts'])) {
            $this->fail('document', 'A complete definition, data schema and artifact are required.');
        }
        $definition = $this->map($source['definition'], 'source.definition');
        $dataSchema = $this->map($document['dataSchema'], 'dataSchema');
        $runtimeSchemas = $this->map($dataSchema['properties'] ?? [], 'dataSchema.properties');
        $artifacts = $this->map($document['artifacts'], 'artifacts');
        if (isset($document['compilerVersion']) && ! in_array($document['compilerVersion'], $this->strings(Capabilities::document()['compilerVersions'], 'compilerVersions'), true)) {
            $this->fail('compilerVersion', 'The required compiler version is unsupported.');
        }
        if (isset($document['rendering']) && ($this->map($document['rendering'], 'rendering')['engine'] ?? null) !== ($artifacts['engine'] ?? 'bindings')) {
            $this->fail('rendering.engine', 'The authored engine must match the compiled artifact.');
        }
        $definitionJson = file_get_contents(__DIR__.'/../../resources/contracts/template-definition.v1.schema.json');
        if ($definitionJson === false) {
            throw new \RuntimeException('The bundled definition schema is unavailable.');
        }
        $definitionSchema = $this->map(json_decode($definitionJson, true, 64, JSON_THROW_ON_ERROR), 'schema');
        $this->schemas->validate($definition, $definitionSchema, 'source.definition');
        foreach (['Inputs' => 'inputs', 'Settings' => 'settings'] as $suffix => $namespace) {
            $properties = $this->map($this->map($runtimeSchemas[$namespace] ?? [], 'dataSchema')['properties'] ?? [], 'dataSchema.properties');
            foreach ($this->map($document['exposed'.$suffix] ?? [], 'exposed'.$suffix) as $id) {
                if (! is_string($id) || ! $this->declaredPath($properties, $id)) {
                    $this->fail('exposed'.$suffix, 'Exposed controls must reference declared '.$namespace.'.');
                }
            }
            foreach ($this->map($document[$namespace === 'inputs' ? 'inputDefaults' : 'settingsDefaults'] ?? [], $namespace) as $id => $value) {
                if (! isset($properties[$id])) {
                    $this->fail($namespace, 'A default references an undeclared property.');
                }
                $this->schemas->validate($value, $this->partialDefaultsSchema($this->map($properties[$id], 'dataSchema')), $namespace.'.'.$id);
            }
        }
        $this->schemas->validate($document['content'] ?? [], $this->map($runtimeSchemas['content'] ?? ['type' => 'object'], 'dataSchema.content'), 'content');
        foreach (['inputs' => 'inputDefaults', 'settings' => 'settingsDefaults'] as $namespace => $defaults) {
            $this->requiredDefaults($this->map($runtimeSchemas[$namespace] ?? [], 'dataSchema'), $this->map($document[$defaults] ?? [], $defaults), $this->strings($document[$namespace === 'inputs' ? 'exposedInputs' : 'exposedSettings'] ?? [], 'exposed'));
        }
        if (array_key_exists('settingsSpec', $document)) {
            $this->settingsSpec($document);
        }
        $data = ['content' => $document['content'] ?? [], 'inputs' => $document['inputDefaults'] ?? [], 'settings' => $document['settingsDefaults'] ?? []];
        foreach ($this->map($artifacts['bindings'] ?? [], 'bindings') as $rawBinding) {
            $binding = $this->map($rawBinding, 'bindings');
            if (! is_string($binding['path'] ?? null) || ! $this->declaredPath($runtimeSchemas, $binding['path'])) {
                $this->fail('bindings', 'A binding references an undeclared data path.');
            }
            $path = $binding['path'];
            if (! Arr::has($data, $path) && ! $this->runtimeSupply($document, $path)) {
                $this->fail('bindings', 'A hidden binding needs a published value: '.$path.'.');
            }
            if ($binding['kind'] === 'image' && Arr::has($data, $path)) {
                $this->validateAsset(Arr::get($data, $path), $target);
            }
            if ($binding['kind'] === 'style' && Arr::has($data, $path)) {
                PresentationStyle::format($this->string($binding['property'] ?? null, 'bindings.property'), Arr::get($data, $path), $this->string($binding['unit'] ?? '', 'bindings.unit'));
            }
        }
        foreach ($this->map($document['managedAssets'] ?? [], 'managedAssets') as $id) {
            $this->validateAsset($id, $target);
        }
        $engine = $artifacts['engine'] ?? 'bindings';
        if ($document['target'] === 'email') {
            app(EmailProfile::class)->source($document);
            if ($engine === 'bindings') {
                app(EmailProfile::class)->artifact($this->string($artifacts['html'] ?? '', 'artifacts.html'), $this->string($artifacts['css'] ?? '', 'artifacts.css'));
            }
        }
        if ($engine === 'bindings') {
            $this->manifest->validate($artifacts);
        } elseif ($engine !== 'shared' || Compiler::configured() === null) {
            $this->fail('artifacts.engine', 'The required compiler is unavailable.');
        }
        if ($engine === 'shared') {
            $this->managedSource($document);
        }
    }

    /** @param array<array-key,mixed> $schema
     * @return array<array-key,mixed> */
    private function partialDefaultsSchema(array $schema): array
    {
        unset($schema['required']);
        if (isset($schema['properties'])) {
            $properties = $this->map($schema['properties'], 'schema.properties');
            foreach ($properties as $key => $child) {
                $properties[$key] = $this->partialDefaultsSchema($this->map($child, 'schema'));
            }
            $schema['properties'] = $properties;
        }
        if (is_array($schema['items'] ?? null)) {
            $schema['items'] = $this->partialDefaultsSchema($schema['items']);
        }

        return $schema;
    }

    /** @param array<array-key,mixed> $document */
    private function runtimeSupply(array $document, string $path): bool
    {
        [$namespace, $localPath] = explode('.', $path, 2);
        if (in_array($namespace, ['facts', 'context'], true)) {
            return true;
        }
        $exposed = match ($namespace) {
            'inputs' => $document['exposedInputs'] ?? [],
            'settings' => $document['exposedSettings'] ?? [],
            default => [],
        };
        foreach ($this->strings($exposed, 'exposed') as $allowed) {
            if ($allowed === $localPath || str_starts_with($localPath, $allowed.'.')) {
                return true;
            }
        }

        return false;
    }

    /** @param array<array-key,mixed> $document */
    private function settingsSpec(array $document): void
    {
        if (! is_array($document['settingsSpec']) || ! array_is_list($document['settingsSpec'])) {
            $this->fail('settingsSpec', 'Settings controls must be an ordered list.');
        }
        $dataSchema = $this->map($document['dataSchema'], 'dataSchema');
        $runtimeSchemas = $this->map($dataSchema['properties'] ?? [], 'dataSchema.properties');
        $properties = $this->map($this->map($runtimeSchemas['settings'] ?? [], 'dataSchema.settings')['properties'] ?? [], 'dataSchema.settings.properties');
        $source = $this->map($document['source'], 'source');
        $definition = $this->map($source['definition'] ?? [], 'source.definition');
        $nodes = $this->map($definition['nodes'] ?? [], 'source.definition.nodes');
        $defaults = $this->map($document['settingsDefaults'] ?? [], 'settingsDefaults');
        $byId = [];
        foreach ($document['settingsSpec'] as $rawSetting) {
            $setting = $this->map($rawSetting, 'settingsSpec');
            $id = $setting['id'] ?? null;
            if (! is_string($id) || ! preg_match('/^[a-zA-Z][a-zA-Z0-9_]*$/D', $id) || in_array($id, ['__proto__', 'constructor', 'prototype'], true) || isset($byId[$id])) {
                $this->fail('settingsSpec', 'Setting IDs must be safe and unique.');
            }
            if (! is_array($setting['schema'] ?? null) || ! isset($properties[$id]) || CanonicalJson::hash($setting['schema']) !== CanonicalJson::hash($this->map($properties[$id], 'dataSchema.settings'))) {
                $this->fail('settingsSpec', 'A setting must match its declared data schema: '.$id.'.');
            }
            if (! array_key_exists('defaultValue', $setting) || ! is_bool($setting['exposed'] ?? null)) {
                $this->fail('settingsSpec', 'A setting needs a default and an explicit exposure ceiling.');
            }
            $this->schemas->validate($setting['defaultValue'], $setting['schema'], 'settingsSpec.'.$id);
            $unit = $setting['unit'] ?? '';
            if (! in_array($unit, ['', 'px', 'mm', 'pt', '%', 'rem'], true) || ! is_array($setting['targets'] ?? null) || ! array_is_list($setting['targets']) || $setting['targets'] === []) {
                $this->fail('settingsSpec', 'A setting needs supported units and explicit presentation targets.');
            }
            foreach ($setting['targets'] as $rawTarget) {
                $target = $this->map($rawTarget, 'settingsSpec.targets');
                $nodeId = $target['nodeId'] ?? null;
                $property = $target['property'] ?? null;
                if (! is_string($nodeId) || ($this->map($nodes[$nodeId] ?? [], 'source.definition.nodes')['kind'] ?? null) !== 'element' || ! is_string($property) || ! in_array($property, BindingManifestValidator::STYLES, true)) {
                    $this->fail('settingsSpec', 'Settings must target a supported property on a root element.');
                }
                $this->presentationValue($property, $setting['defaultValue'], $unit);
                if (array_key_exists($id, $defaults)) {
                    $this->presentationValue($property, $defaults[$id], $unit);
                }
            }
            $byId[$id] = $setting;
        }
        foreach ($this->strings($document['exposedSettings'] ?? [], 'exposedSettings') as $id) {
            if (! ($byId[$id]['exposed'] ?? false)) {
                $this->fail('exposedSettings', 'Selected settings must remain within the declared control ceiling.');
            }
        }
    }

    private function presentationValue(string $property, mixed $value, string $unit): void
    {
        if (! is_string($value) && ! is_int($value) && ! is_float($value)) {
            $this->fail('settingsSpec', 'Presentation settings must resolve to scalar CSS values.');
        }
        PresentationStyle::format($property, $value, $unit);
    }

    private function validateAsset(mixed $id, string $target): void
    {
        if (! is_string($id)) {
            $this->fail('assets', 'A managed asset identity is required.');
        }
        try {
            app(AssetManager::class)->resolve($id, $target, embedEmail: false);
        } catch (ModelNotFoundException) {
            $this->fail('assets', 'A selected managed asset is unavailable in this scope.');
        }
    }

    /** @param array<array-key,mixed> $schema
     * @param array<array-key,mixed> $defaults
     * @param list<string> $exposed */
    private function requiredDefaults(array $schema, array $defaults, array $exposed, string $prefix = ''): void
    {
        if (($schema['type'] ?? null) === 'array') {
            foreach ($defaults as $index => $value) {
                if (is_array($value)) {
                    $this->requiredDefaults($this->map($schema['items'] ?? [], 'schema.items'), $value, $exposed, $prefix.'.'.$index);
                }
            }

            return;
        }
        $properties = $this->map($schema['properties'] ?? [], 'schema.properties');
        foreach ($this->strings($schema['required'] ?? [], 'schema.required') as $key) {
            $path = $prefix === '' ? $key : $prefix.'.'.$key;
            $canSupply = array_filter($exposed, fn ($allowed) => $path === $allowed || str_starts_with($path, $allowed.'.'));
            if (! array_key_exists($key, $defaults) && ! $canSupply) {
                $child = $this->map($properties[$key] ?? [], 'schema');
                if (($child['type'] ?? null) === 'object' && array_filter($exposed, fn ($allowed) => str_starts_with($allowed, $path.'.'))) {
                    $this->requiredDefaults($child, [], $exposed, $path);
                } else {
                    $this->fail('defaults', 'Required hidden value '.$path.' needs a published default.');
                }
            }
        }
        foreach ($defaults as $key => $value) {
            if (is_array($value) && in_array($this->map($properties[$key] ?? [], 'schema')['type'] ?? null, ['object', 'array'], true)) {
                $this->requiredDefaults($this->map($properties[$key], 'schema'), $value, $exposed, $prefix === '' ? $key : $prefix.'.'.$key);
            }
        }
    }

    /** @param array<array-key,mixed> $document */
    private function managedSource(array $document): void
    {
        $source = $this->map($this->map($document['source'], 'source')['definition'], 'source.definition');
        $styles = $this->map($source['styles'] ?? [], 'source.definition.styles');
        if (preg_match('/url\s*\(/i', $this->string($styles['css'] ?? '', 'styles.css').$this->string($styles['theme'] ?? '', 'styles.theme'))) {
            $this->fail('assets', 'CSS media requires a qualified managed adapter.');
        }
        foreach (array_merge([$source['nodes']], array_column($this->map($source['blocks'] ?? [], 'blocks'), 'nodes')) as $rawNodes) {
            foreach ($this->map($rawNodes, 'nodes') as $rawNode) {
                $node = $this->map($rawNode, 'node');
                if (($node['kind'] ?? null) !== 'element') {
                    continue;
                }
                if (array_intersect(array_map(static fn (string|int $name): string => strtolower((string) $name), array_keys($this->map($node['attributes'] ?? [], 'attributes'))), ['src', 'srcset', 'background', 'poster', 'xlink:href'])) {
                    $this->fail('assets', 'Static fetch sources must use managed asset bindings.');
                }
                if (isset($this->map($node['attributeBindings'] ?? [], 'attributeBindings')['src']) && ($this->map($this->map($node['attributeBindings'], 'attributeBindings')['src'], 'binding')['source'] ?? null) !== 'asset') {
                    $this->fail('assets', 'This shared image source needs a managed asset binding.');
                }
                foreach ($this->strings($node['style'] ?? [], 'style') as $value) {
                    if (preg_match('/url\s*\(/i', $value)) {
                        $this->fail('assets', 'CSS media requires a qualified managed adapter.');
                    }
                }
            }
        }
        $managedAssets = $this->map($document['managedAssets'] ?? [], 'managedAssets');
        foreach ($this->map($source['assets'] ?? [], 'assets') as $rawAsset) {
            $asset = $this->map($rawAsset, 'asset');
            if (($asset['kind'] ?? null) !== 'image' || ! is_string($asset['id'] ?? null) || ! is_string($managedAssets[$asset['id']] ?? null)) {
                $this->fail('assets', 'Shared rendering requires retained managed image assets.');
            }
        }
    }

    /** @param array<array-key,mixed> $properties */
    private function declaredPath(array $properties, string $path): bool
    {
        $parts = explode('.', $path);
        foreach ($parts as $index => $part) {
            if (! preg_match('/^[a-zA-Z][a-zA-Z0-9_]*$/D', $part) || in_array($part, ['__proto__', 'constructor', 'prototype'], true) || ! array_key_exists($part, $properties)) {
                return false;
            }
            if ($index < count($parts) - 1) {
                $properties = $this->map($this->map($properties[$part], 'schema')['properties'] ?? [], 'schema.properties');
            }
        }

        return true;
    }

    /** @return array<array-key,mixed> */
    private function map(mixed $value, string $field): array
    {
        if (! is_array($value)) {
            $this->fail($field, 'Expected a decoded JSON container.');
        }

        return $value;
    }

    /** @return list<string> */
    private function strings(mixed $value, string $field): array
    {
        $values = $this->map($value, $field);
        $strings = [];
        foreach ($values as $item) {
            $strings[] = $this->string($item, $field);
        }

        return $strings;
    }

    private function string(mixed $value, string $field): string
    {
        if (! is_string($value)) {
            $this->fail($field, 'Expected a string.');
        }

        return $value;
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => [$message]]);
    }
}
