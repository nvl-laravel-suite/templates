<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\Mutations\RenderTemplateData;
use Nvl\Templates\Data\RenderedTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\Template as StoredTemplate;

/**
 * Defines the consumer-facing RenderStoredTemplateAction workflow.
 *
 * @api
 */
interface RenderStoredTemplateContract
{
    /**
     * Resolve and render one published stored template.
     */
    public function execute(
        StoredTemplate|string $template,
        RenderTemplateData $data,
        TemplateActorData $actor,
    ): RenderedTemplateData;
}
