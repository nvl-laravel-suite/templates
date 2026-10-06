<?php

declare(strict_types=1);

namespace Nvl\Templates\Exceptions;

use Nvl\Support\Contracts\RespondableException;
use Nvl\Support\Exceptions\ExceptionResponse;
use Nvl\Support\Traits\InteractsWithPackageFailure;
use Nvl\Templates\Enums\TemplatesResponseCode;
use RuntimeException;

/**
 * @api
 * Base exception for stable package-domain failures.
 */
class TemplatesException extends RuntimeException implements RespondableException
{
    use InteractsWithPackageFailure;

    /** Resolve the declared safe failure for this native hierarchy. */
    protected function exceptionResponse(): ExceptionResponse
    {
        return match (static::class) {
            StaleTemplateException::class => new ExceptionResponse('templates', TemplatesResponseCode::StaleTemplate, 409),
            TemplateResolutionException::class => new ExceptionResponse('templates', TemplatesResponseCode::TemplateResolutionFailed, 422),
            default => new ExceptionResponse('templates', TemplatesResponseCode::OperationFailed),
        };
    }
}
