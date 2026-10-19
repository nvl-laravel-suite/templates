<?php

declare(strict_types=1);

namespace Nvl\Templates\Tenancy;

use Illuminate\Container\Container;
use Nvl\Support\Tenancy\Enums\TenantResourceKind;
use Nvl\Support\Tenancy\Services\TenantResourceRegistry;
use Nvl\Support\Tenancy\ValueObjects\TenantResourceDefinition;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateTranslation;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Tenancy\Services\TenantAdoptionRegistry;

final readonly class TemplatesResourceRegistrar
{
    /** Register the canonical capabilities without capturing current admission. */
    public function register(TenantResourceRegistry $resources, ?TenantAdoptionRegistry $adapters = null): void
    {
        foreach ([
            new TenantResourceDefinition('templates.templates', 'templates', Container::getInstance()->make(TemplateModelRegistry::class)->prepare(), allowsPlatformCatalog: true),
            new TenantResourceDefinition('templates.translations', 'templates', TemplateTranslation::class, TenantResourceKind::Inherited, 'templates.templates', 'template'),
            new TenantResourceDefinition('templates.versions', 'templates', TemplateVersion::class, TenantResourceKind::Inherited, 'templates.templates', 'template'),
            new TenantResourceDefinition('templates.assignments', 'templates', TemplateAssignment::class, TenantResourceKind::Inherited, 'templates.templates', 'template'),
            new TenantResourceDefinition('templates.renders', 'templates', TemplateRender::class, TenantResourceKind::Inherited, 'templates.templates', 'template'),
        ] as $resource) {
            $resources->register($resource);
        }
        $adapters?->register('templates', TemplatesAdoptionAdapter::class);
    }
}
