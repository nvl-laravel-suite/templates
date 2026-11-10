<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use DOMDocument;
use Illuminate\Validation\ValidationException;
use Mpdf\HTMLParserMode;
use Mpdf\Mpdf;
use Nvl\Templates\Contracts\PdfDriver;
use Nvl\Templates\Rendering\RenderedDocument;
use Nvl\Templates\ValueObjects\PdfOutput;

/** Local acceptance adapter; consumes only the finalized native delivery value. */
final class NativeMpdfAcceptanceDriver implements PdfDriver
{
    public int $calls = 0;

    public int $pages = 0;

    public int $size = 0;

    public ?RenderedDocument $received = null;

    public function __construct(public readonly string $temporaryDirectory) {}

    public function identity(): string
    {
        return 'native-mpdf-acceptance/'.Mpdf::VERSION;
    }

    /**
     * @param  array<array-key, mixed>  $document
     * @param  array<array-key, mixed>  $options
     */
    public function render(RenderedDocument $result, array $document, array $options = []): PdfOutput
    {
        $this->calls++;
        $this->received = $result;
        if (($document['target'] ?? null) !== 'document') {
            throw ValidationException::withMessages(['pdf' => ['A document target is required.']]);
        }

        $dom = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        try {
            $dom->loadHTML('<?xml encoding="utf-8" ?>'.$result->html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        foreach ($dom->getElementsByTagName('img') as $image) {
            if (! preg_match('/\Adata:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+\/=\r\n]+\z/', $image->getAttribute('src'))) {
                throw ValidationException::withMessages(['pdf' => ['Acceptance images must contain admitted inline bytes.']]);
            }
        }
        $embeddedCss = '';
        foreach ($dom->getElementsByTagName('style') as $style) {
            $embeddedCss .= $style->textContent."\n";
        }
        if (preg_match('/@import|url\s*\(/i', $embeddedCss.$result->css)) {
            throw ValidationException::withMessages(['pdf' => ['Acceptance styles cannot fetch external bytes.']]);
        }

        $engine = new Mpdf([
            'mode' => 'utf-8', 'format' => 'A4', 'default_font' => 'dejavusans',
            'margin_top' => 10, 'margin_right' => 10, 'margin_bottom' => 10, 'margin_left' => 10,
            'tempDir' => $this->temporaryDirectory.'/cache', 'showImageErrors' => true,
        ]);
        if (trim($result->css) !== '' && ! str_contains($embeddedCss, trim($result->css))) {
            $engine->WriteHTML($result->css, HTMLParserMode::HEADER_CSS);
        }
        $engine->WriteHTML($result->html);
        $bytes = $engine->OutputBinaryData();
        $pages = $engine->page;
        if (! is_string($bytes) || $bytes === '' || ! is_int($pages) || $pages < 1) {
            throw ValidationException::withMessages(['pdf' => ['The local PDF engine returned invalid bytes or page metadata.']]);
        }
        $this->pages = $pages;
        $this->size = strlen($bytes);

        if (isset($options['expectedPages']) && $this->pages !== $options['expectedPages']) {
            throw ValidationException::withMessages(['expectedPages' => ['The rendered page count differs from the expected count.']]);
        }
        if (isset($options['maxPages']) && $this->pages > $options['maxPages']) {
            throw ValidationException::withMessages(['maxPages' => ['The rendered PDF exceeds the page limit.']]);
        }
        $byteLimit = config('nvl-templates.limits.output_bytes');
        if (! is_int($byteLimit) || $byteLimit < 1 || $this->size > $byteLimit) {
            throw ValidationException::withMessages(['pdf' => ['The rendered PDF exceeds the output byte limit.']]);
        }
        $filename = $options['filename'] ?? 'document.pdf';
        if (! is_string($filename)) {
            throw ValidationException::withMessages(['filename' => ['A plain PDF filename is required.']]);
        }

        return new PdfOutput($bytes, $filename);
    }
}
