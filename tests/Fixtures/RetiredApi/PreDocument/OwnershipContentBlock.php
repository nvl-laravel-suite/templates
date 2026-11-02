<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Content\Models\ContentBlock;
use Nvl\Support\Ownership\ValueObjects\OwnershipDefinition;

/** Consumer-supplied native Content root. */
class OwnershipContentBlock extends ContentBlock
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
