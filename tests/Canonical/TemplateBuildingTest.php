<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Nvl\Templates\Drivers\Compiler\LocalNodeCompiler;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;

final class TemplateBuildingTest extends TestCase
{
    use RefreshDatabase;

    public function test_column_presets_and_separate_action_values_render_from_the_real_fixed_export(): void
    {
        $api = app(Templates::class);
        $template = $api->createTemplate('columns', 'Column template');
        $draft = $api->saveDraft($template->id, $this->fixture('building-columns'), 0);
        $release = $api->publish($template->id, $draft->version);
        $output = $api->render($release->id, inputs: ['message' => '<Gift>', 'action' => ['value' => 'Book <now>', 'link' => 'https://example.com/book?a=1&b=2']]);
        self::assertStringContainsString('role="presentation"', $output->html);
        self::assertStringContainsString('width:30%', $output->html);
        self::assertStringContainsString('width:70%', $output->html);
        self::assertStringContainsString('Book &lt;now&gt;', $output->html);
        self::assertStringContainsString('href="https://example.com/book?a=1&amp;b=2"', $output->html);
        self::assertStringContainsString('&lt;Gift&gt;', $output->html);
    }

    public function test_grouped_column_layouts_and_nested_primitive_repeaters_use_the_built_compiler(): void
    {
        $root = dirname(__DIR__, 4);
        config()->set('nvl-templates.compiler.driver', LocalNodeCompiler::class);
        config()->set('nvl-templates.compiler.command', ['node', dirname(__DIR__, 2).'/resources/runtime/renderer.mjs']);
        $api = app(Templates::class);
        $group = $api->createGroup('repeating', 'Repeating family');
        $api->publishGroup($group->id, $this->fixture('building-repeats'), 0);
        $template = $api->createTemplate('repeating-variant', 'Repeating variant', $group->id);
        $draft = $api->saveDraft($template->id, ['format' => 'template-document', 'schemaVersion' => 1, 'target' => 'email', 'source' => ['mode' => 'group-variant', 'group' => ['id' => $group->id, 'revision' => 1], 'overrides' => []]], 0);
        $release = $api->publish($template->id, $draft->version);
        $output = $api->render($release->id, facts: ['items' => [['name' => 'First', 'tags' => ['<One>', 'Two']], ['name' => 'Second', 'tags' => []]]]);
        self::assertStringContainsString('First&lt;One&gt;TwoSecond', $output->html);
        self::assertStringContainsString('width:30%', $output->html);
        self::assertStringContainsString('width:70%', $output->html);
        self::assertStringNotContainsString('Preview', $output->html);
    }

    private function fixture(string $name): array
    {
        return json_decode(file_get_contents(__DIR__.'/../Support/Fixtures/'.$name.'.json'), true, 64, JSON_THROW_ON_ERROR);
    }
}
