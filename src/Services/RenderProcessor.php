<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\ContextProvider;
use Nvl\Templates\Contracts\RenderExecutionContext;
use Nvl\Templates\Exceptions\RetryableRenderException;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Support\Pdf;
use Nvl\Templates\Support\RenderConfiguration;
use Nvl\Templates\Support\Scope;

/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * @internal
 */
final class RenderProcessor
{
    public function __construct(
        private readonly RenderExecutionContext $execution,
        private readonly RenderPipeline $pipeline,
        private readonly RenderArtifacts $artifacts,
        private readonly ContextProvider $context,
        private readonly TemplateOperation $operation,
    ) {}

    public function run(string $id, string $scope, int $generation, ?string $token = null): TemplateRender
    {
        $token ??= (string) Str::uuid();
        $query = fn () => TemplateRender::withoutGlobalScope('templates_scope')->where('scope_id', $scope)->whereKey($id);
        $record = $query()->firstOrFail();
        if ($record->generation !== $generation || ! in_array($record->status, ['pending', 'retrying'], true) || $record->available_at?->isFuture()) {
            return $record;
        }
        if ($record->expires_at?->isPast()) {
            $query()->where('generation', $generation)->whereIn('status', ['pending', 'retrying'])->update(['status' => 'expired', 'generation' => $generation + 1]);

            return $query()->firstOrFail();
        }
        try {
            $snapshot = $record->snapshot;
            if (! is_array($snapshot) || ! is_string($record->snapshot_checksum) || ! hash_equals($record->snapshot_checksum, CanonicalJson::hash($snapshot))) {
                throw ValidationException::withMessages(['render' => ['Invalid accepted snapshot.']]);
            }

            $prepared = $this->pipeline->validatePrepared(DocumentInputs::map($snapshot['prepared'] ?? null, 'prepared'));
            if ($prepared['scope'] !== $scope || ! in_array($snapshot['output'] ?? null, ['html', 'pdf'], true) || ! is_string($snapshot['outputIdentity'] ?? null)) {
                throw ValidationException::withMessages(['render' => ['Invalid accepted output identity.']]);
            }
            $snapshot['prepared'] = $prepared;
            $snapshot['execution'] = DocumentInputs::map($snapshot['execution'] ?? null, 'execution');
            $snapshot['options'] = DocumentInputs::map($snapshot['options'] ?? null, 'options');
            $snapshot['owner'] = ($snapshot['owner'] ?? null) === null ? null : DocumentInputs::map($snapshot['owner'], 'owner');

            return $this->execution->run($snapshot['execution'], function () use ($id, $scope, $generation, $token, $snapshot, $query): TemplateRender {
                if (Scope::current() !== $scope) {
                    throw new AuthorizationException('The accepted scope was not restored.');
                }
                $claimed = (new TemplateRender)->getConnection()->transaction(function () use ($query, $generation, $token): ?TemplateRender {
                    $current = $query()->lockForUpdate()->firstOrFail();
                    if ($current->generation !== $generation || ! in_array($current->status, ['pending', 'retrying'], true) || $current->available_at?->isFuture()) {
                        return null;
                    }
                    if ($current->attempts >= RenderConfiguration::integer('attempts', 1, 20)) {
                        $current->update(['status' => 'failed', 'error' => 'attempts_exhausted', 'failed_at' => now()]);

                        return null;
                    }
                    $current->fill(['status' => 'processing', 'attempts' => $current->attempts + 1, 'processing_token' => $token,
                        'dispatch_requested_at' => $current->dispatch_requested_at ?? now(),
                        'lease_expires_at' => now()->addSeconds(RenderConfiguration::integer('lease_seconds', 1, 86400)), 'error' => null])->save();

                    return $current;
                });
                if (! $claimed) {
                    return $query()->firstOrFail();
                }
                try {
                    Access::authorize('render', $claimed);
                    if ($snapshot['owner'] !== null) {
                        $release = $this->pipeline->release($claimed->template_revision_id);
                        $this->context->resolve($release, $snapshot['owner'], $this->operation->actor());
                    }
                    $output = $this->pipeline->renderPrepared($snapshot['prepared']);
                    $pdf = null;
                    if ($snapshot['output'] === 'pdf') {
                        $driver = Pdf::driver();
                        if (! hash_equals($snapshot['outputIdentity'], $driver->identity())) {
                            throw ValidationException::withMessages(['pdf' => ['The accepted PDF driver identity changed.']]);
                        }
                        $pdf = $driver->render($output, $snapshot['prepared']['document'], $snapshot['options']);
                    }
                    (new TemplateRender)->getConnection()->transaction(function () use ($query, $generation, $token, $output, $pdf): void {
                        $current = $query()->lockForUpdate()->firstOrFail();
                        if ($current->generation !== $generation || $current->status !== 'processing' || $current->processing_token !== $token || ! $current->lease_expires_at?->isFuture()) {
                            return;
                        }
                        $artifact = $pdf === null
                            ? $this->artifacts->store($current, $output)
                            : $this->artifacts->write($current, $pdf->bytes, 'pdf', 'application/pdf', $pdf->filename);
                        $current->update(['status' => 'completed', 'result' => $artifact, 'completed_at' => now(),
                            'expires_at' => now()->addSeconds(RenderConfiguration::integer('retention_seconds')), 'processing_token' => null, 'lease_expires_at' => null, 'error' => null]);
                    });
                } catch (\Throwable $error) {
                    $this->fail($id, $scope, $generation, $token, $error);
                }

                return $query()->firstOrFail();
            });
        } catch (\Throwable $error) {
            $this->fail($id, $scope, $generation, null, $error);

            return $query()->firstOrFail();
        }
    }

    public function fail(string $id, string $scope, int $generation, ?string $token, \Throwable $error): void
    {
        (new TemplateRender)->getConnection()->transaction(function () use ($id, $scope, $generation, $token, $error): void {
            $record = TemplateRender::withoutGlobalScope('templates_scope')->where('scope_id', $scope)->whereKey($id)->lockForUpdate()->firstOrFail();
            if ($record->generation !== $generation || ($token === null ? ! in_array($record->status, ['pending', 'retrying'], true) : ($record->status !== 'processing' || $record->processing_token !== $token))) {
                return;
            }
            $retry = $error instanceof RetryableRenderException && $record->attempts < RenderConfiguration::integer('attempts', 1, 20);
            $code = match (true) {
                $error instanceof RetryableRenderException => $error->reason,
                $error instanceof AuthorizationException => 'not_authorized',
                $error instanceof ValidationException => 'invalid_render',
                $error instanceof ModelNotFoundException => 'source_unavailable',
                default => 'render_failed',
            };
            $record->update(['status' => $retry ? 'retrying' : 'failed', 'error' => $code,
                'available_at' => $retry ? now()->addSeconds(RenderConfiguration::backoff($record->attempts)) : null,
                'failed_at' => $retry ? null : now(), 'expires_at' => $retry ? $record->expires_at : now()->addSeconds(RenderConfiguration::integer('retention_seconds')),
                'processing_token' => null, 'lease_expires_at' => null]);
        });
    }
}
