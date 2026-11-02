<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\DocumentCompiler;
use Nvl\Templates\Rendering\EmailProfile;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class EmailProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_email_publication_rejects_unsupported_source_css_even_with_safe_artifacts(): void
    {
        $document = Documents::standalone();
        $document['source']['definition']['styles']['css'] = 'p{display:grid}';
        $this->expectException(ValidationException::class);
        $this->release($document);
    }

    public function test_email_publication_rejects_unsupported_artifacts_even_with_safe_source(): void
    {
        $document = Documents::standalone();
        $document['artifacts']['css'] = 'p{position:absolute}';
        $this->expectException(ValidationException::class);
        $this->release($document);
    }

    public function test_email_runtime_inlines_styles_preserves_responsive_rules_and_escapes_once(): void
    {
        $document = Documents::standalone();
        $document['artifacts']['css'] = 'h1{color:#123456}@media screen and (max-width:620px){h1{font-size:20px!important}}';
        [$api, $release] = $this->release($document);
        $result = $api->render($release->id, facts: ['code' => 'ABC'], inputs: ['message' => '<b>Gift</b>']);
        self::assertMatchesRegularExpression('/<h1[^>]*style="[^"]*color:\s*#123456/', $result->html);
        self::assertStringContainsString('@media screen and (max-width:620px)', $result->html);
        self::assertStringContainsString('&lt;b&gt;Gift&lt;/b&gt;', $result->html);
        self::assertSame('', $result->css);
    }

    public function test_document_output_keeps_its_unrestricted_layout(): void
    {
        $document = Documents::standalone();
        $document['target'] = 'document';
        $document['source']['definition']['styles']['css'] = 'p{display:grid}';
        $document['artifacts']['css'] = 'p{display:grid}';
        [$api, $release] = $this->release($document);
        self::assertSame('p{display:grid}', $api->render($release->id, facts: ['code' => 'ABC'])->css);
    }

    public function test_important_stylesheet_values_win_over_ordinary_inline_values(): void
    {
        $document = Documents::standalone();
        $document['artifacts']['html'] = str_replace('font-size:{{fontSize}}', 'color:#ff0000;font-size:{{fontSize}}', $document['artifacts']['html']);
        $document['artifacts']['css'] = 'p{color:#0000ff!important}';
        [$api, $release] = $this->release($document);
        $result = $api->render($release->id, facts: ['code' => 'ABC']);
        self::assertMatchesRegularExpression('/<p[^>]*style="[^"]*color:\s*#0000ff\s*!important/', $result->html);
    }

    public function test_responsive_styles_must_declare_their_inline_override_priority(): void
    {
        $document = Documents::standalone();
        $document['artifacts']['css'] = '@media screen and (max-width:620px){p{font-size:20px}}';
        $this->expectException(ValidationException::class);
        $this->release($document);
    }

    public function test_quoted_commas_in_attribute_selectors_do_not_split_email_rules(): void
    {
        $document = Documents::standalone();
        $document['artifacts']['html'] = str_replace('<h1>', '<h1 data-note="a,b">', $document['artifacts']['html']);
        $document['artifacts']['css'] = '/* Here\'s a comment */[data-note="a,b"]{color:#123456}/* There\'s another */';
        [$api, $release] = $this->release($document);

        $result = $api->render($release->id, facts: ['code' => 'ABC']);

        self::assertMatchesRegularExpression('/<h1[^>]*style="[^"]*color:\s*#123456/', $result->html);
    }

    public function test_quoted_hashes_do_not_raise_attribute_selector_specificity(): void
    {
        $document = Documents::standalone();
        $document['artifacts']['html'] = str_replace('<h1>', '<h1 id="banner" data-note="#other">', $document['artifacts']['html']);
        $document['artifacts']['css'] = '#banner{color:#123456}[data-note="#other"]{color:#abcdef}';
        [$api, $release] = $this->release($document);

        $result = $api->render($release->id, facts: ['code' => 'ABC']);

        self::assertMatchesRegularExpression('/<h1[^>]*style="[^"]*color:\s*#123456/', $result->html);
    }

    public function test_quoted_dots_do_not_raise_attribute_selector_specificity(): void
    {
        $document = Documents::standalone();
        $document['artifacts']['html'] = str_replace('<h1>', '<h1 class="banner" data-note="other.value">', $document['artifacts']['html']);
        $document['artifacts']['css'] = '[data-note="other.value"]{color:#abcdef}.banner{color:#123456}';
        [$api, $release] = $this->release($document);

        $result = $api->render($release->id, facts: ['code' => 'ABC']);

        self::assertMatchesRegularExpression('/<h1[^>]*style="[^"]*color:\s*#123456/', $result->html);
    }

    public function test_uppercase_media_rules_remain_responsive_when_inlining_static_styles(): void
    {
        $document = Documents::standalone();
        $document['artifacts']['css'] = 'h1{color:#123456}@MEDIA screen and (max-width:620px){h1{font-size:20px!important}}';
        [$api, $release] = $this->release($document);

        $result = $api->render($release->id, facts: ['code' => 'ABC']);

        self::assertMatchesRegularExpression('/<h1[^>]*style="[^"]*color:\s*#123456/', $result->html);
        self::assertStringContainsString('@MEDIA screen and (max-width:620px)', $result->html);
        self::assertDoesNotMatchRegularExpression('/<h1[^>]*style="[^"]*font-size/', $result->html);
    }

    #[DataProvider('escapedQuotedSelectors')]
    public function test_shared_email_output_preserves_raw_escaped_selector_literals(string $html, string $css): void
    {
        app()->instance('test.email.compiler', new class($html, $css) implements DocumentCompiler
        {
            public function __construct(private string $html, private string $css) {}

            public function compile(array $document, array $data, array $assets = []): array
            {
                return ['html' => $this->html, 'css' => $this->css];
            }
        });
        config()->set('nvl-templates.compiler.driver', 'test.email.compiler');
        $document = Documents::standalone();
        $document['artifacts']['engine'] = 'shared';
        [$api, $release] = $this->release($document);

        $result = $api->render($release->id, facts: ['code' => 'ABC']);

        self::assertMatchesRegularExpression('/<h1[^>]*style="[^"]*color:\s*#123456/', $result->html);
        self::assertStringContainsString($css, $result->html);
    }

    public static function escapedQuotedSelectors(): array
    {
        return [
            'escaped quote' => ['<h1 data-note="a&quot;b">Gift</h1>', '[data-note="a\\"b"]{color:#123456}'],
            'escaped backslash' => ['<h1 data-note="a\\z">Gift</h1>', '[data-note="a\\\\z"]{color:#123456}'],
            'hex escape' => ['<h1 data-note="ab">Gift</h1>', '[data-note="a\\62 "]{color:#123456}'],
        ];
    }

    public function test_publication_rejects_source_selectors_that_generate_xpath_control_characters(): void
    {
        $document = Documents::standalone();
        $document['source']['definition']['styles']['css'] = '[data-note="a\\\\b"]{color:#123456}';

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Unsupported email selector.');
        $this->release($document);
    }

    public function test_output_validation_rejects_selectors_that_generate_xpath_control_characters(): void
    {
        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Unsupported email selector.');

        app(EmailProfile::class)->finalize('<h1 data-note="a\\b">Gift</h1>', '[data-note="a\\\\b"]{color:#123456}');
    }

    public function test_inlining_preserves_double_quoted_inline_font_families_containing_apostrophes(): void
    {
        $result = app(EmailProfile::class)->finalize('<p style="font-family: &quot;Bob\'s font&quot;, Arial">Gift</p>', 'p{color:#123456}');

        self::assertStringContainsString('font-family: "Bob\'s font", Arial;', html_entity_decode($result['html'], ENT_QUOTES, 'UTF-8'));
        self::assertMatchesRegularExpression('/<p[^>]*style="[^"]*color:\s*#123456/', $result['html']);
    }

    public function test_inlining_preserves_unicode_selector_matches_and_retained_styles(): void
    {
        $css = '[data-note="София"]{color:#123456}@media screen and (max-width:620px){[data-note="София"]{font-size:20px!important}}';
        $result = app(EmailProfile::class)->finalize('<!doctype html><html lang="bg"><head></head><body><p data-note="София">Подарък</p></body></html>', $css);

        self::assertMatchesRegularExpression('/<p[^>]*style="[^"]*color:\s*#123456/', $result['html']);
        self::assertStringContainsString($css, $result['html']);
        self::assertStringContainsString('Подарък', $result['html']);
        self::assertStringContainsString('<html lang="bg">', $result['html']);
        self::assertMatchesRegularExpression('/^<!doctype html>/i', $result['html']);
    }

    public function test_responsive_only_email_css_preserves_unicode_selectors(): void
    {
        $css = '@media screen and (max-width:620px){[data-note="София"]{font-size:20px!important}}';
        $result = app(EmailProfile::class)->finalize('<!doctype html><html lang="bg"><head></head><body><p data-note="София">Подарък</p></body></html>', $css);

        self::assertStringContainsString($css, $result['html']);
        self::assertStringContainsString('Подарък', $result['html']);
        self::assertStringContainsString('<html lang="bg">', $result['html']);
        self::assertMatchesRegularExpression('/^<!doctype html>/i', $result['html']);
        self::assertDoesNotMatchRegularExpression('/<p[^>]*style="[^"]*font-size/', $result['html']);
    }

    private function release(array $document): array
    {
        $api = app(Templates::class);
        $template = $api->createTemplate('email-test', 'Email test');
        $draft = $api->saveDraft($template->id, $document, 0);

        return [$api, $api->publish($template->id, $draft->version)];
    }
}
