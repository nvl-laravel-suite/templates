<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\Mutations\AssignTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAssignment;

/**
 * Defines the consumer-facing AssignTemplateAction workflow.
 *
 * @api
 */
interface AssignTemplateContract
{
    /**
     * Create or revise one exact owner and profile assignment.
     */
    public function execute(
        Template|string $template,
        AssignTemplateData $data,
        TemplateActorData $actor,
    ): TemplateAssignment;
}
