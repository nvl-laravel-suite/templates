<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\RenderedTemplateData;
use Nvl\Templates\Template;

/**
 * Defines the consumer-facing RenderTemplateAction workflow.
 *
 * @api
 */
interface RenderTemplateContract
{
    /**
     * Render the supplied Template and return verified output bytes.
     */
    public function execute(Template $template): RenderedTemplateData;
}
