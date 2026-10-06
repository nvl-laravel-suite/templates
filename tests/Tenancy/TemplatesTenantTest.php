<?php

declare(strict_types=1);

use Nvl\Support\Tenancy\Enums\TenantContextMode;
use Nvl\Support\Tenancy\Enums\TenantResourceKind;
use Nvl\Support\Tenancy\Services\TenantResourceRegistry;
use Nvl\Support\Tenancy\ValueObjects\TenantContextSnapshot;
use Nvl\Support\Tenancy\ValueObjects\TenantId;
use Nvl\Support\Tenancy\ValueObjects\TenantJobEnvelope;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateVersion;

it('registers the complete template ownership graph', function (): void {
    $resources = app(TenantResourceRegistry::class);

    expect($resources->get('templates.templates')->model)->toBe(Template::class)
        ->and($resources->get('templates.templates')->allowsPlatformCatalog)->toBeTrue()
        ->and($resources->get('templates.versions')->model)->toBe(TemplateVersion::class)
        ->and($resources->get('templates.versions')->kind)->toBe(TenantResourceKind::Inherited)
        ->and($resources->get('templates.assignments')->model)->toBe(TemplateAssignment::class)
        ->and($resources->get('templates.renders')->model)->toBe(TemplateRender::class);
});

it('tenant qualifies queue uniqueness while preserving disabled compatibility', function (): void {
    $renderId = '01995b8b-07ac-7338-bb23-41f09c13d001';
    $tenantA = new TenantJobEnvelope(new TenantContextSnapshot(
        TenantContextMode::Tenant,
        new TenantId('01995b8b-07ac-7338-bb23-41f09c13d00a'),
    ));
    $tenantB = new TenantJobEnvelope(new TenantContextSnapshot(
        TenantContextMode::Tenant,
        new TenantId('01995b8b-07ac-7338-bb23-41f09c13d00b'),
    ));

    $a = new RenderTemplateJob($renderId, 3, $tenantA);
    $b = new RenderTemplateJob($renderId, 3, $tenantB);
    $disabled = new RenderTemplateJob($renderId, 3);

    expect($a->uniqueId())->not->toBe($b->uniqueId())
        ->and($a->tenantJobEnvelope())->toBe($tenantA)
        ->and($disabled->uniqueId())->toBe($renderId.':3');
});
