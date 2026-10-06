<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Models\TemplateTenantGrant;

/**
 * Defines the consumer-facing RevokeTemplateTenantGrantAction workflow.
 *
 * @api
 */
interface RevokeTemplateTenantGrantContract
{
    /**
     * Execute the execute workflow.
     */
    public function execute(string $grantId, int $expectedRevision): TemplateTenantGrant;
}
