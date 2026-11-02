<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Drivers\Compiler\LocalNodeCompiler;
use Nvl\Templates\Services\DocumentValidator;
use Nvl\Templates\Services\RuntimeDataResolver;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class PublicationValidationTest extends TestCase
{
    public function test_partial_nested_defaults_allow_an_exposed_required_sibling_to_be_supplied(): void
    {
        $document = $this->nestedDocument();
        app(DocumentValidator::class)->publication($document);
        $data = app(RuntimeDataResolver::class)->resolve($document, ['code' => 'ABC'], [], ['action' => ['value' => 'Open']], []);

        self::assertEquals(['value' => 'Open', 'link' => 'https://example.com'], $data['inputs']['action']);
    }

    public function test_partial_nested_defaults_still_reject_a_missing_hidden_required_sibling(): void
    {
        $document = $this->nestedDocument();
        $document['inputDefaults'] = ['action' => []];
        $this->expectException(ValidationException::class);
        app(DocumentValidator::class)->publication($document);
    }

    public function test_partial_defaults_still_validate_the_values_that_are_present(): void
    {
        $document = $this->nestedDocument();
        $document['inputDefaults']['action']['link'] = 123;
        $this->expectException(ValidationException::class);
        app(DocumentValidator::class)->publication($document);
    }

    public function test_hidden_array_item_defaults_cannot_omit_required_properties(): void
    {
        $document = Documents::standalone();
        $document['dataSchema']['properties']['inputs']['properties']['rows'] = [
            'type' => 'array', 'items' => [
                'type' => 'object', 'properties' => ['label' => ['type' => 'string'], 'hidden' => ['type' => 'string']],
                'required' => ['label', 'hidden'], 'additionalProperties' => false,
            ],
        ];
        $document['inputDefaults']['rows'] = [['label' => 'A row']];
        $this->expectException(ValidationException::class);
        app(DocumentValidator::class)->publication($document);
    }

    public function test_exposed_arrays_can_supply_complete_items_at_runtime(): void
    {
        $document = Documents::standalone();
        $document['dataSchema']['properties']['inputs']['properties']['rows'] = [
            'type' => 'array', 'items' => [
                'type' => 'object', 'properties' => ['label' => ['type' => 'string']],
                'required' => ['label'], 'additionalProperties' => false,
            ],
        ];
        $document['inputDefaults']['rows'] = [[]];
        $document['exposedInputs'][] = 'rows';
        app(DocumentValidator::class)->publication($document);
        $data = app(RuntimeDataResolver::class)->resolve($document, ['code' => 'ABC'], [], ['rows' => [['label' => 'A row']]], []);

        self::assertSame([['label' => 'A row']], $data['inputs']['rows']);
    }

    public function test_a_bound_optional_hidden_input_needs_a_default(): void
    {
        $document = Documents::standalone();
        $document['inputDefaults'] = [];
        $document['exposedInputs'] = [];
        $this->expectException(ValidationException::class);
        app(DocumentValidator::class)->publication($document);
    }

    public function test_a_bound_optional_content_path_needs_a_published_value(): void
    {
        $document = Documents::standalone();
        $document['content'] = [];
        $document['dataSchema']['properties']['content']['required'] = [];
        $this->expectException(ValidationException::class);
        app(DocumentValidator::class)->publication($document);
    }

    public function test_a_bound_optional_exposed_input_can_be_supplied_at_runtime(): void
    {
        $document = Documents::standalone();
        $document['inputDefaults'] = [];
        app(DocumentValidator::class)->publication($document);
        $data = app(RuntimeDataResolver::class)->resolve($document, ['code' => 'ABC'], [], ['message' => 'Supplied'], []);

        self::assertSame('Supplied', $data['inputs']['message']);
    }

    public function test_a_bound_optional_fact_can_be_supplied_by_the_host(): void
    {
        $document = Documents::standalone();
        $document['dataSchema']['properties']['facts']['required'] = [];
        app(DocumentValidator::class)->publication($document);
        $data = app(RuntimeDataResolver::class)->resolve($document, ['code' => 'HOST'], [], [], []);

        self::assertSame('HOST', $data['facts']['code']);
    }

    public function test_the_generated_settings_contract_and_schema_only_hidden_options_remain_valid(): void
    {
        $document = $this->settingsDocument();
        $document['dataSchema']['properties']['settings']['properties']['showLogo'] = ['type' => 'boolean'];
        $document['settingsDefaults']['showLogo'] = true;
        app(DocumentValidator::class)->publication($document);

        self::assertSame(16, $document['settingsDefaults']['textSize']);
    }

    #[DataProvider('invalidSettingsContracts')]
    public function test_settings_contracts_are_enforced_before_publication(string $failure): void
    {
        $document = $this->settingsDocument();
        switch ($failure) {
            case 'duplicate id':
                $document['settingsSpec'][] = $document['settingsSpec'][0];
                break;
            case 'schema mismatch':
                $document['settingsSpec'][0]['schema']['maximum'] = 30;
                break;
            case 'invalid spec default':
                $document['settingsSpec'][0]['defaultValue'] = 30;
                break;
            case 'widened exposure':
                $document['settingsSpec'][0]['exposed'] = false;
                break;
            case 'exposed schema-only setting':
                $document['dataSchema']['properties']['settings']['properties']['hidden'] = ['type' => 'boolean'];
                $document['settingsDefaults']['hidden'] = true;
                $document['exposedSettings'][] = 'hidden';
                break;
            case 'missing target':
                $document['settingsSpec'][0]['targets'][0]['nodeId'] = 'missing';
                break;
            case 'text target':
                $document['settingsSpec'][0]['targets'][0]['nodeId'] = 'copy';
                break;
            case 'unsupported property':
                $document['settingsSpec'][0]['targets'][0]['property'] = 'display';
                break;
            case 'unsupported unit':
                $document['settingsSpec'][0]['unit'] = 'em';
                break;
            case 'incompatible formatted default':
                $document['settingsSpec'][0]['targets'][0]['property'] = 'color';
                break;
            case 'incompatible published override':
                $schema = ['type' => 'string', 'enum' => ['12px', 'red']];
                $document['settingsSpec'][0]['schema'] = $schema;
                $document['dataSchema']['properties']['settings']['properties']['textSize'] = $schema;
                $document['settingsSpec'][0]['defaultValue'] = '12px';
                $document['settingsSpec'][0]['unit'] = '';
                $document['settingsDefaults']['textSize'] = 'red';
                break;
        }
        $this->expectException(ValidationException::class);
        app(DocumentValidator::class)->publication($document);
    }

    public static function invalidSettingsContracts(): iterable
    {
        foreach (['duplicate id', 'schema mismatch', 'invalid spec default', 'widened exposure', 'exposed schema-only setting', 'missing target', 'text target', 'unsupported property', 'unsupported unit', 'incompatible formatted default', 'incompatible published override'] as $failure) {
            yield $failure => [$failure];
        }
    }

    private function nestedDocument(): array
    {
        $document = Documents::standalone();
        $document['dataSchema']['properties']['inputs'] = [
            'type' => 'object', 'properties' => ['action' => [
                'type' => 'object', 'properties' => ['value' => ['type' => 'string'], 'link' => ['type' => 'string']],
                'required' => ['value', 'link'], 'additionalProperties' => false,
            ]], 'required' => ['action'], 'additionalProperties' => false,
        ];
        $document['inputDefaults'] = ['action' => ['link' => 'https://example.com']];
        $document['exposedInputs'] = ['action.value'];
        $document['artifacts']['bindings'][1]['path'] = 'inputs.action.value';

        return $document;
    }

    private function settingsDocument(): array
    {
        config()->set('nvl-templates.compiler.driver', LocalNodeCompiler::class);
        config()->set('nvl-templates.compiler.command', ['node', dirname(__DIR__, 2).'/resources/runtime/renderer.mjs']);

        return json_decode(file_get_contents(__DIR__.'/../Support/Fixtures/shared.json'), true, 64, JSON_THROW_ON_ERROR);
    }

    #[DataProvider('malformedPublicationContainers')]
    public function test_malformed_publication_containers_fail_with_validation_errors(string $path, mixed $value): void
    {
        $document = Documents::standalone();
        data_set($document, $path, $value);

        $this->expectException(ValidationException::class);
        app(DocumentValidator::class)->publication($document);
    }

    public static function malformedPublicationContainers(): iterable
    {
        yield 'scalar exposed controls' => ['exposedInputs', 'message'];
        yield 'scalar runtime properties' => ['dataSchema.properties', true];
        yield 'scalar defaults' => ['inputDefaults', 'invalid'];
        yield 'scalar bindings' => ['artifacts.bindings', 'invalid'];
        yield 'non-string compiled HTML' => ['artifacts.html', false];
    }
}
