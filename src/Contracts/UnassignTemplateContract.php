<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\TemplateAssignment;

/**
 * Defines the consumer-facing UnassignTemplateAction workflow.
 *
 * @api
 */
interface UnassignTemplateContract
{
    /**
     * Execute the execute workflow.
     */
    public function execute(
        TemplateAssignment|string $assignment,
        int $expectedRevision,
        TemplateActorData $actor,
    ): bool;
}
