<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\Mutations\CreateTemplateVersionData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateVersion;

/**
 * Defines the consumer-facing CreateTemplateVersionAction workflow.
 *
 * @api
 */
interface CreateTemplateVersionContract
{
    /**
     * Execute the execute workflow.
     */
    public function execute(
        Template|string $template,
        CreateTemplateVersionData $data,
        TemplateActorData $actor,
    ): TemplateVersion;
}
