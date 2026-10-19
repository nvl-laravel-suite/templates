<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Database\Eloquent\Model;
use Nvl\Content\Contracts\ContentOwner;
use Nvl\Content\Contracts\OwnershipContentCatalogCopyAccess;
use Nvl\Support\Tenancy\Exceptions\TenantBoundaryViolation;
use Nvl\Support\Tenancy\ValueObjects\TenantId;
use Nvl\Templates\Enums\TemplateVersionStatus;
use Nvl\Templates\Models\TemplateTenantGrant;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Ownership\TemplateCatalogSource;

/**
 * Applies either authority’s exact catalog capability before exposing immutable Content.
 *
 * @internal
 */
final readonly class TemplateContentCopyAccess implements OwnershipContentCatalogCopyAccess
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(private TemplateCatalogSource $native) {}

    /** Resolve the current grant-authorized canonical central Content owner. */
    public function canonicalSource(string $ownerId, string $group, string $grantId, bool $lock = false): Model&ContentOwner
    {
        return $this->native->granted($ownerId, $group, $grantId, $lock);
    }

    /** Validate the exact legacy recipient grant before exposing its Content source. */
    public function assertAllowed(string $ownerId, string $group, string $grantId, TenantId $destination): void
    {
        $grant = TemplateTenantGrant::query()->with(['version.template'])->whereKey($grantId)->first();
        if (! $grant instanceof TemplateTenantGrant || $group !== TemplateVersion::CONTENT_GROUP
            || $grant->template_version_id !== $ownerId || $grant->recipient_tenant_id !== $destination->value
            || $grant->revoked_at !== null || $grant->version->revision !== $grant->source_revision
            || $grant->version->status !== TemplateVersionStatus::Published
            || $grant->version->template->tenant_id !== null || $grant->version->template->ownership_key !== 'platform') {
            throw new TenantBoundaryViolation('Template Content catalog grant is unavailable.');
        }
    }
}
