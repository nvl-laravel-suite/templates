<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Drivers\Pdf\ChromiumPdfDriver;
use Nvl\Templates\Rendering\RenderedDocument as RenderResult;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;

final class PdfRenderingTest extends TestCase
{
    use RefreshDatabase;

    private const PDF = "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";

    private function revision(string $target = 'document'): string
    {
        Storage::fake('local');
        Http::preventStrayRequests();
        config()->set('nvl-templates.pdf.driver', ChromiumPdfDriver::class);
        config()->set('nvl-templates.pdf.url', 'https://pdf.example.test');
        config()->set('nvl-templates.pdf.token', 'server-only-token');
        $document = Documents::standalone();
        $document['target'] = $target;
        $api = app(Templates::class);
        $template = $api->createTemplate('pdf', 'PDF');
        $draft = $api->saveDraft($template->id, $document, 0);

        return $api->publish($template->id, $draft->version)->id;
    }

    public function test_pdf_adapter_uses_finished_html_without_a_second_placeholder_or_spacing_pass(): void
    {
        $revision = $this->revision();
        Http::fake(fn (Request $request) => Http::response(self::PDF, 200, ['Content-Type' => 'application/pdf']));
        $output = app(Templates::class)->pdf($revision, facts: ['code' => 'ABC'], inputs: ['message' => 'Literal {{keep_me}}'], options: ['filename' => 'voucher.pdf', 'maxPages' => 2]);
        self::assertSame(self::PDF, $output->bytes);
        self::assertSame(hash('sha256', self::PDF), $output->checksum);
        Http::assertSent(function (Request $request): bool {
            self::assertMatchesRegularExpression('/\A\s*@page\s*\{/', $request['styles']);

            return $request->url() === 'https://pdf.example.test/v1/render' && $request->hasHeader('Authorization', 'Bearer server-only-token')
                && $request['placeholderPolicy'] === 'disabled' && str_contains($request['html'], 'Literal {{keep_me}}')
                && ! isset($request['values']) && $request['settings']['margins'] === 'none' && $request['settings']['padding'] === 'none'
                && $request['settings']['preferCSSPageSize'] === true && str_contains($request['styles'], '210mm 99mm');
        });
    }

    public function test_a_durable_pdf_is_retained_and_repeated_reads_return_the_same_accepted_bytes(): void
    {
        $revision = $this->revision();
        Http::fake(['*' => Http::response(self::PDF, 200, ['Content-Type' => 'application/pdf'])]);
        $renders = app(Templates::class)->renders();
        $request = $renders->accept($revision, facts: ['code' => 'ABC'], output: 'pdf');
        $done = $renders->process($request->id);
        self::assertSame('completed', $done->status);
        self::assertSame('application/pdf', $done->result['mimeType']);
        self::assertSame(self::PDF, $renders->bytes($done->id));
        self::assertSame(self::PDF, $renders->bytes($done->id));
        Http::assertSentCount(1);
    }

    public function test_transient_service_failures_are_retried_but_invalid_pdf_output_is_terminal(): void
    {
        $revision = $this->revision();
        Http::fake(['*' => Http::sequence()->push('busy', 503)->push('<html>Not a PDF</html>', 200, ['Content-Type' => 'application/pdf'])]);
        $renders = app(Templates::class)->renders();
        $request = $renders->accept($revision, facts: ['code' => 'ABC'], output: 'pdf');
        self::assertSame('retrying', $renders->process($request->id)->status);
        $this->travel(11)->seconds();
        $failed = $renders->process($request->id);
        self::assertSame('failed', $failed->status);
        self::assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_email_and_unsafe_pdf_options_are_rejected_before_transport(): void
    {
        $revision = $this->revision('email');
        Http::fake();
        $this->expectException(ValidationException::class);
        app(Templates::class)->renders()->accept($revision, facts: ['code' => 'ABC'], output: 'pdf', options: ['url' => 'https://evil.example']);
    }

    public function test_embedded_utf8_css_is_not_added_a_second_time(): void
    {
        $this->revision();
        Http::fake(['*' => Http::response(self::PDF, 200, ['Content-Type' => 'application/pdf'])]);
        $css = '@page{size:50mm 50mm;margin:0}p::before{content:"Ελληνικά — café 日本語"}';
        app(ChromiumPdfDriver::class)->render(new RenderResult('<html><head><style>'.$css.'</style></head><body><p>Done</p></body></html>', $css, null, null, 'test', 'test'), ['target' => 'document']);
        Http::assertSent(fn (Request $request) => ! isset($request['styles']) && $request['settings']['preferCSSPageSize'] === true);
    }

    public function test_authenticated_redirects_are_rejected_without_following_them(): void
    {
        $revision = $this->revision();
        Http::fake(function (Request $request, array $options) {
            self::assertFalse($options['allow_redirects']);

            return Http::response('', 302, ['Location' => 'https://other.example']);
        });
        try {
            app(Templates::class)->pdf($revision, facts: ['code' => 'ABC']);
            self::fail('Redirected PDF output must be rejected.');
        } catch (ValidationException) {
            Http::assertSentCount(1);
        }
    }

    public function test_wrong_mime_and_oversized_pdf_responses_are_rejected(): void
    {
        $this->revision();
        $driver = app(ChromiumPdfDriver::class);
        $render = new RenderResult('<p>Done</p>', '@page{size:50mm 50mm}', null, null, 'test', 'test');
        foreach ([[self::PDF, ['Content-Type' => 'text/html']], [str_repeat('x', 512), ['Content-Type' => 'application/pdf']], [self::PDF, ['Content-Type' => 'application/pdf', 'Content-Length' => '99999']]] as [$body, $headers]) {
            config()->set('nvl-templates.limits.output_bytes', 128);
            Http::fake(['*' => Http::response($body, 200, $headers)]);
            try {
                $driver->render($render, ['target' => 'document']);
                self::fail('Invalid or oversized PDF output must be rejected.');
            } catch (ValidationException) {
                self::assertTrue(true);
            }
        }
    }

    public function test_a_nonempty_zero_string_credential_keeps_its_selected_authentication_header(): void
    {
        $revision = $this->revision();
        config()->set('nvl-templates.pdf.token', '0');
        Http::fake(['https://pdf.example.test/v1/render' => Http::response(self::PDF, 200, ['Content-Type' => 'application/pdf'])]);
        self::assertSame(self::PDF, app(Templates::class)->pdf($revision, facts: ['code' => 'ABC'])->bytes);
        Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer 0') && ! $request->hasHeader('x-api-key'));
    }
}
