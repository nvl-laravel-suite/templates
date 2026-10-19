<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Nvl\Support\Ownership\Exceptions\OwnershipViolation;
use Nvl\Templates\Contracts\TemplateCatalogAccess;

/**
 * Catalog management requires an explicit application policy.
 *
 * @internal
 */
final readonly class DenyTemplateCatalogAccess implements TemplateCatalogAccess
{
    /** Authorize issuance for the currently admitted recipient. */
    public function assertCanGrant(string $sourceId, int $revision): void
    {
        throw new OwnershipViolation('Template catalog grant access is not configured.');
    }

    /** Authorize revocation of the current recipient capability. */
    public function assertCanRevoke(string $grantId): void
    {
        throw new OwnershipViolation('Template catalog revocation access is not configured.');
    }
}
