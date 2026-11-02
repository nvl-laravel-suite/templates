<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Rendering\EmailProfile;
use Nvl\Templates\Rendering\RenderedDocument as RenderResult;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class BrowserEmailPreviewTest extends TestCase
{
    public function test_browser_projection_changes_only_exact_image_sources_and_preserves_delivery_result(): void
    {
        $html = '<!doctype html><html><head></head><body><p>cid:logo@assets</p><a href="cid:logo@assets">Logo</a><img src="cid:logo@assets" title="cid:logo@assets"><img src="cid:logo@assets.extra"><img src="cid:missing@assets"><img src="https://example.com/logo.png"><img src="cid:webp@assets"><img src="cid:svg@assets"></body></html>';
        $content = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        $result = new RenderResult($html, '', 'Mail', 'cid:logo@assets', 'revision', 'delivery-checksum', [
            ['cid' => 'logo@assets', 'name' => 'logo.png', 'mimeType' => 'image/png', 'content' => $content],
            ['cid' => 'webp@assets', 'name' => 'logo.webp', 'mimeType' => 'image/webp', 'content' => 'd2VicA=='],
            ['cid' => 'svg@assets', 'name' => 'logo.svg', 'mimeType' => 'image/svg+xml', 'content' => 'PHN2Zy8+'],
        ]);
        $delivery = $result->toArray();

        $preview = app(EmailProfile::class)->browserPreview($result->html, $result->inlineAssets);

        self::assertStringContainsString('src="data:image/png;base64,'.$content.'"', $preview);
        self::assertStringContainsString('<p>cid:logo@assets</p>', $preview);
        self::assertStringContainsString('href="cid:logo@assets"', $preview);
        self::assertStringContainsString('title="cid:logo@assets"', $preview);
        self::assertStringContainsString('src="cid:logo@assets.extra"', $preview);
        self::assertStringContainsString('src="cid:missing@assets"', $preview);
        self::assertStringContainsString('src="https://example.com/logo.png"', $preview);
        self::assertStringContainsString('src="cid:webp@assets"', $preview);
        self::assertStringContainsString('src="cid:svg@assets"', $preview);
        self::assertSame($delivery, $result->toArray());
    }

    #[DataProvider('cidSchemes')]
    public function test_browser_projection_normalizes_only_the_cid_scheme(string $scheme): void
    {
        $source = $scheme.'Logo@Assets';
        $css = '@media screen and (max-width:620px){[data-note="София"]{font-size:20px!important}}';
        $html = '<!doctype html><html lang="bg"><head><style>'.$css.'</style></head><body><p>'.$source.'</p><a href="'.$source.'">Лого</a><img src="'.$source.'" title="'.$source.'"><img src="'.$scheme.'logo@Assets"><img src="'.$scheme.'Logo@assets"></body></html>';
        $result = new RenderResult($html, '', 'Mail', $source, 'revision', 'delivery-checksum', [
            ['cid' => 'Logo@Assets', 'name' => 'logo.png', 'mimeType' => 'image/png', 'content' => 'AAECA/8='],
        ]);
        $delivery = $result->toArray();

        $preview = app(EmailProfile::class)->browserPreview($result->html, $result->inlineAssets);

        self::assertSame(1, substr_count($preview, 'src="data:image/png;base64,AAECA/8="'));
        self::assertStringContainsString('<p>'.$source.'</p>', $preview);
        self::assertStringContainsString('href="'.$source.'"', $preview);
        self::assertStringContainsString('title="'.$source.'"', $preview);
        self::assertStringContainsString('src="'.$scheme.'logo@Assets"', $preview);
        self::assertStringContainsString('src="'.$scheme.'Logo@assets"', $preview);
        self::assertStringContainsString($css, $preview);
        self::assertStringContainsString('Лого', $preview);
        self::assertSame($delivery, $result->toArray());
    }

    public static function cidSchemes(): iterable
    {
        yield 'lowercase' => ['cid:'];
        yield 'uppercase' => ['CID:'];
        yield 'mixed case' => ['CiD:'];
    }

    #[DataProvider('supportedRasterTypes')]
    public function test_browser_projection_preserves_authorized_raster_content(string $mimeType, string $expected): void
    {
        $preview = app(EmailProfile::class)->browserPreview('<img src="cid:logo@assets">', [
            ['cid' => 'logo@assets', 'name' => 'logo', 'mimeType' => $mimeType, 'content' => 'AAECA/8='],
        ]);

        self::assertStringContainsString($expected, $preview);
    }

    public static function supportedRasterTypes(): iterable
    {
        yield 'PNG' => ['image/png', 'src="data:image/png;base64,AAECA/8="'];
        yield 'JPEG' => ['image/jpeg', 'src="data:image/jpeg;base64,AAECA/8="'];
        yield 'GIF' => ['image/gif', 'src="data:image/gif;base64,AAECA/8="'];
    }

    public function test_browser_projection_keeps_html_identical_when_no_image_source_matches(): void
    {
        $html = '<!doctype html><html lang="bg"><body><p>cid:logo@assets</p><a href="cid:logo@assets">Лого</a><img src="cid:other@assets"><img src="CID:Logo@assets"><img src="CiD:logo@Assets"></body></html>';

        self::assertSame($html, app(EmailProfile::class)->browserPreview($html, []));
        self::assertSame($html, app(EmailProfile::class)->browserPreview($html, [
            ['cid' => 'logo@assets', 'name' => 'logo.png', 'mimeType' => 'image/png', 'content' => 'AAECA/8='],
        ]));
        self::assertSame($html, app(EmailProfile::class)->browserPreview($html, [
            ['cid' => 'other@assets', 'name' => 'logo.svg', 'mimeType' => 'image/svg+xml', 'content' => 'PHN2Zy8+'],
        ]));
    }

    public function test_browser_projection_preserves_utf8_responsive_selectors_language_and_html5_doctype(): void
    {
        $css = '@media screen and (max-width:620px){[data-note="София"]{font-size:20px!important}}';
        $html = '<!doctype html><html lang="bg"><head><style>'.$css.'</style></head><body><p data-note="София">Подарък</p><img src="cid:logo@assets"></body></html>';

        $preview = app(EmailProfile::class)->browserPreview($html, [
            ['cid' => 'logo@assets', 'name' => 'logo.png', 'mimeType' => 'image/png', 'content' => 'AAECA/8='],
        ]);

        self::assertStringContainsString($css, $preview);
        self::assertStringContainsString('data-note="София"', $preview);
        self::assertStringContainsString('Подарък', $preview);
        self::assertStringContainsString('<html lang="bg">', $preview);
        self::assertMatchesRegularExpression('/^<!doctype html>/i', $preview);
        self::assertStringContainsString('src="data:image/png;base64,AAECA/8="', $preview);
    }

    #[DataProvider('cidSchemes')]
    public function test_browser_projection_counts_every_repeated_image_against_the_allocation_limit(string $scheme): void
    {
        $html = '<html><body>'.str_repeat('<img src="'.$scheme.'logo@assets">', 4).'</body></html>';
        $assets = [['cid' => 'logo@assets', 'mimeType' => 'image/png', 'content' => str_repeat('AAAA', 32)]];

        try {
            app(EmailProfile::class)->browserPreview($html, $assets, 200);
            self::fail('Repeated retained images must not expand beyond the preview allocation limit.');
        } catch (ValidationException $exception) {
            self::assertSame(['preview' => ['Browser preview exceeds the byte limit.']], $exception->errors());
        }
    }

    public function test_browser_projection_with_a_sufficient_allocation_limit_matches_the_unbounded_projection(): void
    {
        $html = '<!doctype html><html lang="bg"><body><p>Подарък</p><img src="cid:logo@assets"><img src="cid:logo@assets"></body></html>';
        $assets = [['cid' => 'logo@assets', 'mimeType' => 'image/png', 'content' => 'AAECA/8=']];
        $profile = app(EmailProfile::class);
        $baseline = $profile->browserPreview($html, $assets);

        self::assertSame($baseline, $profile->browserPreview($html, $assets, strlen($baseline)));
    }

    public function test_browser_projection_rejects_oversized_source_html_before_parsing(): void
    {
        try {
            app(EmailProfile::class)->browserPreview('<p>'.str_repeat('x', 200).'</p>', [], 200);
            self::fail('Source HTML must also fit inside the preview allocation limit.');
        } catch (ValidationException $exception) {
            self::assertSame(['preview' => ['Browser preview exceeds the byte limit.']], $exception->errors());
        }
    }
}
