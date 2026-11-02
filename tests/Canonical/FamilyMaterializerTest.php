<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Services\FamilyMaterializer;
use Nvl\Templates\Services\SchemaValidator;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;

final class FamilyMaterializerTest extends TestCase
{
    public function test_current_primitive_items_work_in_grouped_templates(): void
    {
        $base = $this->repeatingFamily();
        $result = app(FamilyMaterializer::class)->materialize($base, []);
        self::assertSame(['source' => 'item', 'path' => ''], $result['source']['definition']['nodes']['loop_copy']['parts'][0]['value']);
    }

    public function test_literal_repeats_have_their_own_item_context_inside_a_typed_repeat(): void
    {
        $base = $this->repeatingFamily();
        $nodes = &$base['source']['definition']['nodes'];
        $nodes['loop']['children'] = ['inner_loop'];
        $nodes['inner_loop'] = ['id' => 'inner_loop', 'name' => 'Inner loop', 'permissions' => ['content' => false, 'style' => false], 'kind' => 'repeat', 'binding' => ['source' => 'literal', 'value' => [['name' => 'One']]], 'children' => ['loop_copy']];
        $nodes['loop_copy']['parts'][0]['value']['path'] = 'name';
        $result = app(FamilyMaterializer::class)->materialize($base, []);
        self::assertSame('name', $result['source']['definition']['nodes']['loop_copy']['parts'][0]['value']['path']);
    }

    public function test_nested_literal_item_arrays_reach_the_runtime_array_validator(): void
    {
        $base = $this->repeatingFamily();
        $nodes = &$base['source']['definition']['nodes'];
        $nodes['loop']['binding'] = ['source' => 'literal', 'value' => [['children' => ['A', 'B']]]];
        $nodes['loop']['children'] = ['inner_loop'];
        $nodes['inner_loop'] = ['id' => 'inner_loop', 'name' => 'Inner loop', 'permissions' => ['content' => false, 'style' => false], 'kind' => 'repeat', 'binding' => ['source' => 'item', 'path' => 'children'], 'children' => ['loop_copy']];
        $result = app(FamilyMaterializer::class)->materialize($base, []);
        self::assertSame('children', $result['source']['definition']['nodes']['inner_loop']['binding']['path']);
    }

    public function test_list_structure_cannot_be_changed_by_browser_repair(): void
    {
        $base = $this->repeatingFamily();
        $base['source']['definition']['nodes']['loop']['binding'] = ['source' => 'literal', 'value' => ['A']];
        $base['source']['definition']['roots'] = ['invalid_list'];
        $base['source']['definition']['nodes'] = array_intersect_key($base['source']['definition']['nodes'], array_flip(['loop', 'loop_copy']));
        $base['variationPoints'] = [];
        $base['source']['definition']['nodes']['invalid_list'] = ['id' => 'invalid_list', 'name' => 'Invalid list', 'kind' => 'element', 'tag' => 'ul', 'attributes' => [], 'attributeBindings' => [], 'classes' => [], 'style' => [], 'children' => ['loop'], 'permissions' => ['content' => false, 'style' => false]];
        $this->expectException(ValidationException::class);
        app(FamilyMaterializer::class)->materialize($base, []);
    }

    public function test_current_item_formatting_still_matches_the_declared_array_item_type(): void
    {
        $base = $this->repeatingFamily();
        $base['source']['definition']['nodes']['loop_copy']['parts'][0]['format'] = 'currency';
        $this->expectException(ValidationException::class);
        app(FamilyMaterializer::class)->materialize($base, []);
    }

    public function test_untyped_literal_items_still_reject_unsafe_paths(): void
    {
        $base = $this->repeatingFamily();
        $base['source']['definition']['nodes']['loop']['binding'] = ['source' => 'literal', 'value' => [['name' => 'One']]];
        $base['source']['definition']['nodes']['loop_copy']['parts'][0]['value']['path'] = 'constructor.name';
        $this->expectException(ValidationException::class);
        app(FamilyMaterializer::class)->materialize($base, []);
    }

    private function repeatingFamily(): array
    {
        $base = $this->fixture()['base'];
        $base['source']['definition']['fields'][] = ['id' => 'names', 'path' => 'inputs.names', 'label' => 'Names', 'description' => '', 'required' => false, 'editable' => true, 'schema' => ['type' => 'array', 'items' => ['type' => 'string']]];
        $base['source']['definition']['roots'][] = 'loop';
        $base['source']['definition']['nodes']['loop'] = ['id' => 'loop', 'name' => 'Loop', 'permissions' => ['content' => false, 'style' => false], 'kind' => 'repeat', 'binding' => ['source' => 'field', 'fieldId' => 'names'], 'children' => ['loop_copy']];
        $base['source']['definition']['nodes']['loop_copy'] = ['id' => 'loop_copy', 'name' => 'Loop item', 'permissions' => ['content' => false, 'style' => false], 'kind' => 'text', 'parts' => [['value' => ['source' => 'item', 'path' => ''], 'format' => 'text', 'currency' => 'EUR']]];

        return $base;
    }

    public function test_portable_object_block_property_schema_matches_the_javascript_materializer(): void
    {
        $fixture = json_decode(file_get_contents(__DIR__.'/../Support/Contracts/family-structure.v1.json'), true, 64, JSON_THROW_ON_ERROR);
        $base = $fixture['base'];
        $base['source']['definition']['blocks'][0]['props']['caption'] = ['type' => 'object', 'properties' => ['label' => ['type' => 'string']], 'additionalProperties' => false];
        $base['source']['definition']['nodes']['card']['props']['caption'] = ['source' => 'literal', 'value' => ['label' => 'Base']];
        $effective = app(FamilyMaterializer::class)->materialize($base, []);
        self::assertSame(['label' => 'Base'], $effective['source']['definition']['nodes']['card']['props']['caption']['value']);
    }

    private function fixture(): array
    {
        return json_decode(file_get_contents(__DIR__.'/../Support/Contracts/family-structure.v1.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    public function test_shared_contract_materializes_and_derives_every_kind_without_stale_output(): void
    {
        $fixture = $this->fixture();
        $service = new FamilyMaterializer(new SchemaValidator);
        $result = $service->materialize($fixture['base'], $fixture['overrides']);
        self::assertSame(['first', 'local'], $result['source']['definition']['nodes']['region']['children']);
        self::assertSame('text', $result['source']['definition']['nodes']['footer']['kind']);
        self::assertArrayNotHasKey('footcopy', $result['source']['definition']['nodes']);
        self::assertSame('', $result['artifacts']['html']);
        self::assertEquals($fixture['expectedDefinition'], $result['source']['definition']);
        self::assertEquals($fixture['overrides'], $service->derive($fixture['base'], $result));
    }

    public function test_unknown_override_cannot_change_an_inherited_region(): void
    {
        $fixture = $this->fixture();
        $fixture['overrides']['variations']['missing'] = ['kind' => 'node-style', 'value' => 'red'];
        $this->expectException(ValidationException::class);
        (new FamilyMaterializer(new SchemaValidator))->materialize($fixture['base'], $fixture['overrides']);
    }

    public function test_declarations_are_checked_even_without_overrides(): void
    {
        $fixture = $this->fixture();
        $fixture['base']['variationPoints'][] = $fixture['base']['variationPoints'][0];
        $this->expectException(ValidationException::class);
        (new FamilyMaterializer(new SchemaValidator))->materialize($fixture['base'], []);
    }

    public function test_rejects_wrong_typed_field_binding_at_a_declared_block_property(): void
    {
        $fixture = $this->fixture();
        $fixture['base']['source']['definition']['fields'][] = ['id' => 'number', 'path' => 'inputs.number', 'label' => 'Number', 'description' => '', 'schema' => ['type' => 'number'], 'required' => true, 'editable' => true];
        $fixture['overrides']['variations']['caption'] = ['kind' => 'block-property', 'value' => ['source' => 'field', 'fieldId' => 'number']];
        $this->expectException(ValidationException::class);
        (new FamilyMaterializer(new SchemaValidator))->materialize($fixture['base'], $fixture['overrides']);
    }

    public function test_rejects_repeaters_with_scalar_bindings_inside_a_declared_fragment(): void
    {
        $fixture = $this->fixture();
        $fixture['overrides']['variations']['region'] = ['kind' => 'children', 'order' => ['first', 'loop'], 'nodes' => ['loop' => ['id' => 'loop', 'name' => 'Loop', 'permissions' => ['content' => false, 'style' => false], 'kind' => 'repeat', 'binding' => ['source' => 'literal', 'value' => 'wrong'], 'children' => []]]];
        $fixture['base']['variationPoints'][2]['allowedKinds'][] = 'repeat';
        $this->expectException(ValidationException::class);
        (new FamilyMaterializer(new SchemaValidator))->materialize($fixture['base'], $fixture['overrides']);
    }

    public function test_omitted_block_property_defaults_remain_omitted_in_derived_authority(): void
    {
        $base = $this->fixture()['base'];
        $base['source']['definition']['blocks'][0]['propertyMetadata'] = ['caption' => ['label' => 'Caption', 'description' => '', 'defaultValue' => 'Fallback']];
        unset($base['source']['definition']['nodes']['card']['props']['caption']);
        $service = app(FamilyMaterializer::class);
        self::assertSame([], $service->derive($base, $service->materialize($base, [])));
        $patch = ['variations' => ['caption' => ['kind' => 'block-property', 'value' => ['source' => 'literal', 'value' => 'Changed']]]];
        self::assertEquals($patch, $service->derive($base, $service->materialize($base, $patch)));
        $reset = $service->derive($base, $service->materialize($base, []), $patch);
        self::assertSame(['variations' => []], $reset);
        self::assertSame([], $service->materialize($base, $reset)['source']['definition']['nodes']['card']['props']);
        $edited = $service->materialize($base, ['variations' => ['accent' => ['kind' => 'node-style', 'value' => 'red']]]);
        self::assertEquals(['variations' => ['accent' => ['kind' => 'node-style', 'value' => 'red']]], $service->derive($base, $edited));
    }

    public function test_removing_an_explicit_inherited_binding_is_still_undeclared(): void
    {
        $base = $this->fixture()['base'];
        $base['source']['definition']['blocks'][0]['propertyMetadata'] = ['caption' => ['label' => 'Caption', 'description' => '', 'defaultValue' => 'Fallback']];
        $edited = $base;
        unset($edited['source']['definition']['nodes']['card']['props']['caption']);
        $this->expectException(ValidationException::class);
        app(FamilyMaterializer::class)->derive($base, $edited);
    }

    public function test_explicitly_null_family_contract_containers_are_rejected(): void
    {
        $base = $this->fixture()['base'];
        $cases = [
            [array_replace($base, ['variationPoints' => null]), []],
        ];
        foreach (['content', 'settingsDefaults', 'exposedInputs', 'exposedSettings', 'variations'] as $key) {
            $cases[] = [$base, [$key => null]];
        }
        $nullRequired = $base;
        $nullRequired['variationPoints'][2]['requiredIds'] = null;
        $cases[] = [$nullRequired, []];
        $nullBlocks = $base;
        $nullBlocks['variationPoints'][3]['allowedBlocks'] = null;
        $cases[] = [$nullBlocks, []];
        $cases[] = [$base, ['variations' => ['region' => ['kind' => 'children', 'order' => ['first'], 'nodes' => null]]]];
        foreach ($cases as $index => [$document, $overrides]) {
            try {
                app(FamilyMaterializer::class)->materialize($document, $overrides);
                self::fail('Null family contract container accepted at case '.$index);
            } catch (ValidationException) {
                self::assertTrue(true);
            }
        }
    }

    public function test_numeric_point_and_fragment_map_keys_are_canonical_identifiers(): void
    {
        $base = $this->fixture()['base'];
        $base['variationPoints'][1]['id'] = '0';
        $service = app(FamilyMaterializer::class);
        // PHP associative JSON decoding casts numeric object keys to integer keys,
        // including the list-shaped representation of a sole canonical "0" key.
        $patch = ['variations' => ['0' => ['kind' => 'node-style', 'value' => 'red']]];
        self::assertEquals($patch, $service->derive($base, $service->materialize($base, $patch)));
        foreach (['0', '123'] as $id) {
            $node = $base['source']['definition']['nodes']['first'];
            $node['id'] = $id;
            $patch = ['variations' => ['region' => ['kind' => 'children', 'order' => ['first', $id], 'nodes' => [$id => $node]]]];
            self::assertEquals($patch, $service->derive($base, $service->materialize($base, $patch)));
        }
    }

    public function test_structural_invalidation_keeps_email_sidecars_and_their_text_bindings(): void
    {
        $base = $this->fixture()['base'];
        $base['artifacts']['subject'] = 'Gift for {{recipient}}';
        $base['artifacts']['text'] = 'Dear {{recipient}}';
        $binding = ['id' => 'recipient', 'kind' => 'text', 'path' => 'inputs.recipient'];
        $base['artifacts']['bindings'] = [$binding, ['id' => 'old_style', 'kind' => 'style', 'path' => 'settings.size', 'property' => 'font-size']];
        $result = app(FamilyMaterializer::class)->materialize($base, ['variations' => ['accent' => ['kind' => 'node-style', 'value' => 'red']]]);
        self::assertSame('Gift for {{recipient}}', $result['artifacts']['subject']);
        self::assertSame('Dear {{recipient}}', $result['artifacts']['text']);
        self::assertSame([$binding], $result['artifacts']['bindings']);
        self::assertSame('', $result['artifacts']['html']);
        self::assertSame('', $result['artifacts']['css']);
    }

    public function test_invalid_typed_block_metadata_defaults_are_rejected_like_javascript(): void
    {
        $base = $this->fixture()['base'];
        $base['source']['definition']['blocks'][0]['propertyMetadata'] = ['caption' => ['label' => 'Caption', 'description' => '', 'defaultValue' => 999]];
        unset($base['source']['definition']['nodes']['card']['props']['caption']);
        $this->expectException(ValidationException::class);
        app(FamilyMaterializer::class)->materialize($base, []);
    }

    public function test_empty_block_slot_assignments_are_distinct_from_inherited_fallback_omission(): void
    {
        $base = $this->fixture()['base'];
        $service = app(FamilyMaterializer::class);
        $patch = ['variations' => ['body' => ['kind' => 'children', 'order' => []]]];
        $edited = $service->materialize($base, $patch);
        self::assertSame(['body' => []], $edited['source']['definition']['nodes']['card']['slots']);
        self::assertSame($patch, $service->derive($base, $edited));
        self::assertSame([], $service->derive($base, $base));
        $reset = $service->derive($base, $base, $patch);
        self::assertSame(['variations' => []], $reset);
        self::assertSame([], $service->materialize($base, $reset)['source']['definition']['nodes']['card']['slots']);
    }
}
