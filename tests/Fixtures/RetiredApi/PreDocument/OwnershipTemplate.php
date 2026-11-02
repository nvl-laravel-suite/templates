<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Support\Ownership\ValueObjects\OwnershipDefinition;
use Nvl\Templates\Models\Template;

/** Consumer-controlled native Template root. */
class OwnershipTemplate extends Template
{
    public static function ownershipDefinition(): OwnershipDefinition
    {
        return OwnershipDefinition::column(OwnershipCompany::class, 'company_id');
    }

    public static function allowsCentralCatalog(): bool
    {
        return true;
    }
}
