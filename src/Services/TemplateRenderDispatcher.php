<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Nvl\Support\Config\PackageOptions;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope;
use Nvl\Support\Tenancy\Contracts\TenantContext;
use Nvl\Support\Tenancy\ValueObjects\TenantJobEnvelope;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Models\TemplateRender;

/**
 * Dispatches persisted renders onto the package-configured queue boundary.
 */
final readonly class TemplateRenderDispatcher
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private TenantContext $context,
        private OwnershipBoundary $boundary,
    ) {}

    /**
     * Dispatch one persisted render after its owning transaction has committed.
     */
    public function dispatch(string $renderId, ?TenantJobEnvelope $envelope = null, ?OwnershipJobEnvelope $ownershipEnvelope = null): void
    {
        $render = $this->boundary->query(TemplateRender::query(), 'templates.renders')
            ->findOrFail($renderId);
        $pending = RenderTemplateJob::dispatch(
            $render->id,
            $render->dispatch_generation,
            $envelope ?? TenantJobEnvelope::capture($this->context),
            $ownershipEnvelope,
        );

        $pending->onConnection(PackageOptions::queueConnection('templates'));
        $pending->onQueue(PackageOptions::queueName('templates'));
    }
}
