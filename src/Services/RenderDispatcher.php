<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Support\Facades\Bus;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope;
use Nvl\Templates\Exceptions\RenderUnavailable;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\RenderConfiguration;

/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * @internal
 */
final class RenderDispatcher
{
    public function __construct(
        private readonly RenderPipeline $pipeline,
    ) {}

    /** Recovery is separately manage-authorized; workers always recheck the accepted actor. */
    public function dispatch(string $id, bool $authorize = true): TemplateRender
    {
        if (config('nvl-templates.rendering.queue.enabled') !== true) {
            throw ValidationException::withMessages(['queue' => ['Queued template rendering is not enabled.']]);
        }

        return (new TemplateRender)->getConnection()->transaction(function () use ($id, $authorize): TemplateRender {
            $record = TemplateRender::query()->lockForUpdate()->findOrFail($id);
            if ($authorize) {
                Access::authorize('render', $record);
                $this->pipeline->release($record->template_revision_id);
            }
            if (! in_array($record->status, ['pending', 'retrying'], true) || $record->available_at?->isFuture()) {
                return $record;
            }
            if ($record->expires_at?->isPast()) {
                throw new RenderUnavailable('This accepted render has expired.');
            }
            if ($record->dispatched_at?->greaterThan(now()->subSeconds(RenderConfiguration::integer('dispatch_timeout', 1, 86400)))) {
                return $record;
            }
            $record->fill(['generation' => $record->generation + 1, 'dispatch_requested_at' => $record->dispatch_requested_at ?? now(), 'dispatched_at' => now(), 'error' => null])->save();
            $scope = $record->scope_id;
            $generation = $record->generation;
            $execution = DocumentInputs::map($record->snapshot['execution'] ?? null, 'execution');
            $envelope = OwnershipJobEnvelope::fromArray(DocumentInputs::map($execution['ownership'] ?? null, 'ownership'));
            (new TemplateRender)->getConnection()->afterCommit(function () use ($id, $scope, $generation, $envelope): void {
                try {
                    Bus::dispatch(new RenderTemplateJob($id, $scope, $generation, $envelope));
                } catch (\Throwable) {
                    TemplateRender::withoutGlobalScope('templates_scope')->where('scope_id', $scope)->whereKey($id)->where('generation', $generation)
                        ->whereIn('status', ['pending', 'retrying'])->update(['dispatched_at' => null, 'error' => 'dispatch_unavailable']);
                }
            });

            return $record;
        });
    }
}
