<?php

declare(strict_types=1);

namespace Nvl\Templates\Ownership;

use Nvl\Support\Ownership\Services\OwnershipResourceRegistry;
use Nvl\Support\Ownership\ValueObjects\OwnershipDefinition;
use Nvl\Support\Ownership\ValueObjects\OwnershipResourceDefinition;
use Nvl\Templates\Models\FamilyChange;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Models\TemplateGroupRevision;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Models\TemplateResourceRevision;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Registers one canonical document/family/resource Ownership graph.
 *
 * @internal
 */
final readonly class TemplatesResourceRegistrar
{
    public function __construct(private TemplateModelRegistry $models) {}

    public function register(OwnershipResourceRegistry $resources): void
    {
        $class = $this->models->templateClass();
        $owned = $class::ownershipDefinition()->strategy !== 'unscoped';
        $resources->register(new OwnershipResourceDefinition('templates.templates', 'templates', $class, $class::ownershipDefinition()));
        foreach (['groups' => TemplateGroup::class, 'resources' => TemplateResource::class, 'assets' => TemplateAsset::class] as $key => $model) {
            $resources->register(new OwnershipResourceDefinition('templates.'.$key, 'templates', $model, $owned ? OwnershipDefinition::captured() : OwnershipDefinition::unscoped()));
        }
        foreach ([
            'drafts' => [TemplateDraft::class, 'template', 'templates.templates'],
            'revisions' => [TemplateRevision::class, 'template', 'templates.templates'],
            'family-changes' => [FamilyChange::class, 'template', 'templates.templates'],
            'group-revisions' => [TemplateGroupRevision::class, 'group', 'templates.groups'],
            'resource-revisions' => [TemplateResourceRevision::class, 'resource', 'templates.resources'],
            'renders' => [TemplateRender::class, 'revision', 'templates.revisions'],
        ] as $key => [$model, $relation, $parent]) {
            $resources->register(new OwnershipResourceDefinition('templates.'.$key, 'templates', $model, $owned ? OwnershipDefinition::inherited($relation) : OwnershipDefinition::unscoped(), parentResource: $owned ? $parent : null));
        }
    }
}
