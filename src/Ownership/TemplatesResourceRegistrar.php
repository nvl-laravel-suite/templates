<?php

declare(strict_types=1);

namespace Nvl\Templates\Ownership;

use Nvl\Support\Ownership\Services\OwnershipResourceRegistry;
use Nvl\Support\Ownership\ValueObjects\OwnershipDefinition;
use Nvl\Support\Ownership\ValueObjects\OwnershipResourceDefinition;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateOwnerGrant;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateTenantGrant;
use Nvl\Templates\Models\TemplateTranslation;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Compiles one exact root and canonical version, assignment and durable-render graph.
 *
 * @internal
 */
final readonly class TemplatesResourceRegistrar
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(private TemplateModelRegistry $models) {}

    /** Register the canonical capabilities without capturing current admission. */
    public function register(OwnershipResourceRegistry $resources): void
    {
        $class = $this->models->templateClass();
        $owned = $class::ownershipDefinition()->strategy !== 'unscoped';
        $central = $owned && $class::allowsCentralCatalog();
        $resources->register(new OwnershipResourceDefinition('templates.templates', 'templates', $class, $class::ownershipDefinition(), allowsCentral: $central));
        $resources->register(new OwnershipResourceDefinition('templates.catalog-grants', 'templates', $owned ? TemplateOwnerGrant::class : TemplateTenantGrant::class, $owned ? OwnershipDefinition::captured() : OwnershipDefinition::unscoped(), immutableFields: $owned ? ['template_version_id', 'source_revision'] : []));
        foreach (['templates.translations' => TemplateTranslation::class, 'templates.versions' => TemplateVersion::class, 'templates.assignments' => TemplateAssignment::class, 'templates.renders' => TemplateRender::class] as $key => $model) {
            $immutable = match ($key) {
                'templates.assignments' => ['owner_type', 'owner_id', 'profile'],
                'templates.renders' => ['template_version_id', 'locale', 'profile', 'payload_digest', 'requested_by_type', 'requested_by', 'idempotency_key'],
                'templates.versions' => ['version', 'catalog_grant_id', 'catalog_source_version_id', 'catalog_source_revision', 'catalog_source_hash', 'catalog_import_key', 'catalog_import_request_hash'],
                default => [],
            };
            $resources->register(new OwnershipResourceDefinition($key, 'templates', $model, $owned ? OwnershipDefinition::inherited('template') : OwnershipDefinition::unscoped(), parentResource: $owned ? 'templates.templates' : null, allowsCentral: $central, immutableFields: $owned ? $immutable : []));
        }
    }
}
