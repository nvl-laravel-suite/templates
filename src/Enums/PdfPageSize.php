<?php

declare(strict_types=1);

namespace Nvl\Templates\Enums;

/**
 * Common print page sizes supported by the bundled PDF renderer.
 *
 * @api
 */
enum PdfPageSize: string
{
    case A3 = 'A3';
    case A4 = 'A4';
    case A5 = 'A5';
    case Letter = 'Letter';
    case Legal = 'Legal';
}
