<?php

declare(strict_types=1);

namespace Nvl\Templates\Enums;

/**
 * Represents the lifecycle state of a template definition.
 *
 * @api
 */
enum TemplateStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';
    case Archived = 'archived';
}
