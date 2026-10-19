<?php

declare(strict_types=1);

namespace Nvl\Templates\Ownership;

use Illuminate\Database\Query\Builder;
use Nvl\Content\Contracts\ContentSnapshotIntegrity;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Support\Ownership\Contracts\OwnershipContext;
use Nvl\Support\Ownership\Contracts\OwnershipReadiness;
use Nvl\Support\Ownership\Enums\OwnershipContextMode;
use Nvl\Support\Ownership\Exceptions\OwnershipViolation;
use Nvl\Support\Ownership\Services\OwnershipResourceRegistry;
use Nvl\Support\Ownership\Services\OwnershipScope;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Enums\TemplateVersionStatus;
use Nvl\Templates\Models\TemplateOwnerGrant;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Narrow central reads pinned to a current recipient capability; never a general unscoped query port.
 *
 * @internal
 */
final readonly class TemplateCatalogSource
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private OwnershipBoundary $boundary,
        private OwnershipContext $context,
        private OwnershipReadiness $readiness,
        private OwnershipResourceRegistry $resources,
        private ContentSnapshotIntegrity $integrity,
    ) {}

    /** Require an explicit central catalog and a currently admitted recipient. */
    public function admit(): void
    {
        if ($this->context->snapshot()->mode !== OwnershipContextMode::Owner || ! $this->resources->get('templates.templates')->allowsCentral) {
            throw new OwnershipViolation('Template copies require an explicit central catalog and current recipient.');
        }
        $this->boundary->attributes('templates.catalog-grants');
        foreach (['templates.templates', 'templates.versions', 'content.blocks'] as $key) {
            $this->readiness->assertActive($key);
        }
    }

    /** Read one immutable central publication through the admitted recipient boundary. */
    public function version(string $id, bool $lock = false): TemplateVersion
    {
        $this->admit();
        $v = TemplateVersion::query()->withoutGlobalScope(OwnershipScope::class)->useWritePdo()->whereKey($id)->where('owner_scope_key', 'central');
        if ($lock) {
            $v->lockForUpdate();
        }
        $version = $v->first() ?? throw new OwnershipViolation('Central Template version is unavailable.');
        $query = TemplateModelRegistry::query()->withoutGlobalScope(OwnershipScope::class)->useWritePdo()->whereKey($version->template_id)->where('owner_scope_key', 'central');
        $definition = $this->resources->get('templates.templates')->ownership;
        if ($definition->strategy === 'column') {
            $query->whereNull($definition->foreignKey ?? throw new OwnershipViolation);
        } elseif ($definition->strategy === 'pivot') {
            $root = $query->getModel();
            $query->whereNotExists(fn (Builder $q) => $q->selectRaw('1')->from($definition->table ?? throw new OwnershipViolation)->whereColumn($definition->resourceKey ?? throw new OwnershipViolation, $root->getQualifiedKeyName()));
        } else {
            throw new OwnershipViolation('Central Template requires native ownership.');
        }
        if ($lock) {
            $query->lockForUpdate();
        }
        $template = $query->first() ?? throw new OwnershipViolation('Central Template root is unavailable.');
        if ($template->status !== TemplateStatus::Active) {
            throw new OwnershipViolation('The central Template is archived.');
        }
        $snapshot = $version->content_snapshot;
        if ($version->status !== TemplateVersionStatus::Published || $snapshot === null || $snapshot->ownerId !== $version->id || $snapshot->ownerType !== $version->getMorphClass() || $snapshot->group !== TemplateVersion::CONTENT_GROUP || $snapshot->formatVersion !== 3 || $snapshot->tenantId !== null || $snapshot->ownershipContext !== ['mode' => 'central', 'owner' => null] || $version->content_hash !== $snapshot->version) {
            throw new OwnershipViolation('Central Template publication identity is invalid.');
        }
        $this->integrity->assertValid($snapshot);

        return $version->setRelation('template', $template);
    }

    /** Recheck the exact current grant and its canonical central source. */
    public function granted(string $versionId, string $group, string $grantId, bool $lock = false): TemplateVersion
    {
        $this->admit();
        $query = TemplateOwnerGrant::query()->whereKey($grantId);
        $grant = $query->first() ?? throw new OwnershipViolation('Template grant is unavailable.');
        if ($grant->template_version_id !== $versionId || $group !== TemplateVersion::CONTENT_GROUP || $grant->revoked_at !== null) {
            throw new OwnershipViolation('Template grant is revoked or refers to another source.');
        }
        $version = $this->version($versionId, $lock);
        if ($lock) {
            $grant = $query->lockForUpdate()->first() ?? throw new OwnershipViolation('Template grant is unavailable.');
        }
        if ($grant->template_version_id !== $versionId || $grant->revoked_at !== null || $grant->source_revision !== $version->revision) {
            throw new OwnershipViolation('Template source revision changed.');
        }

        return $version;
    }
}
