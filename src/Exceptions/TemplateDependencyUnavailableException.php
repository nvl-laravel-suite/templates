<?php

declare(strict_types=1);

namespace Nvl\Templates\Exceptions;

use Nvl\Support\Exceptions\ExceptionResponse;
use Nvl\Templates\Enums\TemplatesResponseCode;

/** Signals missing optional dependencies for the selected built-in PDF capability. @api */
final class TemplateDependencyUnavailableException extends TemplatesException
{
    /** Supply safe configuration metadata while retaining the native exception constructor. */
    protected function exceptionResponse(): ExceptionResponse
    {
        return new ExceptionResponse('templates', TemplatesResponseCode::PdfDependencyUnavailable, 500);
    }
}
