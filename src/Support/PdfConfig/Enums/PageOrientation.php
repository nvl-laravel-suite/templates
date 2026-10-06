<?php

declare(strict_types=1);

namespace Nvl\Templates\Support\PdfConfig\Enums;

/**
 * mPDF-compatible orientation flags.
 *
 * @api
 */
enum PageOrientation: string
{
    case PORTRAIT = 'P';
    case LANDSCAPE = 'L';
}
