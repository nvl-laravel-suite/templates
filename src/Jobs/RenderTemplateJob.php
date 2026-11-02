<?php

declare(strict_types=1);

namespace Nvl\Templates\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Str;
use Nvl\Support\Ownership\Contracts\OwnershipQueuedJob;
use Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope;
use Nvl\Templates\Exceptions\RetryableRenderException;
use Nvl\Templates\Services\RenderProcessor;

final class RenderTemplateJob implements OwnershipQueuedJob, ShouldQueue
{
    use Queueable;

    public int $tries = 0;

    public int $timeout = 60;

    public bool $failOnTimeout = true;

    public readonly string $processingToken;

    public function __construct(public readonly string $renderId, public readonly string $scope, public readonly int $generation, private readonly OwnershipJobEnvelope $ownershipEnvelope)
    {
        $this->processingToken = (string) Str::uuid();
        $connection = config('nvl-templates.rendering.queue.connection');
        $queue = config('nvl-templates.rendering.queue.name', 'templates');
        if (($connection !== null && ! is_string($connection)) || ($queue !== null && ! is_string($queue))) {
            throw new \InvalidArgumentException('Template queue connection and name must be strings or null.');
        }
        $this->onConnection($connection);
        $this->onQueue($queue);
    }

    /** Native scalar envelope captured before dispatch. */
    public function ownershipJobEnvelope(): OwnershipJobEnvelope
    {
        return $this->ownershipEnvelope;
    }

    public function handle(): void
    {
        $record = app(RenderProcessor::class)->run($this->renderId, $this->scope, $this->generation, $this->processingToken);
        if ($record->generation === $this->generation && $record->status === 'retrying') {
            $this->release(max(1, (int) ceil(now()->diffInSeconds($record->available_at, false))));
        }
    }

    public function failed(?\Throwable $error): void
    {
        app(RenderProcessor::class)->fail($this->renderId, $this->scope, $this->generation, $this->processingToken, new RetryableRenderException('worker_failed'));
    }
}
