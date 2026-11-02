<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Services\FamilyLifecycle;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class FamilyConflictComparisonTest extends TestCase
{
    use RefreshDatabase;

    private function prepare(array $previous, array $target, array $overrides): array
    {
        $api = app(Templates::class);
        $group = $api->createGroup('comparison', 'Comparison');
        $api->publishGroup($group->id, $previous, 0);
        $template = $api->createTemplate('comparison-variant', 'Variant', $group->id);
        $source = Documents::variant($group->id, 1, 'Local');
        $source['source']['overrides'] = $overrides;
        $api->saveDraft($template->id, $source, 0);
        $api->publishGroup($group->id, $target, 1);
        $life = app(FamilyLifecycle::class);
        $checksum = CanonicalJson::hash($source);

        return [$life, $template, $checksum, $life->prepare($template->id, 'rebase', ['groupId' => $group->id, 'revision' => 2], 1, $checksum, $this->actor())];
    }

    public function test_comparison_keeps_exact_family_and_local_values_when_choices_change(): void
    {
        $previous = Documents::standalone('Original family');
        $target = Documents::standalone('Target family');
        $target['settingsDefaults']['fontSize'] = 20;
        $target['exposedInputs'] = [];
        [$life, $template, $checksum, $candidate] = $this->prepare($previous, $target, ['content' => ['headline' => 'Local copy'], 'settingsDefaults' => ['fontSize' => 18], 'exposedInputs' => ['message']]);

        $conflicts = array_column($candidate['conflicts'], null, 'id');
        self::assertArrayHasKey('comparison', $conflicts['content.headline']);
        $comparison = $conflicts['content.headline']['comparison'];
        self::assertSame('value', $comparison['kind']);
        self::assertSame('Original family', $comparison['previous']['preview']);
        self::assertSame('Local copy', $comparison['local']['preview']);
        self::assertSame('Target family', $comparison['target']['preview']);
        self::assertSame('16', $conflicts['settingsDefaults.fontSize']['comparison']['previous']['preview']);
        self::assertSame('18', $conflicts['settingsDefaults.fontSize']['comparison']['local']['preview']);
        self::assertSame('20', $conflicts['settingsDefaults.fontSize']['comparison']['target']['preview']);
        $capabilities = $conflicts['exposedInputs']['comparison'];
        self::assertSame('capabilities', $capabilities['kind']);
        self::assertSame('["message"]', $capabilities['previous']['preview']);
        self::assertSame('["message"]', $capabilities['local']['preview']);
        self::assertSame('[]', $capabilities['target']['preview']);

        foreach (['local' => 'Local copy', 'family' => 'Target family'] as $choice => $expected) {
            $review = $life->review($template->id, $candidate['id'], ['content.headline' => $choice, 'settingsDefaults.fontSize' => 'family', 'exposedInputs' => 'family'], 1, $checksum, $this->actor());
            self::assertSame($expected, $review['document']['content']->headline);
            self::assertSame($comparison, array_column($review['conflicts'], null, 'id')['content.headline']['comparison']);
        }
    }

    public static function scalarValues(): array
    {
        return [
            'null' => [null, 'null', 'null'],
            'zero' => [0, 'number', '0'],
            'false' => [false, 'boolean', 'false'],
            'empty string' => ['', 'string', ''],
            'list' => [[0, false], 'array', '[0,false]'],
            'object' => [['enabled' => false], 'object', '{"enabled":false}'],
        ];
    }

    #[DataProvider('scalarValues')]
    public function test_comparison_preserves_falsy_and_typed_local_values(mixed $value, string $type, string $preview): void
    {
        $previous = $target = Documents::standalone();
        $previous['dataSchema']['properties']['content']['properties']['sample'] = $target['dataSchema']['properties']['content']['properties']['sample'] = ['type' => ['null', 'number', 'boolean', 'string', 'array', 'object']];
        $previous['content']['sample'] = 'Previous';
        $target['content']['sample'] = 'Target';
        [, , , $candidate] = $this->prepare($previous, $target, ['content' => ['sample' => $value]]);
        $conflict = array_column($candidate['conflicts'], null, 'id')['content.sample'];
        self::assertArrayHasKey('comparison', $conflict);
        $local = $conflict['comparison']['local'];

        self::assertTrue($local['present']);
        self::assertSame($type, $local['type']);
        self::assertSame($preview, $local['preview']);
        self::assertFalse($local['truncated']);
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/D', $local['checksum']);
    }

    public function test_comparison_distinguishes_missing_family_values_from_null(): void
    {
        $previous = $target = Documents::standalone();
        $previous['content']['sample'] = null;
        $previous['dataSchema']['properties']['content']['properties']['sample'] = ['type' => ['null', 'string']];
        [, , , $candidate] = $this->prepare($previous, $target, ['content' => ['sample' => null]]);
        $conflict = array_column($candidate['conflicts'], null, 'id')['content.sample'];
        self::assertArrayHasKey('comparison', $conflict);
        $comparison = $conflict['comparison'];

        self::assertSame(['present' => false, 'type' => 'missing', 'preview' => '', 'truncated' => false], $comparison['target']);
        self::assertTrue($comparison['previous']['present']);
        self::assertSame('null', $comparison['previous']['type']);
        self::assertSame('null', $comparison['local']['type']);
    }

    public static function objectValues(): array
    {
        return [
            'empty content object' => ['content', 'content', [], '{}'],
            'numeric-key content object' => ['content', 'content', ['numeric'], '{"0":"numeric"}'],
            'empty settings object' => ['settingsDefaults', 'settings', [], '{}'],
            'numeric-key settings object' => ['settingsDefaults', 'settings', ['numeric'], '{"0":"numeric"}'],
        ];
    }

    #[DataProvider('objectValues')]
    public function test_schema_declared_object_comparisons_match_the_authoritative_wire_shape(string $namespace, string $schemaNamespace, array $local, string $preview): void
    {
        $previous = $target = Documents::standalone();
        $schema = ['type' => 'object', 'additionalProperties' => ['type' => ['string', 'boolean']]];
        $previous['dataSchema']['properties'][$schemaNamespace]['properties']['sample'] = $target['dataSchema']['properties'][$schemaNamespace]['properties']['sample'] = $schema;
        $previous[$namespace]['sample'] = [];
        $target[$namespace]['sample'] = ['enabled' => false];
        [, , , $candidate] = $this->prepare($previous, $target, [$namespace => ['sample' => $local]]);
        $comparison = array_column($candidate['conflicts'], null, 'id')[$namespace.'.sample']['comparison'];

        self::assertIsObject($candidate['document'][$namespace]->sample);
        self::assertSame('{}', $comparison['previous']['preview']);
        self::assertSame('object', $comparison['previous']['type']);
        self::assertSame(hash('sha256', '[{}]'), $comparison['previous']['checksum']);
        self::assertSame($preview, $comparison['local']['preview']);
        self::assertSame('object', $comparison['local']['type']);
        self::assertSame(json_encode($candidate['document'][$namespace]->sample, JSON_THROW_ON_ERROR), $comparison['local']['preview']);
        self::assertSame('{"enabled":false}', $comparison['target']['preview']);
        self::assertSame('object', $comparison['target']['type']);
    }

    public function test_comparison_bounds_unicode_previews_per_value_and_across_the_plan(): void
    {
        $previous = $target = Documents::standalone();
        $overrides = ['content' => []];
        foreach (range(1, 24) as $index) {
            $key = 'copy'.$index;
            $previous['content'][$key] = str_repeat('🌍', 700).' previous';
            $target['content'][$key] = str_repeat('🌎', 700).' target';
            $overrides['content'][$key] = str_repeat('🌏', 700).' local';
            $previous['dataSchema']['properties']['content']['properties'][$key] = $target['dataSchema']['properties']['content']['properties'][$key] = ['type' => 'string'];
        }
        [, , , $candidate] = $this->prepare($previous, $target, $overrides);
        $bytes = 0;
        $emptyTruncated = false;
        foreach ($candidate['conflicts'] as $conflict) {
            self::assertArrayHasKey('comparison', $conflict);
            foreach (['previous', 'local', 'target'] as $side) {
                $snapshot = $conflict['comparison'][$side];
                self::assertLessThanOrEqual(2048, strlen($snapshot['preview']));
                self::assertTrue(mb_check_encoding($snapshot['preview'], 'UTF-8'));
                self::assertTrue($snapshot['truncated']);
                self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/D', $snapshot['checksum']);
                $bytes += strlen($snapshot['preview']);
                $emptyTruncated = $emptyTruncated || $snapshot['preview'] === '';
            }
        }
        self::assertLessThanOrEqual(32768, $bytes);
        self::assertGreaterThan(0, $bytes);
        self::assertTrue($emptyTruncated);
        self::assertStringStartsWith('🌍', $candidate['conflicts'][0]['comparison']['previous']['preview']);
        self::assertNotSame($candidate['conflicts'][0]['comparison']['previous']['checksum'], $candidate['conflicts'][0]['comparison']['local']['checksum']);
    }

    public function test_structural_comparison_uses_the_exact_point_bases_and_local_patch(): void
    {
        $previous = $target = Documents::standalone();
        $point = ['id' => 'headingName', 'label' => 'Heading name', 'kind' => 'node-property', 'nodeId' => 'heading', 'property' => 'name', 'schema' => ['type' => 'string']];
        $previous['variationPoints'] = $target['variationPoints'] = [$point];
        $target['source']['definition']['nodes']['heading']['name'] = 'Target heading';
        [$life, $template, $checksum, $candidate] = $this->prepare($previous, $target, ['variations' => ['headingName' => ['kind' => 'node-property', 'value' => 'Local heading']]]);
        $conflict = array_column($candidate['conflicts'], null, 'id')['variations.headingName'];
        self::assertArrayHasKey('comparison', $conflict);
        $comparison = $conflict['comparison'];

        self::assertSame('structure', $comparison['kind']);
        self::assertSame([$point, 'Heading'], json_decode($comparison['previous']['preview'], true, flags: JSON_THROW_ON_ERROR));
        self::assertSame(['kind' => 'node-property', 'value' => 'Local heading'], json_decode($comparison['local']['preview'], true, flags: JSON_THROW_ON_ERROR));
        self::assertSame([$point, 'Target heading'], json_decode($comparison['target']['preview'], true, flags: JSON_THROW_ON_ERROR));
        self::assertArrayHasKey('values', $comparison);
        self::assertSame('Heading', $comparison['values']['previous']['preview']);
        self::assertSame('Local heading', $comparison['values']['local']['preview']);
        self::assertSame('Target heading', $comparison['values']['target']['preview']);
        foreach (['local', 'family'] as $choice) {
            $review = $life->review($template->id, $candidate['id'], ['variations.headingName' => $choice], 1, $checksum, $this->actor());
            self::assertSame($comparison['values'], $review['conflicts'][0]['comparison']['values']);
        }
    }

    public function test_property_values_precede_large_point_diagnostics_within_the_shared_budget(): void
    {
        $previous = $target = Documents::standalone();
        $schema = ['type' => 'string', 'enum' => ['Heading', 'Local heading', 'Target heading', str_repeat('λ', 20000)]];
        $overrides = ['variations' => []];
        foreach (range(1, 8) as $index) {
            $node = $previous['source']['definition']['nodes']['heading'];
            $node['id'] = 'heading'.$index;
            $previous['source']['definition']['nodes'][$node['id']] = $node;
            $target['source']['definition']['nodes'][$node['id']] = array_replace($node, ['name' => 'Target heading']);
            $previous['source']['definition']['roots'][] = $target['source']['definition']['roots'][] = $node['id'];
            $point = ['id' => 'headingName'.$index, 'label' => 'Heading name', 'kind' => 'node-property', 'nodeId' => $node['id'], 'property' => 'name', 'schema' => $schema];
            $previous['variationPoints'][] = $target['variationPoints'][] = $point;
            $overrides['variations'][$point['id']] = ['kind' => 'node-property', 'value' => 'Local heading'];
        }
        [, , , $candidate] = $this->prepare($previous, $target, $overrides);
        $comparison = $candidate['conflicts'][0]['comparison'];
        self::assertArrayHasKey('values', $comparison);
        self::assertSame('Heading', $comparison['values']['previous']['preview']);
        self::assertSame('Local heading', $comparison['values']['local']['preview']);
        self::assertSame('Target heading', $comparison['values']['target']['preview']);
        $bytes = 0;
        foreach (['previous', 'local', 'target'] as $side) {
            self::assertFalse($comparison['values'][$side]['truncated']);
            self::assertLessThanOrEqual(2048, strlen($comparison[$side]['preview']));
        }
        foreach ($candidate['conflicts'] as $conflict) {
            foreach (['previous', 'local', 'target'] as $side) {
                $bytes += strlen($conflict['comparison'][$side]['preview']) + strlen($conflict['comparison']['values'][$side]['preview']);
            }
        }
        self::assertTrue($comparison['previous']['truncated']);
        self::assertTrue($comparison['target']['truncated']);
        self::assertLessThanOrEqual(32768, $bytes);
        self::assertTrue($candidate['conflicts'][7]['comparison']['target']['truncated']);
        self::assertLessThan(2048, strlen($candidate['conflicts'][7]['comparison']['target']['preview']));
    }

    public function test_style_values_preserve_removal_and_point_removal_is_missing(): void
    {
        $previous = $target = Documents::standalone();
        $previous['source']['definition']['nodes']['container'] = ['id' => 'container', 'name' => 'Container', 'kind' => 'element', 'tag' => 'div', 'attributes' => [], 'attributeBindings' => [], 'style' => ['color' => 'red'], 'classes' => [], 'children' => ['heading'], 'permissions' => ['content' => false, 'style' => false]];
        $previous['source']['definition']['roots'] = ['container'];
        $previous['variationPoints'] = [['id' => 'color', 'label' => 'Color', 'kind' => 'node-style', 'nodeId' => 'container', 'property' => 'color', 'schema' => ['type' => 'string']]];
        $target = $previous;
        $target['source']['definition']['nodes']['container']['style'] = [];
        $target['variationPoints'] = [];
        [, , , $candidate] = $this->prepare($previous, $target, ['variations' => ['color' => ['kind' => 'node-style', 'value' => null]]]);
        $comparison = $candidate['conflicts'][0]['comparison'];
        self::assertArrayHasKey('values', $comparison);
        self::assertSame('red', $comparison['values']['previous']['preview']);
        self::assertSame('null', $comparison['values']['local']['type']);
        self::assertTrue($comparison['values']['local']['present']);
        self::assertFalse($comparison['values']['target']['present']);
        self::assertSame('missing', $comparison['values']['target']['type']);
    }

    private function blockFamily(): array
    {
        $fixture = json_decode(file_get_contents(__DIR__.'/../Support/Contracts/family-structure.v1.json'), true, 64, JSON_THROW_ON_ERROR)['base'];
        $base = Documents::standalone();
        $base['source']['definition'] = $fixture['source']['definition'];
        $base['variationPoints'] = array_values(array_filter($fixture['variationPoints'], fn (array $point) => in_array($point['id'], ['caption', 'body'], true)));

        return $base;
    }

    public static function blockPropertyValues(): array
    {
        return [
            'zero default and literal' => ['number', true, 0, 0, '0', '{"source":"literal","value":0}'],
            'false default and literal' => ['boolean', true, false, false, 'false', '{"source":"literal","value":false}'],
            'empty default and literal' => ['string', true, '', '', '', '{"source":"literal","value":""}'],
            'missing default' => ['string', false, null, '', '', '{"source":"literal","value":""}'],
        ];
    }

    #[DataProvider('blockPropertyValues')]
    public function test_block_property_values_project_raw_default_or_binding_without_interpolation(string $type, bool $hasDefault, mixed $default, mixed $local, string $previousPreview, string $localPreview): void
    {
        $previous = $this->blockFamily();
        unset($previous['source']['definition']['nodes']['card']['props']['caption']);
        $previous['source']['definition']['blocks'][0]['props']['caption'] = ['type' => $type];
        $previous['source']['definition']['blocks'][0]['requiredProps'] = [];
        if ($hasDefault) {
            $previous['source']['definition']['blocks'][0]['propertyMetadata'] = ['caption' => ['label' => 'Caption', 'description' => '', 'defaultValue' => $default]];
        }
        $target = $previous;
        $targetValue = match ($type) {
            'number' => 1, 'boolean' => true, default => 'Target'
        };
        $target['source']['definition']['nodes']['card']['props']['caption'] = ['source' => 'literal', 'value' => $targetValue];
        [, , , $candidate] = $this->prepare($previous, $target, ['variations' => ['caption' => ['kind' => 'block-property', 'value' => ['source' => 'literal', 'value' => $local]]]]);
        $comparison = $candidate['conflicts'][0]['comparison'];
        self::assertArrayHasKey('values', $comparison);
        self::assertSame($hasDefault, $comparison['values']['previous']['present']);
        self::assertSame($previousPreview, $comparison['values']['previous']['preview']);
        self::assertSame($localPreview, $comparison['values']['local']['preview']);
        self::assertSame(json_encode(['source' => 'literal', 'value' => $targetValue], JSON_THROW_ON_ERROR), $comparison['values']['target']['preview']);
    }

    public function test_region_comparisons_omit_focused_property_values(): void
    {
        $previous = $this->blockFamily();
        $target = $previous;
        $target['source']['definition']['nodes']['card']['slots']['body'] = [];
        [, , , $candidate] = $this->prepare($previous, $target, ['variations' => ['body' => ['kind' => 'children', 'order' => []]]]);
        self::assertArrayNotHasKey('values', $candidate['conflicts'][0]['comparison']);
    }

    public function test_block_property_literal_objects_retain_the_declared_wire_shape(): void
    {
        $previous = $this->blockFamily();
        $previous['source']['definition']['blocks'][0]['props']['caption'] = ['type' => 'object', 'properties' => ['enabled' => ['type' => 'boolean']], 'additionalProperties' => false];
        $previous['source']['definition']['nodes']['card']['props']['caption'] = ['source' => 'literal', 'value' => []];
        $target = $previous;
        $target['source']['definition']['nodes']['card']['props']['caption']['value'] = ['enabled' => false];
        [, , , $candidate] = $this->prepare($previous, $target, ['variations' => ['caption' => ['kind' => 'block-property', 'value' => ['source' => 'literal', 'value' => []]]]]);
        $values = $candidate['conflicts'][0]['comparison']['values'];
        self::assertSame('{"source":"literal","value":{}}', $values['previous']['preview']);
        self::assertSame('{"source":"literal","value":{}}', $values['local']['preview']);
        self::assertSame('{"source":"literal","value":{"enabled":false}}', $values['target']['preview']);
    }

    public function test_block_property_field_bindings_remain_raw_in_focused_values(): void
    {
        $previous = $this->blockFamily();
        $previous['source']['definition']['fields'][] = ['id' => 'copy', 'path' => 'content.headline', 'label' => 'Copy', 'schema' => ['type' => 'string'], 'required' => false, 'editable' => false, 'description' => ''];
        $target = $previous;
        $target['source']['definition']['nodes']['card']['props']['caption'] = ['source' => 'field', 'fieldId' => 'copy'];
        [, , , $candidate] = $this->prepare($previous, $target, ['variations' => ['caption' => ['kind' => 'block-property', 'value' => ['source' => 'literal', 'value' => 'Local']]]]);
        self::assertSame('{"source":"field","fieldId":"copy"}', $candidate['conflicts'][0]['comparison']['values']['target']['preview']);
    }

    public function test_unavailable_current_resources_omit_all_comparisons_without_leaking_the_body(): void
    {
        $api = app(Templates::class);
        $resource = $api->createResource('private', 'Private', 'content');
        $api->publishResource($resource->id, ['value' => 'Revoked secret body'], 0);
        $previous = Documents::standalone();
        $previous['variationPoints'] = [['id' => 'headingName', 'label' => 'Heading name', 'kind' => 'node-property', 'nodeId' => 'heading', 'property' => 'name', 'schema' => ['type' => 'string']]];
        $previous['content']['headline'] = ['kind' => 'content', 'resourceId' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $group = $api->createGroup('revoked', 'Revoked');
        $api->publishGroup($group->id, $previous, 0);
        $template = $api->createTemplate('revoked-variant', 'Variant', $group->id);
        $source = Documents::variant($group->id, 1, 'Local');
        $source['source']['overrides'] = ['settingsDefaults' => ['fontSize' => 18], 'variations' => ['headingName' => ['kind' => 'node-property', 'value' => 'Local heading']]];
        $api->saveDraft($template->id, $source, 0);
        $target = Documents::standalone('Authorized target');
        $target['variationPoints'] = $previous['variationPoints'];
        $target['source']['definition']['nodes']['heading']['name'] = 'Target heading';
        $target['settingsDefaults']['fontSize'] = 20;
        $api->publishGroup($group->id, $target, 1);
        Gate::define('templates.read', fn (?Authenticatable $user, $record = null) => ! ($record instanceof TemplateResource && $record->id === $resource->id));
        $life = app(FamilyLifecycle::class);
        $candidate = $life->prepare($template->id, 'upgrade', ['groupId' => $group->id, 'revision' => 2], 1, CanonicalJson::hash($source), $this->actor());

        self::assertContains('settingsDefaults.fontSize', array_column($candidate['conflicts'], 'id'));
        foreach ($candidate['conflicts'] as $conflict) {
            self::assertArrayNotHasKey('comparison', $conflict);
        }
        self::assertStringNotContainsString('Revoked secret body', json_encode($candidate, JSON_THROW_ON_ERROR));
    }

    public function test_stored_comparison_reads_recheck_resource_grants_after_revocation(): void
    {
        $api = app(Templates::class);
        $resource = $api->createResource('review-grant', 'Review grant', 'content');
        $api->publishResource($resource->id, ['value' => 'Authorized body'], 0);
        $previous = Documents::standalone('Previous');
        $previous['dependencies'] = [['resourceId' => $resource->id, 'revision' => 1]];
        $target = $previous;
        $target['content']['headline'] = 'Target';
        [$life, $template, , $candidate] = $this->prepare($previous, $target, ['content' => ['headline' => 'Local']]);
        self::assertArrayHasKey('comparison', $candidate['conflicts'][0]);
        Gate::define('templates.read', fn (?Authenticatable $user, $record = null) => ! ($record instanceof TemplateResource && $record->id === $resource->id));

        self::assertSame([], $life->listing($template->id, $this->actor()));
        $this->expectException(AuthorizationException::class);
        $life->get($template->id, $candidate['id'], $this->actor());
    }
}
