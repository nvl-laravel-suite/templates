<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use InvalidArgumentException;
use Nvl\Templates\Contracts\PdfDriver;
use Nvl\Templates\Rendering\RenderedDocument;
use Nvl\Templates\ValueObjects\PdfOutput;

/** Host adapter uses only the provided public callback value and validated output envelope.
 *
 * @phpstan-import-type RenderResult from RenderedDocument
 */
final class ExternalPdfDriver implements PdfDriver
{
    /** @var RenderResult|null */
    public static ?array $received = null;

    public function identity(): string
    {
        return 'external-pdf/1';
    }

    /** @param array<array-key, mixed> $document
     * @param  array<array-key, mixed>  $options
     */
    public function render(RenderedDocument $result, array $document, array $options = []): PdfOutput
    {
        self::$received = $result->toArray();
        $filename = $options['filename'] ?? 'external.pdf';
        if (! is_string($filename)) {
            throw new InvalidArgumentException('Expected an admitted plain PDF filename.');
        }

        return new PdfOutput("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", $filename);
    }
}
