<?php

declare(strict_types=1);

namespace Nvl\Templates\Actions;

use Nvl\Support\Events\DomainEventDispatcher;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Templates\Contracts\CreateTemplateVersionContract;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Data\Mutations\CreateTemplateVersionData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Events\TemplateChanged;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateContentGuard;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Creates the next immutable numbered draft under a template lock.
 *
 * @api
 */
final readonly class CreateTemplateVersionAction implements CreateTemplateVersionContract
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private TemplateAuthorization $authorization,
        private TemplateContentGuard $guard,
        private OwnershipBoundary $boundary,
        private DomainEventDispatcher $domainEvents,
    ) {}

    /** Allocate the next draft version under the canonical template lock. */
    public function execute(
        Template|string $template,
        CreateTemplateVersionData $data,
        TemplateActorData $actor,
    ): TemplateVersion {
        $templateId = $template instanceof Template ? $template->id : $template;
        $this->authorization->authorize(
            TemplateAbility::Update,
            $actor,
            ['template_id' => $templateId],
        );

        $this->guard->metadata($data->metadata);

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use ($actor, $data, $templateId): TemplateVersion {
                $template = $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')
                    ->lockForUpdate()
                    ->findOrFail($templateId);
                $currentVersion = $template->versions()->max('version');
                $nextVersion = is_numeric($currentVersion) ? ((int) $currentVersion) + 1 : 1;
                $version = $template->versions()->create([
                    ...(config('nvl-tenancy.enabled') === true ? ['tenant_id' => $template->tenant_id] : []),
                    'version' => $nextVersion,
                    'metadata' => $data->metadata,
                ]);
                $this->domainEvents->dispatch(new TemplateChanged($template->id, 'version_created', $actor), $template->getConnection());

                return $version;
            });
    }
}
