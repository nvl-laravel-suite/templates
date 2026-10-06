<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\Template;

/**
 * Defines the consumer-facing GetTemplateAction workflow.
 *
 * @api
 */
interface GetTemplateContract
{
    /**
     * Execute the execute workflow.
     */
    public function execute(Template|string $template, TemplateActorData $actor): Template;
}
