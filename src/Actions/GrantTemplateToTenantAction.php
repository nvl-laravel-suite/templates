<?php

declare(strict_types=1);

namespace Nvl\Templates\Actions;

use Nvl\Support\Tenancy\Contracts\TenantContext;
use Nvl\Support\Tenancy\Contracts\TenantDirectory;
use Nvl\Support\Tenancy\Enums\TenantContextMode;
use Nvl\Support\Tenancy\Enums\TenantStatus;
use Nvl\Support\Tenancy\Exceptions\TenantBoundaryViolation;
use Nvl\Support\Tenancy\ValueObjects\TenantId;
use Nvl\Templates\Contracts\GrantTemplateToTenantContract;
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Enums\TemplateVersionStatus;
use Nvl\Templates\Models\TemplateTenantGrant;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Support\TemplatesConfiguration;

/**
 * Grant a published platform template version to an active tenant.
 *
 * @api
 */
final readonly class GrantTemplateToTenantAction implements GrantTemplateToTenantContract
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(private TenantContext $context, private TenantDirectory $directory) {}

    /** Grant a published platform version to the explicit legacy recipient. */
    public function execute(string $versionId, TenantId $recipient, int $sourceRevision): TemplateTenantGrant
    {
        if ($this->context->snapshot()->mode !== TenantContextMode::Platform || $this->directory->find($recipient)->status !== TenantStatus::Active) {
            throw new TenantBoundaryViolation('Template catalog grants require platform context and an active recipient.');
        }

        return TemplateModelRegistry::newInstance()->getConnection()->transaction(function () use ($versionId, $recipient, $sourceRevision): TemplateTenantGrant {
            $connection = TemplateModelRegistry::newInstance()->getConnection();
            $lockTable = TemplatesConfiguration::table(TemplatesTables::get(TemplatesTables::TenantGrantLocks));
            $connection->table($lockTable)->insertOrIgnore([
                'recipient_tenant_id' => $recipient->value,
                'template_version_id' => $versionId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $connection->table($lockTable)
                ->where('recipient_tenant_id', $recipient->value)
                ->where('template_version_id', $versionId)
                ->lockForUpdate()
                ->first();
            $version = TemplateVersion::query()->with('template')->lockForUpdate()->findOrFail($versionId);
            if ($version->revision !== $sourceRevision || $version->template->ownership_key !== 'platform' || $version->template->tenant_id !== null) {
                throw new TenantBoundaryViolation('Template catalog source revision is unavailable.');
            }

            if ($version->status !== TemplateVersionStatus::Published) {
                throw new TenantBoundaryViolation('Only published Template versions may be granted.');
            }

            $existing = TemplateTenantGrant::query()
                ->where('template_version_id', $versionId)
                ->where('recipient_tenant_id', $recipient->value)
                ->lockForUpdate()
                ->first();

            if ($existing instanceof TemplateTenantGrant) {
                $existing->forceFill([
                    'source_revision' => $sourceRevision,
                    'revision' => $existing->revision + 1,
                    'revoked_at' => null,
                ])->save();

                return $existing->refresh();
            }

            return TemplateTenantGrant::query()->create([
                'template_version_id' => $version->id,
                'recipient_tenant_id' => $recipient->value,
                'source_revision' => $sourceRevision,
                'revision' => 1,
            ]);
        });
    }
}
