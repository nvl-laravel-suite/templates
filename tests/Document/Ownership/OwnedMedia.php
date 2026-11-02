<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Ownership;

use Nvl\Media\Models\Media;
use Nvl\Support\Ownership\ValueObjects\OwnershipDefinition;

/** @property int|string $company_id */
final class OwnedMedia extends Media
{
    public static function ownershipDefinition(): OwnershipDefinition
    {
        return OwnershipDefinition::column(TestCompany::class, 'company_id');
    }
}
