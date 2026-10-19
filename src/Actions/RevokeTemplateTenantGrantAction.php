<?php

declare(strict_types=1);

namespace Nvl\Templates\Actions;

use Nvl\Support\Tenancy\Contracts\TenantContext;
use Nvl\Support\Tenancy\Enums\TenantContextMode;
use Nvl\Support\Tenancy\Exceptions\TenantBoundaryViolation;
use Nvl\Templates\Contracts\RevokeTemplateTenantGrantContract;
use Nvl\Templates\Exceptions\StaleTemplateException;
use Nvl\Templates\Models\TemplateTenantGrant;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Revoke a template tenant grant at its expected revision.
 *
 * @api
 */
final readonly class RevokeTemplateTenantGrantAction implements RevokeTemplateTenantGrantContract
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(private TenantContext $context) {}

    /** Revoke an exact legacy tenant grant at its expected revision. */
    public function execute(string $grantId, int $expectedRevision): TemplateTenantGrant
    {
        if ($this->context->snapshot()->mode !== TenantContextMode::Platform) {
            throw new TenantBoundaryViolation('Template catalog revocation requires platform context.');
        }

        return TemplateModelRegistry::newInstance()->getConnection()->transaction(function () use ($grantId, $expectedRevision): TemplateTenantGrant {
            $grant = TemplateTenantGrant::query()->lockForUpdate()->findOrFail($grantId);
            if ($grant->revision !== $expectedRevision) {
                throw StaleTemplateException::forResource('template grant', $grantId);
            }
            $grant->forceFill(['revoked_at' => now(), 'revision' => $grant->revision + 1])->save();

            return $grant->refresh();
        });
    }
}
