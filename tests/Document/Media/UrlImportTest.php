<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Media;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\DnsResolver;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Tests\CanonicalTestCase;
use Nvl\Templates\Tests\Fixtures\FixedDnsResolver;

final class UrlImportTest extends CanonicalTestCase
{
    use RefreshDatabase;

    private const string PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('nvl-templates.imports.allowed_hosts', ['assets.example.test']);
        $this->resolveTo(['93.184.216.34']);
    }

    public function test_the_request_uses_the_transport_that_honors_the_validated_address(): void
    {
        $transfer = [];
        Http::fake(function (Request $request, array $options) use (&$transfer) {
            $transfer = $options;

            return Http::response((string) base64_decode(self::PNG, true), 200, ['Content-Type' => 'image/png']);
        });

        $asset = app(TemplateAssets::class)->fromUrl('https://assets.example.test/logo.png', 'logo.png', $this->actor());

        self::assertSame('image/png', $asset->mime_type);
        self::assertSame(['assets.example.test:443:93.184.216.34'], $transfer['curl'][CURLOPT_RESOLVE] ?? null);
        // Guzzle serves streamed requests through PHP's stream wrapper, which ignores
        // cURL options and would resolve the hostname a second time.
        self::assertEmpty($transfer['stream'] ?? null);
        self::assertFalse($transfer['allow_redirects']);
        $limit = (int) config('nvl-templates.storage.max_bytes');
        $abort = $transfer['curl'][CURLOPT_XFERINFOFUNCTION];
        self::assertFalse($transfer['curl'][CURLOPT_NOPROGRESS]);
        self::assertSame(0, $abort(null, 0, $limit));
        self::assertSame(1, $abort(null, 0, $limit + 1));
    }

    public function test_oversized_responses_are_rejected_without_retaining_an_asset(): void
    {
        config()->set('nvl-templates.storage.max_bytes', 16);
        Http::fake(['*' => Http::response((string) base64_decode(self::PNG, true), 200)]);

        $this->assertRejected('https://assets.example.test/logo.png');
    }

    public function test_redirects_private_addresses_and_unlisted_hosts_are_rejected(): void
    {
        Http::fake(['*' => Http::response('', 302, ['Location' => 'https://internal.example.test/'])]);
        $this->assertRejected('https://assets.example.test/logo.png');

        $this->resolveTo(['93.184.216.34', '10.0.0.5']);
        $this->assertRejected('https://assets.example.test/logo.png');

        $this->resolveTo(['93.184.216.34']);
        foreach (['https://other.example.test/logo.png', 'http://assets.example.test/logo.png', 'https://assets.example.test:8443/logo.png', 'https://user@assets.example.test/logo.png'] as $url) {
            $this->assertRejected($url);
        }
    }

    /** @param list<string> $addresses */
    private function resolveTo(array $addresses): void
    {
        $this->app->instance(DnsResolver::class, new FixedDnsResolver($addresses));
    }

    private function assertRejected(string $url): void
    {
        try {
            app(TemplateAssets::class)->fromUrl($url, 'logo.png', $this->actor());
            self::fail('The URL import was accepted: '.$url);
        } catch (ValidationException $error) {
            self::assertArrayHasKey('asset', $error->errors());
        }
        self::assertSame(0, TemplateAsset::query()->count());
    }
}
