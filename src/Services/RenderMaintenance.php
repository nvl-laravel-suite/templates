<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\RenderConfiguration;

/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * @internal
 */
final class RenderMaintenance
{
    public function __construct(
        private readonly RenderDispatcher $dispatcher,
        private readonly RenderArtifacts $artifacts,
    ) {}

    public function recover(int $limit = 100): int
    {
        Access::authorize('manage');
        $this->limit($limit);
        if (config('nvl-templates.rendering.queue.enabled') !== true) {
            return 0;
        }
        $cutoff = now()->subSeconds(RenderConfiguration::integer('dispatch_timeout', 1, 86400));
        $ids = TemplateRender::query()->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->where(function ($query) use ($cutoff): void {
                $query->where(fn ($query) => $query->where('status', 'processing')->where('lease_expires_at', '<=', now()))
                    ->orWhere(fn ($query) => $query->whereIn('status', ['pending', 'retrying'])->whereNotNull('dispatch_requested_at')
                        ->where('available_at', '<=', now())->where(fn ($query) => $query->whereNull('dispatched_at')->orWhere('dispatched_at', '<=', $cutoff)));
            })->orderBy('created_at')->limit($limit)->pluck('id');
        $count = 0;
        foreach ($ids as $id) {
            if (! is_string($id)) {
                throw new \LogicException('A persisted render requires a string identity.');
            }
            $ready = (new TemplateRender)->getConnection()->transaction(function () use ($id, $cutoff): bool {
                $record = TemplateRender::query()->lockForUpdate()->findOrFail($id);
                if ($record->status === 'processing' && $record->lease_expires_at?->isPast()) {
                    if ($record->attempts >= RenderConfiguration::integer('attempts', 1, 20)) {
                        $record->update(['status' => 'failed', 'error' => 'attempts_exhausted', 'failed_at' => now(),
                            'expires_at' => now()->addSeconds(RenderConfiguration::integer('retention_seconds')), 'processing_token' => null, 'lease_expires_at' => null]);

                        return false;
                    }
                    $record->update(['status' => 'pending', 'generation' => $record->generation + 1, 'processing_token' => null,
                        'lease_expires_at' => null, 'dispatched_at' => null, 'available_at' => now(), 'dispatch_requested_at' => $record->dispatch_requested_at ?? now()]);

                    return true;
                }

                return in_array($record->status, ['pending', 'retrying'], true) && $record->available_at?->isPast()
                    && (! $record->dispatched_at || $record->dispatched_at->lessThanOrEqualTo($cutoff));
            });
            if ($ready) {
                $this->dispatcher->dispatch($id, false);
                $count++;
            }
        }

        return $count;
    }

    public function prune(int $limit = 100): int
    {
        Access::authorize('manage');
        $this->limit($limit);
        $ids = TemplateRender::query()->whereNull('purged_at')->where('expires_at', '<=', now())
            ->where(fn ($query) => $query->where('status', '!=', 'processing')->orWhere('lease_expires_at', '<=', now()))
            ->orderBy('expires_at')->limit($limit)->pluck('id');
        $count = 0;
        foreach ($ids as $id) {
            if (! is_string($id)) {
                throw new \LogicException('A persisted render requires a string identity.');
            }
            (new TemplateRender)->getConnection()->transaction(function () use ($id, &$count): void {
                $record = TemplateRender::query()->lockForUpdate()->findOrFail($id);
                if ($record->purged_at || ! $record->expires_at?->isPast() || ($record->status === 'processing' && $record->lease_expires_at?->isFuture())) {
                    return;
                }
                if ($record->result && ! $this->artifacts->delete($record, $record->result)) {
                    return;
                }
                $record->update(['status' => 'expired', 'generation' => $record->generation + 1, 'snapshot' => null, 'result' => null,
                    'purged_at' => now(), 'processing_token' => null, 'lease_expires_at' => null, 'error' => null]);
                $count++;
            });
        }

        return $count;
    }

    private function limit(int $limit): void
    {
        if ($limit < 1 || $limit > 1000) {
            throw new \InvalidArgumentException('Use a render maintenance batch between 1 and 1000.');
        }
    }
}
