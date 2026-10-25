<?php

declare(strict_types=1);

namespace Nvl\Templates\Enums;

/**
 * Represents the lifecycle state of a queued or persisted render.
 */
enum TemplateRenderStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Completed = 'completed';
    case Failed = 'failed';
}
