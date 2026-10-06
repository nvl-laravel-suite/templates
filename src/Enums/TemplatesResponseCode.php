<?php

declare(strict_types=1);

namespace Nvl\Templates\Enums;

use Nvl\Support\Contracts\ResponseCode;

/** Stable public response discriminators for Templates.
 * @api
 */
enum TemplatesResponseCode: string implements ResponseCode
{
    case PdfDependencyUnavailable = 'pdf_dependency_unavailable';
    case OperationFailed = 'operation_failed';
    case StaleTemplate = 'stale_template';
    case TemplateResolutionFailed = 'template_resolution_failed';
}
