<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Nvl\Templates\Drivers\Compiler\LocalNodeCompiler;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;

final class CompilerLiteralContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_shared_worker_preserves_literal_tokens_and_optional_attributes_with_intentional_sidecar_bindings(): void
    {
        $root = dirname(__DIR__, 4);
        config()->set('nvl-templates.compiler.driver', LocalNodeCompiler::class);
        config()->set('nvl-templates.compiler.command', ['node', dirname(__DIR__, 2).'/resources/runtime/renderer.mjs']);
        $document = json_decode(file_get_contents(__DIR__.'/../Support/Fixtures/bindings.json'), true, 64, JSON_THROW_ON_ERROR);
        $document['rendering']['engine'] = $document['artifacts']['engine'] = 'shared';
        $document['artifacts']['html'] = $document['artifacts']['css'] = '';
        foreach (['rendering', 'artifacts'] as $key) {
            $document[$key]['subject'] = 'Subject {{b_message}}';
            $document[$key]['text'] = 'Plain {{b_message}}';
        }
        $document['source']['definition']['nodes']['message']['tag'] = 'a';
        $document['source']['definition']['nodes']['message']['attributes']['href'] = 'https://example.com/fallback';
        $document['source']['definition']['nodes']['message']['attributeBindings']['href'] = ['source' => 'field', 'fieldId' => 'destination'];
        $document['source']['definition']['fields'][] = ['id' => 'destination', 'path' => 'inputs.destination', 'label' => 'Destination', 'description' => '', 'schema' => ['type' => 'string', 'format' => 'uri'], 'required' => false, 'editable' => true];
        $document['dataSchema']['properties']['inputs']['properties']['destination'] = ['type' => 'string', 'format' => 'uri'];
        $document['exposedInputs'][] = 'destination';
        array_unshift($document['source']['definition']['nodes']['copy']['parts'],
            ['value' => ['source' => 'literal', 'value' => '{{b_'], 'format' => 'text', 'currency' => 'EUR'],
            ['value' => ['source' => 'literal', 'value' => 'message}}: '], 'format' => 'text', 'currency' => 'EUR'],
        );
        $api = app(Templates::class);
        $template = $api->createTemplate('literal-contract', 'Literal contract');
        $draft = $api->saveDraft($template->id, $document, 0);
        $release = $api->publish($template->id, $draft->version);

        $absent = $api->render($release->id, facts: ['code' => 'ABC'], inputs: ['message' => 'Actual <message>']);
        self::assertStringContainsString('href="https://example.com/fallback"', $absent->html);
        self::assertStringContainsString('{{b_message}}: ABC — Actual &lt;message&gt;', $absent->html);
        self::assertSame('Subject Actual <message>', $absent->subject);
        self::assertSame('Plain Actual <message>', $absent->text);
        $present = $api->render($release->id, facts: ['code' => 'ABC'], inputs: ['message' => 'Other', 'destination' => 'https://example.com/actual']);
        self::assertStringContainsString('href="https://example.com/actual"', $present->html);
        self::assertStringContainsString('{{b_message}}: ABC — Other', $present->html);
    }
}
