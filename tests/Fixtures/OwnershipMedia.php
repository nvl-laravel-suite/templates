<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Media\Models\Media;
use Nvl\Support\Ownership\ValueObjects\OwnershipDefinition;

/** Consumer Media storage with the same native owner. */
class OwnershipMedia extends Media
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
