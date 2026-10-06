<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\Mutations\CreateTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\Template;

/**
 * Defines the consumer-facing CreateTemplateAction workflow.
 *
 * @api
 */
interface CreateTemplateContract
{
    /**
     * Create one stored template and its localized management metadata.
     */
    public function execute(CreateTemplateData $data, TemplateActorData $actor): Template;
}
