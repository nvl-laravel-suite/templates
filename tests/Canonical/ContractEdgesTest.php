<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\DocumentCompiler;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class ContractEdgesTest extends TestCase
{
    use RefreshDatabase;

    private function nested(): array
    {
        $document = Documents::standalone();
        $document['dataSchema']['properties']['inputs']['properties'] = ['action' => ['type' => 'object', 'properties' => ['value' => ['type' => 'string'], 'link' => ['type' => 'string']], 'required' => ['value', 'link'], 'additionalProperties' => false]];
        $document['inputDefaults'] = ['action' => ['value' => 'Open', 'link' => 'https://example.com']];
        $document['exposedInputs'] = ['action.value'];
        $document['artifacts']['bindings'][1]['path'] = 'inputs.action.value';

        return $document;
    }

    public function test_nested_link_values_keep_sibling_destinations_protected(): void
    {
        $api = app(Templates::class);
        $t = $api->createTemplate('nested', 'Nested');
        $draft = $api->saveDraft($t->id, $this->nested(), 0);
        $revision = $api->publish($t->id, $draft->version);
        $result = $api->render($revision->id, facts: ['code' => 'ABC'], inputs: ['action' => ['value' => 'Changed']]);
        self::assertStringContainsString('Changed', $result->html);
        $this->expectException(ValidationException::class);
        $api->render($revision->id, facts: ['code' => 'ABC'], inputs: ['action' => ['value' => 'Changed', 'link' => 'https://forged.example']]);
    }

    public function test_every_css_token_occurrence_must_use_the_declared_property(): void
    {
        $doc = Documents::standalone();
        $doc['artifacts']['html'] = '<p style="font-size:{{fontSize}};background:{{fontSize}}">{{message}}</p>';
        $api = app(Templates::class);
        $t = $api->createTemplate('bad-css', 'Bad CSS');
        $draft = $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, $draft->version);
    }

    public function test_numeric_values_cannot_be_used_as_colors(): void
    {
        $doc = Documents::standalone();
        $doc['artifacts']['html'] = '<p style="color:{{fontSize}}">{{message}}</p>';
        $doc['artifacts']['bindings'][3]['property'] = 'color';
        $doc['artifacts']['bindings'][3]['unit'] = '';
        $api = app(Templates::class);
        $t = $api->createTemplate('bad-color', 'Bad color');
        $draft = $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, $draft->version);
    }

    public function test_unquoted_attribute_bindings_cannot_create_event_handlers(): void
    {
        $doc = Documents::standalone();
        $doc['artifacts']['html'] = '<p title={{message}}>Hello</p>';
        $doc['artifacts']['bindings'][1]['kind'] = 'attribute';
        unset($doc['artifacts']['text']);
        $api = app(Templates::class);
        $t = $api->createTemplate('unquoted', 'Unquoted');
        $draft = $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, $draft->version);
    }

    public function test_bindings_cannot_construct_tag_names_after_dom_repair(): void
    {
        $doc = Documents::standalone();
        $doc['artifacts']['html'] = '<{{message}}>alert(1)</{{message}}>';
        $api = app(Templates::class);
        $t = $api->createTemplate('structural', 'Structural');
        $draft = $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, $draft->version);
    }

    public function test_static_remote_images_cannot_bypass_managed_asset_retention(): void
    {
        $doc = Documents::standalone();
        $doc['artifacts']['html'] .= '<img src="https://example.com/mutable.png">';
        $api = app(Templates::class);
        $t = $api->createTemplate('remote', 'Remote');
        $draft = $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, $draft->version);
    }

    public function test_shared_publication_also_rejects_unmanaged_static_image_sources(): void
    {
        app()->instance('test.compiler', new class implements DocumentCompiler
        {
            public function compile(array $document, array $data, array $assets = []): array
            {
                return ['html' => '<p>unused</p>', 'css' => ''];
            }
        });
        config()->set('nvl-templates.compiler.driver', 'test.compiler');
        $doc = Documents::standalone();
        $doc['artifacts']['engine'] = 'shared';
        $doc['source']['definition']['nodes']['logo'] = ['id' => 'logo', 'name' => 'Logo', 'kind' => 'element', 'tag' => 'img', 'attributes' => ['src' => 'https://example.com/mutable.png'], 'attributeBindings' => [], 'style' => [], 'classes' => [], 'children' => [], 'permissions' => ['content' => false, 'style' => false]];
        $doc['source']['definition']['roots'][] = 'logo';
        $api = app(Templates::class);
        $t = $api->createTemplate('shared-remote', 'Shared remote');
        $draft = $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, $draft->version);
    }

    #[DataProvider('smugglingComments')]
    public function test_html_comments_cannot_smuggle_markup_past_validation(string $comment): void
    {
        $doc = Documents::standalone();
        $doc['artifacts']['html'] = str_replace('</body>', $comment.'</body>', $doc['artifacts']['html']);
        $api = app(Templates::class);
        $t = $api->createTemplate('comment', 'Comment');
        $draft = $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, $draft->version);
    }

    /** @return array<string, array{string}> */
    public static function smugglingComments(): array
    {
        return [
            // Browsers end "<!-->" and "<!--->" at once; an older libxml reads on to "-->".
            'abruptly closed comment' => ['<!--><img src=x onerror=alert(1)>-->'],
            'abruptly closed dashed comment' => ['<!---><img src=x onerror=alert(1)>-->'],
            'conditional comment markup' => ['<!--[if mso]><img src="https://tracker.example/pixel.png"><![endif]-->'],
            'raw text breakout' => ['<title><!--</title><img src=x onerror=alert(1)>--></title>'],
        ];
    }

    public function test_plain_html_comments_remain_publishable(): void
    {
        $doc = Documents::standalone();
        $doc['artifacts']['html'] = str_replace('</body>', '<!-- footer --></body>', $doc['artifacts']['html']);
        $api = app(Templates::class);
        $t = $api->createTemplate('plain-comment', 'Plain comment');
        $draft = $api->saveDraft($t->id, $doc, 0);
        $revision = $api->publish($t->id, $draft->version);
        self::assertStringContainsString('<!-- footer -->', $api->render($revision->id, facts: ['code' => 'ABC'])->html);
    }

    public function test_css_image_sets_cannot_bypass_managed_asset_retention(): void
    {
        $doc = Documents::standalone();
        $doc['target'] = 'document';
        $doc['artifacts']['html'] = str_replace('<b>', '<b style="background-image:image-set(\'https://tracker.example/pixel.png\' 1x)">', $doc['artifacts']['html']);
        $api = app(Templates::class);
        $t = $api->createTemplate('image-set', 'Image set');
        $draft = $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, $draft->version);
    }

    public function test_shared_publication_also_rejects_css_image_sets(): void
    {
        app()->instance('test.compiler', new class implements DocumentCompiler
        {
            public function compile(array $document, array $data, array $assets = []): array
            {
                return ['html' => '<p>unused</p>', 'css' => ''];
            }
        });
        config()->set('nvl-templates.compiler.driver', 'test.compiler');
        $doc = Documents::standalone();
        $doc['target'] = 'document';
        $doc['artifacts']['engine'] = 'shared';
        $doc['source']['definition']['styles']['css'] = '.hero{background-image:image-set("https://tracker.example/pixel.png" 1x)}';
        $api = app(Templates::class);
        $t = $api->createTemplate('shared-image-set', 'Shared image set');
        $draft = $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, $draft->version);
    }
}
