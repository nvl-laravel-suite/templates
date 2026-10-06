<?php

declare(strict_types=1);

namespace Nvl\Templates\Actions;

use Nvl\Support\Tenancy\Contracts\TenantBoundary;
use Nvl\Templates\Contracts\GetTemplateContract;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Models\Template;

/**
 * Loads a complete management aggregate after Action authorization.
 *
 * @api
 */
final readonly class GetTemplateAction implements GetTemplateContract
{
    public function __construct(
        private TemplateAuthorization $authorization,
        private TenantBoundary $boundary,
    ) {}

    public function execute(Template|string $template, TemplateActorData $actor): Template
    {
        $templateId = $template instanceof Template ? $template->id : $template;
        $model = $this->boundary->query(Template::query(), 'templates.templates')
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
