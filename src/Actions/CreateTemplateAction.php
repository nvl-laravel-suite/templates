<?php

declare(strict_types=1);

namespace Nvl\Templates\Actions;

use Nvl\Support\Events\DomainEventDispatcher;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Templates\Contracts\CreateTemplateContract;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Data\Mutations\CreateTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Events\TemplateChanged;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Services\TemplateContentGuard;
use Nvl\Templates\Services\TemplateDefinitionRegistry;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Translatable\Services\TranslationWriter;

/**
 * Creates a translated stored template from its source-authoritative definition.
 *
 * @api
 */
final readonly class CreateTemplateAction implements CreateTemplateContract
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private TemplateAuthorization $authorization,
        private TemplateDefinitionRegistry $definitions,
        private TemplateContentGuard $guard,
        private TranslationWriter $translations,
        private OwnershipBoundary $boundary,
        private DomainEventDispatcher $domainEvents,
    ) {}

    /**
     * Create one stored template and its localized management metadata.
     */
    public function execute(CreateTemplateData $data, TemplateActorData $actor): Template
    {
        $this->authorization->authorize(TemplateAbility::Create, $actor, ['key' => $data->key]);
        $definition = $this->definitions->get($data->key);
        $this->guard->metadata($data->metadata);

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use ($actor, $data, $definition): Template {
                $template = TemplateModelRegistry::create([
                    ...$this->boundary->attributes('templates.templates'),
                    'key' => $data->key,
                    'renderer' => $definition->renderer,
                    'status' => $data->status,
                    'schema' => $definition->schema,
                    'metadata' => $data->metadata,
                ]);
                $this->translations->replace($template, $data->translations);
                $template->load('translations');
                $this->domainEvents->dispatch(new TemplateChanged($template->id, 'created', $actor), $template->getConnection());

                return $template;
            });
    }
}
