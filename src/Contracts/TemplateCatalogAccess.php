<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

/**
 * Host policy authorizes grant issuance/revocation for the currently admitted recipient.
 *
 * @api
 */
interface TemplateCatalogAccess
{
    /** Authorize issuance for the currently admitted recipient. */
    public function assertCanGrant(string $sourceId, int $revision): void;

    /** Authorize revocation of the current recipient capability. */
    public function assertCanRevoke(string $grantId): void;
}
