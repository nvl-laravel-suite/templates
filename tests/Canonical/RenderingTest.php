<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class RenderingTest extends TestCase
{
    use RefreshDatabase;

    private function release(array $document = []): array
    {
        $api = app(Templates::class);
        $t = $api->createTemplate('test', 'Test');
        $draft = $api->saveDraft($t->id, $document ?: Documents::standalone(), 0);

        return [$api, $api->publish($t->id, $draft->version)];
    }

    public function test_rendering_binds_once_escapes_content_and_resolves_typed_settings(): void
    {
        [$api, $release] = $this->release();
        self::assertTrue(method_exists($api, 'render'), 'The render pipeline must exist.');
        $output = $api->render($release->id, facts: ['code' => 'ABC'], inputs: ['message' => '<b>{{code}}</b>'], settings: ['fontSize' => 20]);
        self::assertStringContainsString('&lt;b&gt;{{code}}&lt;/b&gt;', $output->html);
        self::assertStringContainsString('font-size:20px', $output->html);
        self::assertStringContainsString('<b>ABC</b>', $output->html);
        self::assertSame('An experience for you', $output->subject);
        self::assertSame('<b>{{code}}</b> — ABC', $output->text);
    }

    #[DataProvider('booleanRuntimeValues')]
    public function test_boolean_runtime_bindings_render_as_text_in_html_subject_and_plain_text(bool $value, string $expected): void
    {
        $doc = Documents::standalone();
        $doc['dataSchema']['properties']['facts']['properties']['code'] = ['type' => 'boolean'];
        $doc['artifacts']['subject'] = 'Status: {{code}} — {{message}}';
        [$api, $release] = $this->release($doc);

        $output = $api->render($release->id, facts: ['code' => $value], inputs: ['message' => '<b>{{code}}</b>']);

        self::assertStringContainsString('<b>'.$expected.'</b>', $output->html);
        self::assertStringContainsString('&lt;b&gt;{{code}}&lt;/b&gt;', $output->html);
        self::assertSame('Status: '.$expected.' — <b>{{code}}</b>', $output->subject);
        self::assertSame('<b>{{code}}</b> — '.$expected, $output->text);
    }

    public static function booleanRuntimeValues(): array
    {
        return [
            'true' => [true, 'true'],
            'false' => [false, 'false'],
        ];
    }

    #[DataProvider('optionalTextNamespaces')]
    public function test_missing_optional_text_bindings_render_as_empty_text(string $namespace): void
    {
        $doc = Documents::standalone();
        $doc['dataSchema']['properties'][$namespace]['properties']['caption'] = ['type' => 'string'];
        if ($namespace === 'inputs') {
            $doc['exposedInputs'][] = 'caption';
        }
        $doc['artifacts']['html'] .= '<em>{{caption}}</em>';
        $doc['artifacts']['bindings'][] = ['id' => 'caption', 'path' => $namespace.'.caption', 'kind' => 'text'];
        [$api, $release] = $this->release($doc);

        $output = $api->render($release->id, facts: ['code' => 'ABC']);

        self::assertStringContainsString('<em></em>', $output->html);
        self::assertStringNotContainsString('{{caption}}', $output->html);
        self::assertSame('Enjoy! — ABC', $output->text);
    }

    public static function optionalTextNamespaces(): array
    {
        return [
            'host fact' => ['facts'],
            'exposed input' => ['inputs'],
        ];
    }

    #[DataProvider('requiredTextBindingUses')]
    public function test_missing_text_bindings_in_sidecars_or_absent_from_html_are_still_rejected(?string $sidecar): void
    {
        $doc = Documents::standalone();
        $doc['dataSchema']['properties']['facts']['properties']['caption'] = ['type' => 'string'];
        $doc['artifacts']['bindings'][] = ['id' => 'caption', 'path' => 'facts.caption', 'kind' => 'text'];
        if ($sidecar !== null) {
            $doc['artifacts']['html'] .= '<em>{{caption}}</em>';
            $doc['artifacts'][$sidecar] = '{{caption}}';
        }
        [$api, $release] = $this->release($doc);

        try {
            $api->render($release->id, facts: ['code' => 'ABC']);
            self::fail('A missing text value must only be allowed for a binding used exclusively in HTML.');
        } catch (ValidationException $exception) {
            self::assertSame(['facts.caption' => ['A required runtime binding is missing.']], $exception->errors());
        }
    }

    public static function requiredTextBindingUses(): array
    {
        return [
            'subject' => ['subject'],
            'plain text' => ['text'],
            'unused' => [null],
        ];
    }

    public function test_missing_required_text_values_are_still_rejected_by_the_data_schema(): void
    {
        [$api, $release] = $this->release();

        try {
            $api->render($release->id);
            self::fail('A required runtime text value must not render as empty.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('data', $exception->errors());
        }
    }

    #[DataProvider('nonTextRuntimeBindings')]
    public function test_missing_non_text_runtime_bindings_are_still_rejected(string $html, array $binding): void
    {
        $doc = Documents::standalone();
        $doc['dataSchema']['properties']['facts']['properties']['missing'] = ['type' => 'string'];
        $doc['artifacts']['html'] .= $html;
        $doc['artifacts']['bindings'][] = $binding;
        [$api, $release] = $this->release($doc);

        try {
            $api->render($release->id, facts: ['code' => 'ABC']);
            self::fail('A missing non-text binding must not render as empty.');
        } catch (ValidationException $exception) {
            self::assertSame(['facts.missing' => ['A required runtime binding is missing.']], $exception->errors());
        }
    }

    public static function nonTextRuntimeBindings(): array
    {
        return [
            'attribute' => ['<span title="{{missing}}">Caption</span>', ['id' => 'missing', 'path' => 'facts.missing', 'kind' => 'attribute']],
            'link' => ['<a href="{{missing}}">Visit</a>', ['id' => 'missing', 'path' => 'facts.missing', 'kind' => 'link']],
            'image' => ['<img src="{{missing}}" alt="Picture">', ['id' => 'missing', 'path' => 'facts.missing', 'kind' => 'image']],
            'style' => ['<p style="font-size:{{missing}}">Caption</p>', ['id' => 'missing', 'path' => 'facts.missing', 'kind' => 'style', 'property' => 'font-size', 'unit' => 'px']],
        ];
    }

    public function test_out_of_range_customer_settings_are_rejected(): void
    {
        [$api, $release] = $this->release();
        self::assertTrue(method_exists($api, 'render'));
        $this->expectException(ValidationException::class);
        $api->render($release->id, facts: ['code' => 'ABC'], settings: ['fontSize' => 300]);
    }

    public function test_unexposed_fields_and_missing_protected_facts_are_rejected(): void
    {
        [$api, $release] = $this->release();
        self::assertTrue(method_exists($api, 'render'));
        $this->expectException(ValidationException::class);
        $api->render($release->id, inputs: ['code' => 'FORGED']);
    }

    public function test_group_variations_cannot_widen_customer_capabilities(): void
    {
        $api = app(Templates::class);
        $g = $api->createGroup('gift', 'Gift');
        $api->publishGroup($g->id, Documents::standalone(), 0);
        $t = $api->createTemplate('gift-basic', 'Basic', $g->id);
        $doc = Documents::variant($g->id, 1, 'Gift');
        $doc['source']['overrides']['exposedInputs'] = ['code'];
        $this->expectException(ValidationException::class);
        $d = $api->saveDraft($t->id, $doc, 0);
        $api->publish($t->id, $d->version);
    }

    public function test_publication_rejects_a_binding_in_a_script_or_unsafe_attribute(): void
    {
        $doc = Documents::standalone();
        $doc['artifacts']['html'] = '<script>{{message}}</script>';
        $this->expectException(ValidationException::class);
        $this->release($doc);
    }

    public function test_unknown_binding_tokens_and_wrong_context_are_rejected(): void
    {
        $doc = Documents::standalone();
        $doc['artifacts']['html'] = '<a href="{{message}}">{{unknown}}</a>';
        $this->expectException(ValidationException::class);
        $this->release($doc);
    }

    public function test_unsafe_runtime_link_destinations_are_rejected(): void
    {
        $doc = Documents::standalone();
        $doc['dataSchema']['properties']['facts']['properties']['url'] = ['type' => 'string'];
        $doc['artifacts']['html'] .= '<a href="{{destination}}">Visit</a>';
        $doc['artifacts']['bindings'][] = ['id' => 'destination', 'path' => 'facts.url', 'kind' => 'link'];
        [$api, $release] = $this->release($doc);
        self::assertTrue(method_exists($api, 'render'));
        $this->expectException(ValidationException::class);
        $api->render($release->id, facts: ['code' => 'ABC', 'url' => 'javascript:alert(1)']);
    }
}
