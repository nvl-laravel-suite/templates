<?php

declare(strict_types=1);

namespace Nvl\Templates\ValueObjects;

use Illuminate\Validation\ValidationException;

/**
 * Validated bounded-name PDF envelope with computed byte identity.
 *
 * @api
 */
final readonly class PdfOutput
{
    public string $checksum;

    public int $size;

    public function __construct(public string $bytes, public string $filename = 'document.pdf')
    {
        if (! preg_match('/\A%PDF-(?:1\.[0-9]|2\.0)\b/', $bytes) || ! preg_match('/%%EOF\s*\z/', substr($bytes, -1024))) {
            throw ValidationException::withMessages(['pdf' => ['The PDF service returned an invalid PDF envelope.']]);
        }
        if (! preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,140}\.pdf\z/', $filename)) {
            throw ValidationException::withMessages(['filename' => ['Use a bounded plain PDF filename.']]);
        }
        $this->size = strlen($bytes);
        $this->checksum = hash('sha256', $bytes);
    }
}
