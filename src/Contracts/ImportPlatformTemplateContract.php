<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\Mutations\ImportPlatformTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\TemplateVersion;

/**
 * Defines the consumer-facing ImportPlatformTemplateAction workflow.
 *
 * @api
 */
interface ImportPlatformTemplateContract
{
    /**
     * Execute the execute workflow.
     */
    public function execute(ImportPlatformTemplateData $data, TemplateActorData $actor): TemplateVersion;
}
