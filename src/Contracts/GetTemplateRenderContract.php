<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\TemplateRender;

/**
 * Defines the consumer-facing GetTemplateRenderAction workflow.
 *
 * @api
 */
interface GetTemplateRenderContract
{
    /**
     * Resolve and authorize one durable render record.
     */
    public function execute(
        TemplateRender|string $render,
        TemplateActorData $actor,
    ): TemplateRender;
}
