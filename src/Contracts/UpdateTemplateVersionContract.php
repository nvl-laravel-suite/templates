<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\Mutations\UpdateTemplateVersionData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\TemplateVersion;

/**
 * Defines the consumer-facing UpdateTemplateVersionAction workflow.
 *
 * @api
 */
interface UpdateTemplateVersionContract
{
    /**
     * Execute the execute workflow.
     */
    public function execute(
        TemplateVersion|string $version,
        UpdateTemplateVersionData $data,
        TemplateActorData $actor,
    ): TemplateVersion;
}
