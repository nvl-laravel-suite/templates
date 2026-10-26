<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Nvl\Support\Config\PackageOptions;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Models\TemplateRender;

/**
 * Dispatches persisted renders onto the package-configured queue boundary.
 *
 * @internal
 */
final readonly class TemplateRenderDispatcher
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private OwnershipBoundary $boundary,
    ) {}

    /**
     * Dispatch one persisted render after its owning transaction has committed.
     */
    public function dispatch(string $renderId, ?OwnershipJobEnvelope $ownershipEnvelope = null): void
    {
        $render = $this->boundary->query(TemplateRender::query(), 'templates.renders')
            ->findOrFail($renderId);
        $pending = RenderTemplateJob::dispatch(
            $render->id,
            $render->dispatch_generation,
            $ownershipEnvelope,
        );

        $pending->onConnection(PackageOptions::queueConnection('templates'));
        $pending->onQueue(PackageOptions::queueName('templates'));
    }
}
