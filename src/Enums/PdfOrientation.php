<?php

declare(strict_types=1);

namespace Nvl\Templates\Enums;

/**
 * Page orientation supported by the bundled PDF renderer.
 *
 * @api
 */
enum PdfOrientation: string
{
    case Portrait = 'portrait';
    case Landscape = 'landscape';

    public function mpdfValue(): string
    {
        return $this === self::Portrait ? 'P' : 'L';
    }
}
