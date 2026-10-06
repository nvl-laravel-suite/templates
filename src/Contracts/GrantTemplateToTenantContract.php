<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Support\Tenancy\ValueObjects\TenantId;
use Nvl\Templates\Models\TemplateTenantGrant;

/**
 * Defines the consumer-facing GrantTemplateToTenantAction workflow.
 *
 * @api
 */
interface GrantTemplateToTenantContract
{
    /**
     * Execute the execute workflow.
     */
    public function execute(string $versionId, TenantId $recipient, int $sourceRevision): TemplateTenantGrant;
}
