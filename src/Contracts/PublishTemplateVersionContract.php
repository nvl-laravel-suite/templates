<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\TemplateVersion;

/**
 * Defines the consumer-facing PublishTemplateVersionAction workflow.
 *
 * @api
 */
interface PublishTemplateVersionContract
{
    /**
     * Publish one synchronized draft and retire its published predecessor.
     */
    public function execute(
        TemplateVersion|string $version,
        int $expectedRevision,
        TemplateActorData $actor,
    ): TemplateVersion;
}
