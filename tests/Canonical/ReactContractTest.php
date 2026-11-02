<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Nvl\Templates\Drivers\Compiler\LocalNodeCompiler;
use Nvl\Templates\Rendering\RenderedDocument as RenderResult;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;

final class ReactContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_real_react_export_publishes_and_renders_using_php_bindings(): void
    {
        $result = $this->renderFixture('bindings');
        self::assertStringContainsString('ABC', $result->html);
        self::assertSame('Experience voucher', $result->subject);
        self::assertSame('Your voucher is ready.', $result->text);
        self::assertStringContainsString('&lt;Actual&gt;', $result->html);
        self::assertStringContainsString('font-size:20px', $result->html);
    }

    public function test_the_real_structural_export_uses_the_same_built_js_compiler_via_stdin(): void
    {
        self::assertFileExists(dirname(__DIR__, 2).'/resources/runtime/renderer.mjs');
        config()->set('nvl-templates.compiler.driver', LocalNodeCompiler::class);
        config()->set('nvl-templates.compiler.command', ['node', dirname(__DIR__, 2).'/resources/runtime/renderer.mjs']);
        $result = $this->renderFixture('shared');
        self::assertStringContainsString('ABC', $result->html);
        self::assertSame('Experience voucher', $result->subject);
        self::assertSame('Your voucher is ready.', $result->text);
        self::assertStringContainsString('&lt;Actual&gt;', $result->html);
        self::assertStringContainsString('font-size:20px', $result->html);
    }

    private function renderFixture(string $engine): RenderResult
    {
        $document = json_decode(file_get_contents(__DIR__.'/../Support/Fixtures/'.$engine.'.json'), true, 64, JSON_THROW_ON_ERROR);
        $api = app(Templates::class);
        $template = $api->createTemplate($engine, ucfirst($engine));
        $draft = $api->saveDraft($template->id, $document, 0);
        $release = $api->publish($template->id, $draft->version);

        return $api->render($release->id, facts: ['code' => 'ABC'], inputs: ['message' => '<Actual>'], settings: ['textSize' => 20]);
    }
}
