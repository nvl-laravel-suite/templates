<?php

declare(strict_types=1);

namespace Nvl\Templates\Drivers\Pdf;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\PdfDriver;
use Nvl\Templates\Exceptions\RetryableRenderException;
use Nvl\Templates\Rendering\RenderedDocument;
use Nvl\Templates\Services\DocumentInputs;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Support\Pdf;
use Nvl\Templates\ValueObjects\PdfOutput;

/**
 * Bounded authenticated Chromium PDF service adapter.
 *
 * @api
 */
final class ChromiumPdfDriver implements PdfDriver
{
    public function identity(): string
    {
        [$url, $header, $credential, $timeout] = $this->configuration();

        return CanonicalJson::hash(['driver' => 'chromium-html/1', 'url' => $url, 'header' => $header,
            'credential' => hash('sha256', $credential), 'timeout' => $timeout, 'identity' => config('nvl-templates.pdf.identity', 'v1')]);
    }

    public function render(RenderedDocument $result, array $document, array $options = []): PdfOutput
    {
        if (($document['target'] ?? null) !== 'document') {
            throw ValidationException::withMessages(['pdf' => ['PDF output requires a document template.']]);
        }
        $options = Pdf::options($options);
        [$url, $header, $credential, $timeout] = $this->configuration();
        $css = $this->styles($result, $document);
        $payload = ['html' => $result->html, 'placeholderPolicy' => 'disabled', 'fontPolicy' => 'strict',
            'settings' => ['margins' => 'none', 'padding' => 'none', 'scale' => 'normal', 'printBackground' => true,
                'preferCSSPageSize' => true, 'pageNumbers' => false, 'headerHtml' => '', 'footerHtml' => ''],
            'output' => ['filename' => $options['filename'], 'disposition' => 'attachment'],
            'validation' => array_diff_key($options, ['filename' => true])];
        if ($payload['validation'] === []) {
            $payload['validation'] = (object) [];
        }
        if ($css !== '') {
            $payload['styles'] = $css;
        }
        if (strlen(json_encode($payload, JSON_THROW_ON_ERROR)) > config('nvl-templates.pdf.input_bytes', 2097152)) {
            throw ValidationException::withMessages(['pdf' => ['The completed PDF source exceeds the service input limit.']]);
        }
        try {
            $response = Http::withHeaders([$header => $credential])->accept('application/pdf')->connectTimeout(min(5, $timeout))
                ->timeout($timeout)->withOptions(['allow_redirects' => false, 'stream' => true])->post($url.'/v1/render', $payload);
        } catch (ConnectionException) {
            throw new RetryableRenderException('pdf_transport');
        }
        $stream = $response->toPsrResponse()->getBody();
        try {
            if (in_array($response->status(), [408, 425, 429], true) || $response->serverError()) {
                throw new RetryableRenderException('pdf_unavailable');
            }
            if (! $response->successful() || strtolower(trim(explode(';', $response->header('Content-Type'))[0])) !== 'application/pdf') {
                throw ValidationException::withMessages(['pdf' => ['The PDF service rejected the request or returned an invalid content type.']]);
            }
            $limit = config('nvl-templates.limits.output_bytes');
            if (! is_int($limit) || $limit < 1) {
                throw new \LogicException('Configure a positive PDF output byte limit.');
            }
            if (ctype_digit($response->header('Content-Length')) && (int) $response->header('Content-Length') > $limit) {
                throw ValidationException::withMessages(['pdf' => ['The PDF response exceeds the byte limit.']]);
            }
            $bytes = '';
            $stalled = false;
            while (! $stream->eof()) {
                if ($stalled) {
                    throw new RetryableRenderException('pdf_transport');
                }
                try {
                    $chunk = $stream->read(min(65536, $limit + 1 - strlen($bytes)));
                } catch (\Throwable) {
                    throw new RetryableRenderException('pdf_transport');
                }
                $bytes .= $chunk;
                if (strlen($bytes) > $limit) {
                    throw ValidationException::withMessages(['pdf' => ['The PDF response exceeds the byte limit.']]);
                }
                $stalled = $chunk === '';
            }

            return new PdfOutput($bytes, $options['filename']);
        } finally {
            $stream->close();
        }
    }

    /** @return array{string,string,string,int} */
    private function configuration(): array
    {
        $url = config('nvl-templates.pdf.url');
        $token = config('nvl-templates.pdf.token');
        $key = config('nvl-templates.pdf.api_key');
        $timeout = config('nvl-templates.pdf.timeout', 20);
        if (! is_string($url) || ! filter_var($url, FILTER_VALIDATE_URL) || ! in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true)
            || parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null || parse_url($url, PHP_URL_QUERY) !== null || parse_url($url, PHP_URL_FRAGMENT) !== null
            || ! is_int($timeout) || $timeout < 1 || $timeout > 300 || (is_string($token) && $token !== '') === (is_string($key) && $key !== '')) {
            throw new \LogicException('Configure a trusted PDF service URL, timeout and exactly one credential.');
        }
        $hasToken = is_string($token) && $token !== '';
        $secret = $hasToken ? $token : $key;
        if (! is_string($secret) || strlen($secret) > 8192 || preg_match('/[\x00-\x20\x7f]/', $secret)) {
            throw new \LogicException('Invalid PDF service credential.');
        }

        return [rtrim($url, '/'), $hasToken ? 'Authorization' : 'x-api-key', $hasToken ? 'Bearer '.$secret : $secret, $timeout];
    }

    /** @param array<array-key,mixed> $document */
    private function styles(RenderedDocument $result, array $document): string
    {
        $embedded = '';
        $dom = new \DOMDocument;
        $prior = libxml_use_internal_errors(true);
        try {
            $dom->loadHTML('<?xml encoding="utf-8" ?>'.$result->html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
            foreach ($dom->getElementsByTagName('style') as $style) {
                $embedded .= $style->textContent."\n";
            }
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($prior);
        }
        $css = trim($result->css) !== '' && ! str_contains($embedded, trim($result->css)) ? $result->css : '';
        if (! preg_match('/@page\b/i', $embedded.$css)) {
            $source = DocumentInputs::map($document['source'] ?? null, 'document.source');
            $definition = DocumentInputs::map($source['definition'] ?? null, 'document.source.definition');
            $page = DocumentInputs::map($definition['page'] ?? null, 'document.source.definition.page');
            $width = $page['widthMm'] ?? null;
            $height = $page['heightMm'] ?? null;
            if (! is_numeric($width) || ! is_numeric($height) || ! is_finite((float) $width) || ! is_finite((float) $height) || $width <= 0 || $height <= 0) {
                throw ValidationException::withMessages(['pdf' => ['PDF source requires finite positive page dimensions.']]);
            }
            $css .= "\n@page{size:".(float) $width.'mm '.(float) $height.'mm;margin:0}';
        }

        return $css;
    }
}
