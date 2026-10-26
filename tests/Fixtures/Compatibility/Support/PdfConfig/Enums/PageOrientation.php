<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Enums;

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
