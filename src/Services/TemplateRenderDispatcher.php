<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Nvl\Support\Config\PackageOptions;
use Nvl\Support\Tenancy\Contracts\TenantBoundary;
use Nvl\Support\Tenancy\Contracts\TenantContext;
use Nvl\Support\Tenancy\ValueObjects\TenantJobEnvelope;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Models\TemplateRender;

/**
 * Dispatches persisted renders onto the package-configured queue boundary.
 */
final readonly class TemplateRenderDispatcher
{
    public function __construct(
        private TenantContext $context,
        private TenantBoundary $boundary,
    ) {}

    /**
     * Dispatch one persisted render after its owning transaction has committed.
     */
    public function dispatch(string $renderId, ?TenantJobEnvelope $envelope = null): void
    {
        $render = $this->boundary->query(TemplateRender::query(), 'templates.renders')
            ->findOrFail($renderId);
        $pending = RenderTemplateJob::dispatch(
            $render->id,
            $render->dispatch_generation,
            $envelope ?? TenantJobEnvelope::capture($this->context),
        );

        $pending->onConnection(PackageOptions::queueConnection('templates'));
        $pending->onQueue(PackageOptions::queueName('templates'));
    }
}
