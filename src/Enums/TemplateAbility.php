<?php

declare(strict_types=1);

namespace Nvl\Templates\Enums;

/**
 * Enumerates capabilities protected by the template authorization boundary.
 *
 * @api
 */
enum TemplateAbility: string
{
    case List = 'list';
    case View = 'view';
    case Create = 'create';
    case Update = 'update';
    case Publish = 'publish';
    case Assign = 'assign';
    case Render = 'render';
    case Delete = 'delete';
}
