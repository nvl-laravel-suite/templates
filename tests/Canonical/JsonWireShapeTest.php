<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Nvl\Templates\Support\JsonWire;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\Documents;

final class JsonWireShapeTest extends TestCase
{
    public function test_typed_empty_literal_block_objects_survive_source_and_variant_wire_round_trips(): void
    {
        $fixture = json_decode(file_get_contents(__DIR__.'/../Support/Contracts/family-structure.v1.json'), true, 64, JSON_THROW_ON_ERROR);
        $base = $fixture['base'];
        $base['source']['definition']['blocks'][0]['props']['caption'] = ['type' => 'object', 'properties' => ['label' => ['type' => 'string']], 'additionalProperties' => false];
        $base['source']['definition']['nodes']['card']['props']['caption'] = ['source' => 'literal', 'value' => []];
        $wire = json_decode(json_encode(JsonWire::document($base), JSON_THROW_ON_ERROR));
        self::assertInstanceOf(\stdClass::class, $wire->source->definition->nodes->card->props->caption->value);
        $variant = ['format' => 'template-document', 'schemaVersion' => 1, 'target' => 'document', 'source' => ['mode' => 'group-variant', 'group' => ['id' => 'family', 'revision' => 1], 'overrides' => ['variations' => ['caption' => ['kind' => 'block-property', 'value' => ['source' => 'literal', 'value' => []]]]]]];
        $wire = json_decode(json_encode(JsonWire::document($variant, $base), JSON_THROW_ON_ERROR));
        self::assertInstanceOf(\stdClass::class, $wire->source->overrides->variations->caption->value->value);
    }

    public function test_structural_variant_maps_and_fragment_nodes_retain_canonical_wire_shapes(): void
    {
        $doc = ['format' => 'template-document', 'schemaVersion' => 1, 'target' => 'document', 'source' => ['mode' => 'group-variant', 'group' => ['id' => 'family', 'revision' => 1], 'overrides' => ['variations' => ['slot' => ['kind' => 'children', 'order' => ['local'], 'nodes' => ['local' => ['id' => 'local', 'name' => 'Local', 'kind' => 'element', 'tag' => 'p', 'classes' => [], 'attributes' => [], 'attributeBindings' => [], 'style' => [], 'children' => [], 'permissions' => ['content' => false, 'style' => false]]]]]]]];
        $wire = json_decode(json_encode(JsonWire::document($doc), JSON_THROW_ON_ERROR));
        self::assertInstanceOf(\stdClass::class, $wire->source->overrides->variations->slot->nodes->local->style);
        self::assertInstanceOf(\stdClass::class, $wire->source->overrides->variations->slot->nodes->local->attributes);
        $doc['source']['overrides'] = [];
        $wire = json_decode(json_encode(JsonWire::document($doc), JSON_THROW_ON_ERROR));
        self::assertInstanceOf(\stdClass::class, $wire->source->overrides);
    }

    public function test_field_examples_and_setting_defaults_retain_their_schema_declared_object_shape(): void
    {
        $doc = Documents::standalone();
        $schema = ['type' => 'object', 'properties' => [], 'additionalProperties' => false];
        $doc['source']['definition']['fields'][] = ['id' => 'options', 'path' => 'inputs.options', 'label' => 'Options', 'schema' => $schema, 'defaultValue' => [], 'sample' => [], 'required' => true, 'editable' => true, 'description' => ''];
        $doc['settingsSpec'] = [['id' => 'options', 'schema' => $schema, 'defaultValue' => [], 'targets' => [], 'exposed' => true, 'label' => 'Options']];
        $wire = json_decode(json_encode(JsonWire::document($doc), JSON_THROW_ON_ERROR));
        self::assertInstanceOf(\stdClass::class, $wire->source->definition->fields[0]->defaultValue);
        self::assertInstanceOf(\stdClass::class, $wire->source->definition->fields[0]->sample);
        self::assertInstanceOf(\stdClass::class, $wire->settingsSpec[0]->defaultValue);
        $layout = json_decode(json_encode(JsonWire::resource($doc['source']['definition']), JSON_THROW_ON_ERROR));
        self::assertInstanceOf(\stdClass::class, $layout->fields[0]->defaultValue);
        $settings = json_decode(json_encode(JsonWire::resource(['settingsSpec' => $doc['settingsSpec']]), JSON_THROW_ON_ERROR));
        self::assertInstanceOf(\stdClass::class, $settings->settingsSpec[0]->defaultValue);
    }
}
