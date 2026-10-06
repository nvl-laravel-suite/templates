<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\Mutations\RenderTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateRender;

/**
 * Defines the consumer-facing QueueTemplateRenderAction workflow.
 *
 * @api
 */
interface QueueTemplateRenderContract
{
    /**
     * Execute the execute workflow.
     */
    public function execute(
        Template|string $template,
        RenderTemplateData $data,
        TemplateActorData $actor,
    ): TemplateRender;
}
