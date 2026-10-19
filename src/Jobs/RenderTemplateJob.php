<?php

declare(strict_types=1);

namespace Nvl\Templates\Jobs;

use Illuminate\Contracts\Cache\Repository;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Attributes\FailOnTimeout;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Nvl\Support\Config\PackageOptions;
use Nvl\Support\Ownership\Contracts\OwnershipQueueContext;
use Nvl\Support\Ownership\Contracts\OwnershipQueuedJob;
use Nvl\Support\Ownership\Enums\OwnershipContextMode;
use Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope;
use Nvl\Support\Tenancy\Contracts\TenantQueuedJob;
use Nvl\Support\Tenancy\Enums\TenantContextMode;
use Nvl\Support\Tenancy\ValueObjects\TenantContextSnapshot;
use Nvl\Support\Tenancy\ValueObjects\TenantJobEnvelope;
use Nvl\Templates\Actions\ProcessTemplateRenderAction;
use Nvl\Templates\Enums\TemplateRenderStatus;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Ownership\TemplatesOwnership;
use Nvl\Templates\Services\TemplateRenderFailure;
use Nvl\Templates\Support\TemplateRenderOverlapLock;
use Nvl\Templates\Support\TemplatesConfiguration;
use Throwable;

/**
 * Idempotent queue boundary for persisted template renders.
 */
#[FailOnTimeout]
final class RenderTemplateJob implements OwnershipQueuedJob, ShouldBeUniqueUntilProcessing, ShouldQueue, TenantQueuedJob
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 60;

    public int $uniqueFor = 600;

    public readonly string $processingToken;

    /**
     * Create one generation-bound queued render delivery.
     */
    public function __construct(
        public readonly string $renderId,
        public readonly int $dispatchGeneration = 0,
        ?TenantJobEnvelope $envelope = null,
        ?OwnershipJobEnvelope $ownershipEnvelope = null,
    ) {
        $this->envelope = $envelope ?? new TenantJobEnvelope(
            new TenantContextSnapshot(config('nvl-tenancy.enabled') === true ? TenantContextMode::Unresolved : TenantContextMode::Disabled),
        );
        $this->ownershipEnvelope = $ownershipEnvelope ?? TemplatesOwnership::envelope();
        $this->processingToken = (string) Str::uuid();
        $this->onConnection(PackageOptions::queueConnection('templates'));
        $this->onQueue(PackageOptions::queueName('templates'));
        $this->tries = TemplatesConfiguration::positiveInteger(
            'nvl-templates.rendering.tries',
            3,
        );
        $this->timeout = TemplatesConfiguration::positiveInteger(
            'nvl-templates.rendering.timeout',
            60,
        );
        $this->uniqueFor = TemplatesConfiguration::positiveInteger(
            'nvl-templates.rendering.unique_for',
            600,
        );
    }

    private readonly OwnershipJobEnvelope $ownershipEnvelope;

    /** Return the scalar authority captured before queue serialization. */
    public function ownershipJobEnvelope(): OwnershipJobEnvelope
    {
        return $this->ownershipEnvelope;
    }

    private readonly TenantJobEnvelope $envelope;

    /**
     * Return the persisted render identifier used by Laravel's dispatch lock.
     */
    public function uniqueId(): string
    {
        $identity = $this->renderId.':'.$this->dispatchGeneration;

        if ($this->ownershipEnvelope->context()->mode !== OwnershipContextMode::Disabled) {
            return app(OwnershipQueueContext::class)->run($this->ownershipEnvelope, fn (): string => $this->ownershipEnvelope->key($identity));
        }

        return $this->envelope->context->mode === TenantContextMode::Disabled
            ? $identity
            : hash('sha256', serialize($this->envelope->context)).':'.$identity;
    }

    /** Return the inherited store used by Laravel's unique-job dispatch lock. */
    public function uniqueVia(): Repository
    {
        return Cache::store(PackageOptions::lockStore('templates'));
    }

    /** Return the producer context captured before native queue dispatch. */
    public function tenantJobEnvelope(): TenantJobEnvelope
    {
        return $this->envelope;
    }

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        $backoff = config('nvl-templates.rendering.backoff', [10, 30, 90]);

        if (! is_array($backoff)) {
            return [10, 30, 90];
        }

        $normalized = array_values(array_filter(
            $backoff,
            static fn (mixed $delay): bool => is_int($delay) && $delay > 0,
        ));

        return $normalized === [] ? [10, 30, 90] : $normalized;
    }

    /**
     * Prevent concurrent processing of the same durable render.
     *
     * @return list<WithoutOverlapping>
     */
    public function middleware(): array
    {
        $releaseAfter = $this->backoff()[0] ?? 10;
        $leaseSeconds = TemplatesConfiguration::positiveInteger(
            'nvl-templates.rendering.lease_seconds',
            75,
        );

        return [
            (new TemplateRenderOverlapLock('nvl-templates-render:'.$this->uniqueId()))
                ->withPrefix('nvl:templates:render-overlap:')
                ->releaseAfter($releaseAfter)
                ->expireAfter($leaseSeconds),
        ];
    }

    /**
     * Process the durable render under this job's stable lease token.
     */
    public function handle(ProcessTemplateRenderAction $action): void
    {
        $action->execute(
            $this->renderId,
            $this->processingToken,
            $this->dispatchGeneration,
        );
    }

    /**
     * Mark terminal queue failures without overwriting a newer processor.
     */
    public function failed(?Throwable $exception): void
    {
        if (TemplatesOwnership::declared()) {
            app(TemplateRenderFailure::class)->fail($this->renderId, $this->dispatchGeneration, $this->processingToken, $exception);

            return;
        }
        $message = mb_substr(
            $exception?->getMessage() ?? 'Template render job failed.',
            0,
            4_000,
        );
        $updates = [
            'status' => TemplateRenderStatus::Failed->value,
            'processing_token' => null,
            'lease_expires_at' => null,
            'failure' => $message,
            'failed_at' => now(),
        ];

        if (! (bool) config('nvl-templates.rendering.store_payload', true)) {
            $updates['payload'] = null;
            $updates['settings'] = null;
        }

        $query = TemplateRender::query()
            ->whereKey($this->renderId)
            ->where('dispatch_generation', $this->dispatchGeneration)
            ->where('status', '!=', TemplateRenderStatus::Completed->value);

        if ($this->envelope->context->mode === TenantContextMode::Tenant) {
            $query->where('tenant_id', $this->envelope->context->tenantId?->value);
        } elseif ($this->envelope->context->mode === TenantContextMode::Platform) {
            $query->whereNull('tenant_id');
        }

        $query
            ->where(function (Builder $query): void {
                $query->where('processing_token', $this->processingToken)
                    ->orWhereIn('status', [
                        TemplateRenderStatus::Pending->value,
                        TemplateRenderStatus::Failed->value,
                    ]);
            })
            ->update($updates);
    }
}
