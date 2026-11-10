<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Rendering\RenderedDocument;
use Nvl\Templates\ValueObjects\PdfOutput;

/**
 * Host PDF adapter called only after native render admission.
 *
 * @api
 */
interface PdfDriver
{
    public function identity(): string;

    /** Render the supplied finalized delivery value without repeating template evaluation.
     *
     * @param  array<array-key,mixed>  $document
     * @param  array<array-key,mixed>  $options
     */
    public function render(RenderedDocument $result, array $document, array $options = []): PdfOutput;
}
