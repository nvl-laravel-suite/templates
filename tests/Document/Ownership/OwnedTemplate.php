<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Ownership;

use Nvl\Support\Ownership\ValueObjects\OwnershipDefinition;
use Nvl\Templates\Models\Template;

/** @property int|string $company_id */
final class OwnedTemplate extends Template
{
    public static function ownershipDefinition(): OwnershipDefinition
    {
        return OwnershipDefinition::column(TestCompany::class, 'company_id');
    }
}
