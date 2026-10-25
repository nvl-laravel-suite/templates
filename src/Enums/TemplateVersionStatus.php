<?php

declare(strict_types=1);

namespace Nvl\Templates\Enums;

/**
 * Represents the publication state of an immutable template version.
 */
enum TemplateVersionStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Retired = 'retired';
}
