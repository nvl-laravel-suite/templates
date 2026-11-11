<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Support\JsonWire;

/** Pure lowering/derivation of family authority. Persistence, grants and compilation belong to the host. */
/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * @phpstan-import-type Definition from DocumentValidator
 * @phpstan-import-type Node from DocumentValidator
 * @phpstan-import-type Binding from DocumentValidator
 * @phpstan-import-type Field from DocumentValidator
 * @phpstan-import-type DefinitionBlock from DocumentValidator
 * @phpstan-import-type JsonSchema from DocumentValidator
 *
 * @phpstan-type PropertyPoint array{id:string,label:string,kind:'node-property'|'node-style',nodeId:string,property:string,schema:JsonSchema}
 * @phpstan-type BlockPropertyPoint array{id:string,label:string,kind:'block-property',nodeId:string,property:string,allowedSources:list<string>}
 * @phpstan-type PlacementPoint array{id:string,label:string,kind:'placement',nodeId:string,allowedKinds:list<string>,allowedBlocks?:list<array{id:string,version:int}>}
 * @phpstan-type ChildrenTarget array{kind:'roots'}|array{kind:'children',nodeId:string}|array{kind:'block-slot',nodeId:string,slot:string}
 * @phpstan-type ChildrenPoint array{id:string,label:string,kind:'children',target:ChildrenTarget,minItems:int,maxItems:int,allowedKinds:list<string>,requiredIds?:list<string>}
 * @phpstan-type VariationPoint PropertyPoint|BlockPropertyPoint|PlacementPoint|ChildrenPoint
 *
 * @internal
 */
final class FamilyMaterializer
{
    private const KINDS = ['element', 'text', 'repeat', 'condition', 'block', 'slot'];

    private const SOURCES = ['literal', 'field', 'item', 'prop', 'asset'];

    public function __construct(private SchemaValidator $schemas) {}

    /**
     * @param  array<array-key,mixed>  $base
     * @param  array<array-key,mixed>  $overrides
     * @return array<array-key,mixed>
     */
    public function materialize(array $base, array $overrides): array
    {
        if (array_diff(array_keys($overrides), ['content', 'settingsDefaults', 'exposedInputs', 'exposedSettings', 'variations'])) {
            $this->fail('Unsupported family override.');
        }
        $points = $this->declarations($base);
        $baseSource = $this->map($base['source'] ?? []);
        $definition = $this->map($baseSource['definition'] ?? []);
        $this->graph($definition);
        $original = $definition;
        $variations = array_key_exists('variations', $overrides) ? $overrides['variations'] : [];
        if (! is_array($variations)) {
            $this->fail('Variations must be a point-keyed object.');
        }
        $displaced = $supplied = [];
        foreach ($variations as $id => $patch) {
            $point = $points[$id] ?? null;
            if ($point === null || ! is_array($patch) || ($patch['kind'] ?? null) !== $point['kind']) {
                $this->fail('Unknown variation point or changed kind: '.$id.'.');
            }
            $kind = $point['kind'];
            if (in_array($point['kind'], ['node-property', 'node-style', 'block-property'], true)) {
                $this->shape($patch, ['kind', 'value']);
                $node = &$definition['nodes'][$point['nodeId']];
                if ($point['kind'] === 'node-property') {
                    $this->schemas->validate($patch['value'], $point['schema'], 'variations.'.$id);
                    $node[$point['property']] = $patch['value'];
                } elseif ($point['kind'] === 'node-style') {
                    if ($patch['value'] === null) {
                        unset($node['style'][$point['property']]);
                    } else {
                        if (! is_string($patch['value'])) {
                            $this->fail('A style override must be a string or null.');
                        }
                        $this->schemas->validate($patch['value'], $point['schema'], 'variations.'.$id);
                        $node['style'][$point['property']] = $patch['value'];
                    }
                } else {
                    $value = $patch['value'];
                    if (! is_array($value) || ! in_array($value['source'] ?? null, $point['allowedSources'], true)) {
                        $this->fail('Unsupported block property source.');
                    }
                    $node['props'][$point['property']] = $value;
                }
                unset($node);

                continue;
            }
            $this->shape($patch, ['kind', $point['kind'] === 'placement' ? 'node' : 'order'], ['nodes']);
            $owned = $this->region($original, $point);
            $displaced += $owned;
            $nodes = array_key_exists('nodes', $patch) ? $patch['nodes'] : [];
            if (! is_array($nodes)) {
                $this->fail('Fragment nodes must be an ID-keyed map.');
            }
            foreach ($nodes as $localId => $node) {
                if (! is_array($node) || ($node['id'] ?? null) !== (string) $localId || isset($supplied[$localId]) || (isset($original['nodes'][$localId]) && ! isset($owned[$localId])) || ($point['kind'] === 'placement' && (string) $localId === $point['nodeId'])) {
                    $this->fail('Fragment ID collision: '.$localId.'.');
                }
                $supplied[$localId] = true;
                $definition['nodes'][$localId] = $this->node($node);
            }
            if ($point['kind'] === 'placement') {
                $node = $patch['node'];
                if (! is_array($node) || ($node['id'] ?? null) !== $point['nodeId'] || ! in_array($node['kind'] ?? null, $point['allowedKinds'], true)) {
                    $this->fail('Replacement must retain its placement ID and an approved kind.');
                }
                if ($node['kind'] === 'block' && isset($point['allowedBlocks']) && ! array_filter($point['allowedBlocks'], fn ($block) => $block['id'] === $node['blockId'] && $block['version'] === $node['version'])) {
                    $this->fail('Replacement block is not approved.');
                }
                $definition['nodes'][$point['nodeId']] = $this->node($node);
                $roots = [$point['nodeId']];
            } else {
                $roots = $patch['order'];
                $this->identifiers($roots);
                if (count($roots) < $point['minItems'] || count($roots) > $point['maxItems'] || array_diff($point['requiredIds'] ?? [], $roots)) {
                    $this->fail('Invalid required placements or slot cardinality.');
                }
                foreach ($roots as $root) {
                    if (! in_array($definition['nodes'][$root]['kind'] ?? null, $point['allowedKinds'], true)) {
                        $this->fail('Unsupported region child kind.');
                    }
                }
                $this->setSequence($definition, $point, $roots);
            }
            $reachable = $this->closure($definition, $roots);
            foreach ($reachable as $ref => $_) {
                if (! isset($owned[$ref]) && ! isset($nodes[$ref])) {
                    $this->fail('Reference outside declared region: '.$ref.'.');
                }
            }
            if (array_diff_key($nodes, $reachable)) {
                $this->fail('Orphan fragment nodes are not allowed.');
            }
        }
        $reachable = $this->closure($definition, $definition['roots']);
        foreach ($displaced as $id => $_) {
            if (! isset($reachable[$id])) {
                unset($definition['nodes'][$id]);
            }
        }
        $this->graph($definition);
        $result = $base;
        $resultSource = $this->map($result['source'] ?? []);
        $resultSource['definition'] = $definition;
        $result['source'] = $resultSource;
        if (! $this->same($original, $definition)) {
            $rendering = $this->map($base['rendering'] ?? []);
            $artifacts = $this->map($base['artifacts'] ?? []);
            $sidecars = $this->text($rendering['subject'] ?? $artifacts['subject'] ?? '')."\n".$this->text($rendering['text'] ?? $artifacts['text'] ?? '');
            $result['artifacts'] = array_replace($artifacts, ['html' => '', 'css' => '', 'bindings' => array_values(array_filter($this->map($artifacts['bindings'] ?? []), fn ($binding) => ($this->map($binding)['kind'] ?? null) === 'text' && str_contains($sidecars, '{{'.$this->text($this->map($binding)['id'] ?? '').'}}')))]);
        }
        foreach (['content', 'settingsDefaults'] as $key) {
            if (array_key_exists($key, $overrides) && (! is_array($overrides[$key]) || ($overrides[$key] !== [] && array_is_list($overrides[$key])))) {
                $this->fail('Family value overrides must be objects.');
            }
            $result[$key] = array_replace($this->map($base[$key] ?? []), $this->map($overrides[$key] ?? []));
        }
        foreach (['exposedInputs', 'exposedSettings'] as $key) {
            if (array_key_exists($key, $overrides)) {
                $this->identifiers($overrides[$key], false);
                if (array_diff($overrides[$key], $this->stringList($base[$key] ?? []))) {
                    $this->fail('A variant cannot widen family editing capabilities.');
                }
                $result[$key] = $overrides[$key];
            }
        }

        return $result;
    }

    /**
     * @param  array<array-key,mixed>  $base
     * @param  array<array-key,mixed>  $edited
     * @param  array<array-key,mixed>  $existing
     * @return array<array-key,mixed>
     */
    public function derive(array $base, array $edited, array $existing = []): array
    {
        $points = $this->declarations($base);
        $overrides = [];
        foreach (['content', 'settingsDefaults'] as $key) {
            $values = $this->map($existing[$key] ?? []);
            $baseValues = $this->map($base[$key] ?? []);
            foreach ($this->map($edited[$key] ?? []) as $id => $value) {
                if (! array_key_exists($id, $baseValues) || ! $this->same($value, $baseValues[$id]) || array_key_exists($id, $values)) {
                    $values[$id] = $value;
                }
            }
            if ($values !== [] || array_key_exists($key, $existing)) {
                $overrides[$key] = $values;
            }
        }
        foreach (['exposedInputs', 'exposedSettings'] as $key) {
            if (! $this->same($base[$key] ?? [], $edited[$key] ?? []) || array_key_exists($key, $existing)) {
                $overrides[$key] = $edited[$key] ?? [];
            }
        }
        $baseDefinition = $this->map($this->map($base['source'] ?? [])['definition'] ?? []);
        $editedDefinition = $this->map($this->map($edited['source'] ?? [])['definition'] ?? []);
        $this->graph($baseDefinition);
        $this->graph($editedDefinition);
        $existingVariations = $this->map($existing['variations'] ?? []);
        $variations = [];
        foreach ($points as $id => $point) {
            $patch = $this->extract($editedDefinition, $baseDefinition, $point);
            if ($patch !== null && (! $this->same($patch, $this->extract($baseDefinition, $baseDefinition, $point)) || array_key_exists($id, $existingVariations))) {
                $variations[$id] = $patch;
            }
        }
        if (array_diff_key($existingVariations, $points)) {
            $this->fail('Unknown existing variation point.');
        }
        if ($variations !== [] || array_key_exists('variations', $existing)) {
            $overrides['variations'] = $variations;
        }
        $materialized = $this->materialize($base, $overrides);
        unset($materialized['artifacts'], $edited['artifacts']);
        if (! $this->same($materialized, $edited)) {
            $this->fail('Edited document contains undeclared changes that cannot be represented as family overrides.');
        }

        return $overrides;
    }

    /**
     * @param  array<array-key,mixed>  $base
     * @return array<array-key,VariationPoint>
     */
    private function declarations(array $base): array
    {
        $baseSource = $this->map($base['source'] ?? []);
        $definition = $this->map($baseSource['definition'] ?? []);
        $this->graph($definition);
        $points = array_key_exists('variationPoints', $base) ? $base['variationPoints'] : [];
        if (! is_array($points) || ! array_is_list($points)) {
            $this->fail('Family variation points must be a list.');
        }
        $byId = $keys = $regions = [];
        foreach ($points as $point) {
            if (! is_array($point)) {
                $this->fail('A variation point must be an object.');
            }
            $kind = $point['kind'] ?? null;
            $required = ['id', 'label', 'kind'];
            $optional = [];
            if (in_array($kind, ['node-property', 'node-style'], true)) {
                $required = array_merge($required, ['nodeId', 'property', 'schema']);
            } elseif ($point['kind'] === 'block-property') {
                $required = array_merge($required, ['nodeId', 'property', 'allowedSources']);
            } elseif ($point['kind'] === 'placement') {
                $required = array_merge($required, ['nodeId', 'allowedKinds']);
                $optional = ['allowedBlocks'];
            } elseif ($point['kind'] === 'children') {
                $required = array_merge($required, ['target', 'minItems', 'maxItems', 'allowedKinds']);
                $optional = ['requiredIds'];
            } else {
                $this->fail('Unknown variation point kind.');
            }
            $this->shape($point, $required, $optional);
            $this->identifier($point['id']);
            if (! is_string($point['label']) || $point['label'] === '' || mb_strlen($point['label']) > 120 || isset($byId[$point['id']])) {
                $this->fail('Variation IDs must be unique and labels nonempty.');
            }
            $node = null;
            if ($point['kind'] !== 'children') {
                $this->identifier($point['nodeId']);
                $node = $definition['nodes'][$point['nodeId']] ?? null;
                if ($node === null) {
                    $this->fail('Unknown variation node.');
                }
            }
            if (in_array($kind, ['node-property', 'node-style'], true)) {
                if (! is_array($point['schema']) || ! is_string($point['property'])) {
                    $this->fail('A property declaration needs a portable schema and string property.');
                }
                $schema = $this->definitionSchema();
                $this->schemas->validate(JsonWire::schema($point['schema']), ['$ref' => '#/$defs/__schema8', '$defs' => $schema['$defs']], 'variationPoints.schema');
                if ($point['kind'] === 'node-property') {
                    if (! in_array($point['property'], ['name', 'tag', 'classes', 'parts'], true) || ! array_key_exists($point['property'], $node)) {
                        $this->fail('Unsupported node property for this target.');
                    }
                    $this->schemas->validate($node[$point['property']], $point['schema'], 'variationPoints.schema');
                } else {
                    if ($node === null || $node['kind'] !== 'element' || ($point['schema']['type'] ?? null) !== 'string') {
                        $this->fail('Styles need an element and a string schema.');
                    }
                    $this->style($point['property'], 'inherit');
                    if (array_key_exists($point['property'], $node['style'])) {
                        $this->schemas->validate($node['style'][$point['property']], $point['schema'], 'variationPoints.schema');
                    }
                }
            }
            if ($point['kind'] === 'block-property') {
                $this->identifier($point['property']);
                $this->identifiers($point['allowedSources']);
                $block = $this->block($definition, $node['blockId'] ?? '', $node['version'] ?? 0);
                if ($node['kind'] !== 'block' || $block === null || ! isset($block['props'][$point['property']]) || $point['allowedSources'] === [] || array_diff($point['allowedSources'], self::SOURCES)) {
                    $this->fail('Declare an existing block property and approved source kinds.');
                }
            }
            if (in_array($kind, ['placement', 'children'], true)) {
                $this->identifiers($point['allowedKinds']);
                if ($point['allowedKinds'] === [] || array_diff($point['allowedKinds'], self::KINDS) || in_array('slot', $point['allowedKinds'], true)) {
                    $this->fail('Unsupported placement or region node kinds.');
                }
            }
            if ($point['kind'] === 'placement') {
                if (! in_array($node['kind'], $this->stringList($point['allowedKinds']), true)) {
                    $this->fail('The inherited placement kind must remain allowed.');
                }
                if (array_key_exists('allowedBlocks', $point)) {
                    if (! is_array($point['allowedBlocks']) || ! array_is_list($point['allowedBlocks'])) {
                        $this->fail('Approved blocks must be a list.');
                    }
                    foreach ($point['allowedBlocks'] as $block) {
                        $this->shape($block, ['id', 'version']);
                        $this->identifier($block['id']);
                        if (! is_int($block['version']) || $block['version'] < 1) {
                            $this->fail('A pinned block needs a positive integer version.');
                        }
                        if ($this->block($definition, $block['id'], $block['version']) === null) {
                            $this->fail('Replacement blocks must use registered pinned versions.');
                        }
                    }
                }
            }
            if ($point['kind'] === 'children') {
                $order = $this->sequence($definition, $point);
                if (! is_int($point['minItems']) || ! is_int($point['maxItems']) || $point['minItems'] < 0 || $point['maxItems'] < $point['minItems'] || count($order) < $point['minItems'] || count($order) > $point['maxItems']) {
                    $this->fail('Invalid region cardinality.');
                }
                $this->identifiers(array_key_exists('requiredIds', $point) ? $point['requiredIds'] : []);
                if (array_diff($this->stringList($point['requiredIds'] ?? []), $order)) {
                    $this->fail('Required placements must belong to the declared sequence.');
                }
                foreach ($order as $ref) {
                    if (! in_array($definition['nodes'][$ref]['kind'], $this->stringList($point['allowedKinds']), true)) {
                        $this->fail('Inherited child kinds must remain allowed.');
                    }
                }
            }
            /** @var VariationPoint $point Validated by the declaration branches above. */
            $key = $point['kind'] === 'children' ? (($point['target']['nodeId'] ?? '').':'.$point['target']['kind'].':'.($point['target']['slot'] ?? '')) : $point['nodeId'].':'.$point['kind'].':'.($point['property'] ?? '');
            if (isset($keys[$key])) {
                $this->fail('Overlapping variation declarations.');
            }
            $keys[$key] = true;
            $owned = $this->region($definition, $point);
            foreach ($byId as $id => $other) {
                $otherOwned = $regions[$id];
                $anchor = $point['kind'] === 'children' ? ($point['target']['nodeId'] ?? null) : $point['nodeId'];
                $otherAnchor = $other['kind'] === 'children' ? ($other['target']['nodeId'] ?? null) : $other['nodeId'];
                if (array_intersect_key($owned, $otherOwned) || ($anchor !== null && isset($otherOwned[$anchor])) || ($otherAnchor !== null && isset($owned[$otherAnchor]))) {
                    $this->fail('Overlapping variation graph regions.');
                }
            }
            $byId[$point['id']] = $point;
            $regions[$point['id']] = $owned;
        }

        return $byId;
    }

    /**
     * @param  Definition  $definition
     * @param  Definition  $base
     * @param  VariationPoint  $point
     * @return array<array-key,mixed>|null
     */
    private function extract(array $definition, array $base, array $point): ?array
    {
        $kind = $point['kind'];
        $node = $definition['nodes'][$point['nodeId'] ?? ''] ?? null;
        if (in_array($point['kind'], ['node-property', 'node-style', 'block-property'], true)) {
            if ($node === null) {
                $this->fail('An inherited target was removed.');
            }
            if ($point['kind'] === 'node-style' && $node['kind'] === 'element') {
                return ['kind' => $kind, 'value' => $node['style'][$point['property']] ?? null];
            }
            $values = $point['kind'] === 'block-property' ? ($node['props'] ?? []) : $node;
            if ($point['kind'] === 'block-property' && $node['kind'] === 'block' && ! array_key_exists($point['property'], $values)) {
                return null;
            }
            if (! array_key_exists($point['property'], $values)) {
                $this->fail('An inherited property was removed or changed kind.');
            }

            return ['kind' => $kind, 'value' => $values[$point['property']]];
        }
        if ($point['kind'] === 'children' && $point['target']['kind'] === 'block-slot') {
            $target = $definition['nodes'][$point['target']['nodeId']] ?? null;
            if (($target['kind'] ?? null) !== 'block') {
                $this->fail('An inherited block slot target changed kind.');
            }
            if (! array_key_exists($point['target']['slot'], $target['slots'])) {
                return null;
            }
        }
        $owned = $this->region($definition, $point);
        $nodes = [];
        foreach ($owned as $id => $_) {
            if (! ($point['kind'] === 'placement' && (string) $id === $point['nodeId']) && (! isset($base['nodes'][$id]) || ! $this->same($definition['nodes'][$id], $base['nodes'][$id]))) {
                $nodes[$id] = $definition['nodes'][$id];
            }
        }
        $patch = $point['kind'] === 'placement' ? ['kind' => $kind, 'node' => $node] : ['kind' => $kind, 'order' => $this->sequence($definition, $point)];
        if ($nodes !== []) {
            $patch['nodes'] = $nodes;
        }

        return $patch;
    }

    /**
     * @param  Definition  $definition
     * @param  array<array-key,mixed>  $point
     * @return list<string>
     */
    private function sequence(array $definition, array $point): array
    {
        $target = $point['target'] ?? null;
        if (! is_array($target)) {
            $this->fail('A children point needs a target.');
        }
        $kind = $target['kind'] ?? null;
        if ($kind === 'roots') {
            $this->shape($target, ['kind']);

            return $definition['roots'];
        }
        if (! in_array($kind, ['children', 'block-slot'], true)) {
            $this->fail('Unknown children target kind.');
        }
        $this->shape($target, $kind === 'children' ? ['kind', 'nodeId'] : ['kind', 'nodeId', 'slot']);
        $this->identifier($target['nodeId']);
        $node = $definition['nodes'][$target['nodeId']] ?? null;
        if ($kind === 'children' && isset($node['children']) && ! ($node['kind'] === 'element' && in_array($node['tag'], ['img', 'br', 'hr'], true))) {
            return $node['children'];
        }
        if ($kind === 'block-slot' && ($node['kind'] ?? null) === 'block') {
            $this->identifier($target['slot']);
            $block = $this->block($definition, $node['blockId'], $node['version']);
            foreach ($block['nodes'] ?? [] as $child) {
                if ($child['kind'] === 'slot' && $child['slot'] === $target['slot']) {
                    return $node['slots'][$target['slot']] ?? [];
                }
            }
        }
        $this->fail('Invalid children container or unknown block slot.');
    }

    /**
     * @param  Definition  $definition
     * @param  ChildrenPoint  $point
     * @param  list<string>  $ids
     */
    private function setSequence(array &$definition, array $point, array $ids): void
    {
        $target = $point['target'];
        if ($target['kind'] === 'roots') {
            $definition['roots'] = $ids;
        } elseif ($target['kind'] === 'children') {
            $node = $definition['nodes'][$target['nodeId']];
            if (! isset($node['children'])) {
                $this->fail('Invalid children container.');
            }
            $node['children'] = $ids;
            $definition['nodes'][$target['nodeId']] = $node;
        } else {
            $node = $definition['nodes'][$target['nodeId']];
            if ($node['kind'] !== 'block') {
                $this->fail('Invalid block slot container.');
            }
            $node['slots'][$target['slot']] = $ids;
            $definition['nodes'][$target['nodeId']] = $node;
        }
    }

    /**
     * @param  Definition  $definition
     * @param  VariationPoint  $point
     * @return array<array-key,true>
     */
    private function region(array $definition, array $point): array
    {
        return match ($point['kind']) {
            'placement' => $this->closure($definition, [$point['nodeId']]),
            'children' => $this->closure($definition, $this->sequence($definition, $point)),
            default => [],
        };
    }

    /**
     * @param  Definition  $definition
     * @param  list<string>  $roots
     * @return array<array-key,true>
     */
    private function closure(array $definition, array $roots): array
    {
        $found = [];
        $visit = function (string $id) use (&$visit, &$found, $definition): void {
            if (isset($found[$id])) {
                return;
            }
            $node = $definition['nodes'][$id] ?? null;
            if ($node === null) {
                $this->fail('Unknown node reference: '.$id.'.');
            }
            $found[$id] = true;
            foreach ($this->children($node) as $child) {
                $visit($child);
            }
        };
        foreach ($roots as $id) {
            $visit($id);
        }

        return $found;
    }

    /**
     * @param  array<array-key,mixed>  $definition
     *
     * @phpstan-assert Definition $definition
     */
    private function graph(array $definition): void
    {
        $this->schemas->validate($definition, $this->definitionSchema(), 'source.definition');
        /** @var Definition $definition Validated against the bundled definition schema above. */
        $fields = array_column($definition['fields'], null, 'id');
        $assets = array_column($definition['assets'], null, 'id');
        if (count($fields) !== count($definition['fields']) || count($assets) !== count($definition['assets'])) {
            $this->fail('Field and asset IDs must be unique.');
        }
        foreach ($assets as $asset) {
            if (! $this->safeURL($asset['url'])) {
                $this->fail('Unsupported asset URL.');
            }
        }
        $blocks = [];
        foreach ($definition['blocks'] as $block) {
            $key = $block['id'].'@'.$block['version'];
            if (isset($blocks[$key])) {
                $this->fail('Duplicate pinned block identity.');
            }
            $blocks[$key] = $block;
            foreach ($block['props'] as $name => $schema) {
                if (array_key_exists('defaultValue', $block['propertyMetadata'][$name] ?? [])) {
                    $this->schemas->validate($block['propertyMetadata'][$name]['defaultValue'], $schema, 'blocks.'.$key.'.propertyMetadata.'.$name.'.defaultValue');
                }
            }
        }
        /** @param list<string> $roots
         * @param array<array-key,Node> $nodes
         * @param array<string,JsonSchema> $props
         * @param list<string> $stack */
        $walk = function (array $roots, array $nodes, array $props = [], array $stack = [], bool $inBlock = false) use (&$walk, $fields, $assets, $blocks): void {
            if (count($nodes) > 5000) {
                $this->fail('A document may contain at most 5,000 nodes.');
            }
            /** @var list<string> $roots Supplied only from the schema-validated graph. */
            /** @var array<array-key,Node> $nodes Supplied only from the schema-validated graph. */
            /** @var array<string,JsonSchema> $props Supplied only from the schema-validated graph. */
            /** @var list<string> $stack Pinned block identities accumulated by this traversal. */
            $seen = $slots = [];
            /** @param JsonSchema|null $itemSchema */
            $visit = function (string $id, int $depth = 0, bool $inRepeat = false, ?array $itemSchema = null, ?string $parentTag = null) use (&$visit, &$seen, &$slots, $nodes, $props, $stack, $inBlock, $fields, $assets, $blocks, &$walk): void {
                /** @var array<array-key,Node> $nodes Captured schema-validated graph nodes. */
                /** @var array<string,JsonSchema> $props Captured schema-validated property declarations. */
                $node = $nodes[$id] ?? null;
                if ($node === null || $depth > 64 || isset($seen[$id]) || $node['id'] !== $id) {
                    $this->fail('Missing node, cycle, duplicate ownership or invalid node identity.');
                }
                $seen[$id] = true;
                if (! $this->validHtmlChild($parentTag, $node)) {
                    $this->fail('Invalid content inside table or list structure. Use list items, rows and cells; save enclosing lists/tables as reusable blocks.');
                }
                if ($node['kind'] === 'slot') {
                    if (! $inBlock || isset($slots[$node['slot']])) {
                        $this->fail('Slots require unique names inside reusable blocks.');
                    }
                    $slots[$node['slot']] = true;
                }
                $values = match ($node['kind']) {
                    'text' => array_column($node['parts'], 'value'),
                    'element' => $node['attributeBindings'],
                    'block' => $node['props'],
                    'condition', 'repeat' => [$node['binding']],
                    default => [],
                };
                foreach ($values as $value) {
                    if (($value['source'] === 'field' && ($inBlock || ! isset($fields[$value['fieldId']]))) || ($value['source'] === 'prop' && ! isset($props[$value['name']])) || ($value['source'] === 'asset' && ! isset($assets[$value['assetId']])) || ($value['source'] === 'item' && (! $inRepeat || ($itemSchema !== null && $this->schemaAt($itemSchema, $value['path']) === null)))) {
                        $this->fail('Unknown or invalid field, property, asset or repeater binding.');
                    }
                    if ($value['source'] === 'item' && $value['path'] !== '') {
                        $parts = explode('.', $value['path']);
                        if (count($parts) > 16 || array_intersect($parts, ['__proto__', 'constructor', 'prototype'])) {
                            $this->fail('Invalid repeater item path.');
                        }
                    }
                }
                $repeatedSchema = $node['kind'] === 'repeat' ? $this->bindingSchema($node['binding'], $fields, $props, $itemSchema) : null;
                if ($node['kind'] === 'repeat' && ($repeatedSchema['type'] ?? null) !== 'array' && ! ($node['binding']['source'] === 'item' && $inRepeat && $itemSchema === null) && ! ($node['binding']['source'] === 'literal' && is_array($node['binding']['value']) && array_is_list($node['binding']['value']))) {
                    $this->fail('Repeaters require a declared array field or property.');
                }
                if ($node['kind'] === 'text') {
                    foreach ($node['parts'] as $part) {
                        $schema = $this->bindingSchema($part['value'], $fields, $props, $itemSchema);
                        if ($schema !== null && ((in_array($part['format'], ['currency', 'number'], true) && ! in_array($schema['type'], ['number', 'integer'], true)) || ($part['format'] === 'date' && $schema['type'] !== 'string'))) {
                            $this->fail('Text formatting must match its binding type.');
                        }
                    }
                }
                if ($node['kind'] === 'element') {
                    if (in_array($node['tag'], ['img', 'br', 'hr'], true) && $node['children'] !== []) {
                        $this->fail('Void elements cannot contain children.');
                    }
                    foreach ($node['style'] as $property => $value) {
                        $this->style($property, $value);
                    }
                    if ($node['tag'] === 'img' && ! isset($node['attributes']['src'], $node['attributeBindings']['src']) && empty($node['attributes']['src']) && empty($node['attributeBindings']['src'])) {
                        $this->fail('Images require a source binding.');
                    }
                    foreach (['src', 'href'] as $attribute) {
                        if (! empty($node['attributes'][$attribute]) && ! $this->safeURL($node['attributes'][$attribute])) {
                            $this->fail('Unsupported source or link URL.');
                        }
                    }
                    foreach (array_merge($node['attributes'], $node['attributeBindings']) as $attribute => $value) {
                        if (! preg_match('/^(id|title|alt|src|href|width|height|colspan|rowspan|target|rel|role|lang|dir|aria-[a-z-]+|data-[a-z-]+)$/D', $attribute)) {
                            $this->fail('Unsupported element attribute.');
                        }
                    }
                }
                if ($node['kind'] === 'condition' && $node['operator'] === 'equals' && ! array_key_exists('value', $node)) {
                    $this->fail('An equality condition needs a comparison value.');
                }
                if ($node['kind'] === 'block') {
                    $key = $node['blockId'].'@'.$node['version'];
                    $block = $blocks[$key] ?? null;
                    if ($block === null || in_array($key, $stack, true)) {
                        $this->fail('Unknown block or reusable block dependency cycle.');
                    }
                    foreach ($node['props'] as $name => $value) {
                        if (! isset($block['props'][$name])) {
                            $this->fail('Unknown block property.');
                        }
                        $source = $this->bindingSchema($value, $fields, $props, $itemSchema);
                        $target = $block['props'][$name];
                        if ($source !== null && $source['type'] !== $target['type'] && ! ($source['type'] === 'integer' && $target['type'] === 'number')) {
                            $this->fail('Block property binding type does not match its declaration.');
                        }
                        if ($value['source'] === 'literal') {
                            $this->schemas->validate($value['value'], $block['props'][$name], 'block.props.'.$name);
                        }
                    }
                    foreach ($block['requiredProps'] as $name) {
                        if (! array_key_exists($name, $node['props']) && ! array_key_exists('defaultValue', $block['propertyMetadata'][$name] ?? [])) {
                            $this->fail('Missing required block property.');
                        }
                    }
                    $names = [];
                    foreach ($block['nodes'] as $child) {
                        if ($child['kind'] === 'slot') {
                            $names[] = $child['slot'];
                        }
                    }
                    if (array_diff(array_keys($node['slots']), $names)) {
                        $this->fail('Unknown block slot.');
                    }
                    $walk($block['roots'], $block['nodes'], $block['props'], [...$stack, $key], true);
                }
                $childSchema = $node['kind'] === 'repeat'
                    ? (($repeatedSchema['type'] ?? null) === 'array' ? $this->map($repeatedSchema['items']) : null)
                    : $itemSchema;
                foreach ($this->children($node) as $child) {
                    $childTag = $node['kind'] === 'element' ? $node['tag'] : (in_array($node['kind'], ['repeat', 'condition', 'slot'], true) ? $parentTag : null);
                    $visit($child, $depth + 1, $inRepeat || $node['kind'] === 'repeat', $childSchema, $childTag);
                }
            };
            foreach ($roots as $root) {
                $visit($root, parentTag: $inBlock ? 'div' : 'main');
            }
            if (array_diff_key($nodes, $seen)) {
                $this->fail('Node is not reachable from a root.');
            }
        };
        $walk($definition['roots'], $definition['nodes']);
        foreach ($blocks as $key => $block) {
            $walk($block['roots'], $block['nodes'], $block['props'], [$key], true);
        }
    }

    /**
     * @param  Binding  $value
     * @param  array<array-key,Field>  $fields
     * @param  array<string,JsonSchema>  $props
     * @param  JsonSchema|null  $itemSchema
     * @return JsonSchema|null
     */
    private function bindingSchema(array $value, array $fields, array $props, ?array $itemSchema): ?array
    {
        return match ($value['source']) {
            'field' => $fields[$value['fieldId']]['schema'] ?? null,
            'prop' => $props[$value['name']] ?? null,
            'item' => $this->schemaAt($itemSchema, $value['path']),
            'asset' => ['type' => 'string'],
            'literal' => match (true) {
                is_string($value['value']) => ['type' => 'string'],
                is_bool($value['value']) => ['type' => 'boolean'],
                is_int($value['value']) => ['type' => 'integer'],
                is_float($value['value']) => ['type' => 'number'],
                default => null,
            },
            default => null,
        };
    }

    /**
     * @param  Node  $node
     */
    private function validHtmlChild(?string $parent, array $node): bool
    {
        if ($parent === null || in_array($node['kind'], ['repeat', 'condition', 'slot'], true)) {
            return true;
        }
        $children = ['table' => ['thead', 'tbody', 'tfoot', 'tr'], 'thead' => ['tr'], 'tbody' => ['tr'], 'tfoot' => ['tr'], 'tr' => ['td', 'th'], 'ul' => ['li'], 'ol' => ['li']];
        $parents = ['thead' => ['table'], 'tbody' => ['table'], 'tfoot' => ['table'], 'tr' => ['table', 'thead', 'tbody', 'tfoot'], 'td' => ['tr'], 'th' => ['tr'], 'li' => ['ul', 'ol']];
        if ($node['kind'] === 'element' && isset($parents[$node['tag']]) && ! in_array($parent, $parents[$node['tag']], true)) {
            return false;
        }
        if (! isset($children[$parent])) {
            return true;
        }
        if ($node['kind'] === 'text') {
            foreach ($node['parts'] as $part) {
                if ($part['format'] !== 'text' || $part['value']['source'] !== 'literal' || ! is_string($part['value']['value']) || trim($part['value']['value']) !== '') {
                    return false;
                }
            }

            return true;
        }

        return $node['kind'] === 'element' && in_array($node['tag'], $children[$parent], true);
    }

    /**
     * @param  array<array-key,mixed>|null  $schema
     * @return array<array-key,mixed>|null
     */
    private function schemaAt(?array $schema, string $path): ?array
    {
        if ($path === '') {
            return $schema;
        }
        foreach (explode('.', $path) as $part) {
            $properties = $this->map($schema['properties'] ?? []);
            if (($schema['type'] ?? null) !== 'object' || ! isset($properties[$part])) {
                return null;
            }
            $schema = $this->map($properties[$part]);
        }

        return $schema;
    }

    /**
     * @return array<array-key,mixed>
     */
    private function definitionSchema(): array
    {
        static $schema;

        if (! is_array($schema)) {
            $json = file_get_contents(__DIR__.'/../../resources/contracts/template-definition.v1.schema.json');
            if ($json === false) {
                throw new \RuntimeException('The bundled definition schema is unavailable.');
            }
            $schema = $this->map(json_decode($json, true, 64, JSON_THROW_ON_ERROR));
        }

        return $schema;
    }

    /**
     * @param  Node  $node
     * @return list<string>
     */
    private function children(array $node): array
    {
        return $node['children'] ?? ($node['kind'] === 'block' ? array_merge([], ...array_values($node['slots'] ?? [])) : []);
    }

    /**
     * @param  Definition  $definition
     * @return DefinitionBlock|null
     */
    private function block(array $definition, string $id, int $version): ?array
    {
        foreach ($definition['blocks'] ?? [] as $block) {
            if ($block['id'] === $id && $block['version'] === $version) {
                return $block;
            }
        }

        return null;
    }

    /**
     * @param  list<string>  $required
     * @param  list<string>  $optional
     *
     * @phpstan-assert array<string,mixed> $value
     */
    private function shape(mixed $value, array $required, array $optional = []): void
    {
        if (! is_array($value) || array_diff($required, array_keys($value)) || array_diff(array_keys($value), array_merge($required, $optional))) {
            $this->fail('Unsupported or missing variation contract property.');
        }
    }

    /** @phpstan-assert string $id */
    private function identifier(mixed $id): void
    {
        if (! is_string($id) || ! preg_match('/^(?!constructor$|prototype$)[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/D', $id)) {
            $this->fail('Invalid variation identifier.');
        }
    }

    /** @phpstan-assert list<string> $ids */
    private function identifiers(mixed $ids, bool $validate = true): void
    {
        if (! is_array($ids) || ! array_is_list($ids) || count(array_unique($ids, SORT_REGULAR)) !== count($ids)) {
            $this->fail('Expected distinct ordered identifiers.');
        }
        foreach ($ids as $id) {
            if ($validate) {
                $this->identifier($id);
            } elseif (! is_string($id)) {
                $this->fail('Expected string identifiers.');
            }
        }
    }

    private function safeURL(string $value): bool
    {
        if ($value === '' || preg_match('/[\x00-\x20<>"\'\\\\]/', $value)) {
            return false;
        }
        if (preg_match('/^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+\/=]+$/D', $value)) {
            return true;
        }

        return ! str_starts_with($value, '//') && (! preg_match('/^[a-zA-Z][a-zA-Z0-9+.-]*:/', $value) || preg_match('/^(https?:|mailto:|tel:)/i', $value));
    }

    private function style(string $property, string $value): void
    {
        if (! preg_match('/^(--[a-zA-Z][a-zA-Z0-9-]*|[a-zA-Z][a-zA-Z0-9-]*)$/D', $property) || preg_match('/[<>\\\\{};]/', $value) || preg_match('/url\s*\(|image-set\s*\(|expression\s*\(|javascript:|behavior\s*:/i', $value)) {
            $this->fail('Use a plain CSS declaration; media URLs belong in assets.');
        }
    }

    private function same(mixed $a, mixed $b): bool
    {
        return is_array($a) && is_array($b) ? CanonicalJson::hash($a) === CanonicalJson::hash($b) : $a === $b;
    }

    /** @return array<array-key,mixed> */
    private function map(mixed $value): array
    {
        if (! is_array($value)) {
            $this->fail('Expected a decoded JSON container.');
        }

        return $value;
    }

    private function text(mixed $value): string
    {
        if (! is_string($value)) {
            $this->fail('Expected a string.');
        }

        return $value;
    }

    /** @return list<string> */
    private function stringList(mixed $value): array
    {
        $this->identifiers($value, false);

        return $value;
    }

    /** @param array<array-key,mixed> $node
     * @return Node */
    private function node(array $node): array
    {
        $schema = $this->definitionSchema();
        $properties = $this->map($schema['properties'] ?? []);
        $nodes = $this->map($properties['nodes'] ?? []);
        $nodeSchema = $this->map($nodes['additionalProperties'] ?? []);
        $nodeSchema['$defs'] = $schema['$defs'] ?? [];
        $this->schemas->validate($node, $nodeSchema, 'source.definition.nodes');

        /** @var Node $node Validated against the bundled discriminated node schema above. */
        return $node;
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['variations' => [$message]]);
    }
}
