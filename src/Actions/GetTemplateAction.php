<?php

declare(strict_types=1);

namespace Nvl\Templates\Actions;

use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Templates\Contracts\GetTemplateContract;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Loads a complete management aggregate after Action authorization.
 *
 * @api
 */
final readonly class GetTemplateAction implements GetTemplateContract
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private TemplateAuthorization $authorization,
        private OwnershipBoundary $boundary,
    ) {}

    /** Resolve the exact admitted template and authorize its read. */
    public function execute(Template|string $template, TemplateActorData $actor): Template
    {
        $templateId = $template instanceof Template ? $template->id : $template;
        $model = $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')
            ->with([
                'translations',
                'versions',
                'assignments',
            ])
            ->findOrFail($templateId);
        $this->authorization->authorize(
            TemplateAbility::View,
            $actor,
            ['template_id' => $model->id],
        );

        return $model;
    }
}
