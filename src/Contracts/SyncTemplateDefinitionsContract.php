<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Illuminate\Support\Collection;
use Nvl\Templates\Data\TemplateDefinitionSyncData;

/**
 * Defines the consumer-facing SyncTemplateDefinitionsAction workflow.
 *
 * @api
 */
interface SyncTemplateDefinitionsContract
{
    /**
     * Plan or apply one complete source-definition synchronization.
     *
     * @return Collection<int, TemplateDefinitionSyncData>
     */
    public function execute(bool $dryRun = false): Collection;
}
