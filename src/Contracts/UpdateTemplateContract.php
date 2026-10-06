<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Nvl\Templates\Data\Mutations\UpdateTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\Template;
use Nvl\Translatable\Enums\TranslationSyncMode;

/**
 * Defines the consumer-facing UpdateTemplateAction workflow.
 *
 * @api
 */
interface UpdateTemplateContract
{
    /**
     * Update one stored template using its exact optimistic revision.
     */
    public function execute(
        Template|string $template,
        UpdateTemplateData $data,
        TemplateActorData $actor,
        TranslationSyncMode $translationMode = TranslationSyncMode::Replace,
    ): Template;
}
