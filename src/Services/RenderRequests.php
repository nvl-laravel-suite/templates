<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\RenderExecutionContext;
use Nvl\Templates\Exceptions\RenderConflict;
use Nvl\Templates\Exceptions\RenderUnavailable;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Rendering\RenderedDocument;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Support\Pdf;
use Nvl\Templates\Support\RenderConfiguration;

/**
 * Durable bounded render acceptance and recovery.
 *
 * @api
 */
final class RenderRequests
{
    public function __construct(
        private readonly TemplateOperation $operation,
        private readonly RenderPipeline $pipeline,
        private readonly RenderDispatcher $dispatcher,
        private readonly RenderProcessor $processor,
        private readonly RenderMaintenance $maintenance,
        private readonly RenderArtifacts $artifacts,
        private readonly RenderExecutionContext $execution,
    ) {}

    /** Accept a bounded immutable render snapshot, preserving same-key replay identity.
     * @param  array{facts?: array<array-key,mixed>, context?: array<array-key,mixed>, inputs?: array<array-key,mixed>, settings?: array<array-key,mixed>, output?: 'html'|'pdf', options?: array{filename?: string, expectedPages?: int, maxPages?: int}, idempotency_key?: ?string, owner?: ?array<array-key,mixed>, request_identity?: ?string}  $data
     */
    public function accept(string $revisionId, array $data, Authenticatable|SystemActor $actor): TemplateRender
    {
        return $this->operation->run($actor, function () use ($revisionId, $data) {
            if (array_diff(array_keys($data), ['facts', 'context', 'inputs', 'settings', 'output', 'options', 'idempotency_key', 'owner', 'request_identity'])) {
                throw ValidationException::withMessages(['data' => ['Unknown or protected render request fields.']]);
            }
            DocumentInputs::runtime(array_intersect_key($data, array_flip(['facts', 'context', 'inputs', 'settings'])));
            $facts = $data['facts'] ?? [];
            $context = $data['context'] ?? [];
            $inputs = $data['inputs'] ?? [];
            $settings = $data['settings'] ?? [];
            $output = $data['output'] ?? 'html';
            $options = $data['options'] ?? [];
            $idempotencyKey = $data['idempotency_key'] ?? null;
            $owner = $data['owner'] ?? null;
            $requestIdentity = $data['request_identity'] ?? null;
            if (! is_string($output) || ! is_array($options) || ($idempotencyKey !== null && ! is_string($idempotencyKey)) || ($requestIdentity !== null && ! is_string($requestIdentity)) || ($owner !== null && ! is_array($owner))) {
                throw ValidationException::withMessages(['data' => ['Invalid render request controls.']]);
            }

            if (! in_array($output, ['html', 'pdf'], true) || ($output === 'html' && $options !== [])) {
                throw ValidationException::withMessages(['output' => ['This render output is unavailable.']]);
            }
            $options = $output === 'pdf' ? Pdf::options($options) : [];
            $outputIdentity = $output === 'pdf' ? Pdf::driver()->identity() : 'html-json/1';
            if ($idempotencyKey !== null && ($idempotencyKey === '' || strlen($idempotencyKey) > 191 || preg_match('/[\x00-\x1f\x7f]/', $idempotencyKey))) {
                throw ValidationException::withMessages(['idempotency_key' => ['Use a nonempty bounded render key.']]);
            }
            if ($requestIdentity !== null && ! preg_match('/\A[a-f0-9]{64}\z/', $requestIdentity)) {
                throw ValidationException::withMessages(['requestIdentity' => ['Use a SHA-256 fingerprint for the trusted host request.']]);
            }
            $prepared = $this->pipeline->prepare($revisionId, $facts, $context, $inputs, $settings);
            if ($output === 'pdf' && ($prepared['document']['target'] ?? null) !== 'document') {
                throw ValidationException::withMessages(['output' => ['PDF output requires a document template.']]);
            }
            $snapshot = ['version' => 1, 'prepared' => $prepared, 'execution' => $this->execution->capture(), 'output' => $output,
                'outputIdentity' => $outputIdentity, 'options' => $options, 'owner' => $owner];
            if ($requestIdentity !== null) {
                $snapshot['requestIdentity'] = $requestIdentity;
            }
            $json = json_encode($snapshot, JSON_THROW_ON_ERROR);
            if (strlen($json) > config('nvl-templates.limits.output_bytes')) {
                throw ValidationException::withMessages(['render' => ['Accepted render data exceeds the byte limit.']]);
            }
            $snapshotChecksum = CanonicalJson::hash($snapshot);
            $identity = $snapshot;
            foreach ($identity['prepared']['assets'] as &$evidence) {
                unset($evidence['name']);
            }
            unset($evidence);
            $fingerprint = CanonicalJson::hash($identity);
            $existing = function () use ($idempotencyKey, $fingerprint): ?TemplateRender {
                $record = $idempotencyKey === null ? null : TemplateRender::query()->where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();
                if ($record !== null) {
                    Access::authorize('read', $record);
                    if (! hash_equals($record->fingerprint, $fingerprint)) {
                        throw new RenderConflict;
                    }
                }

                return $record;
            };
            try {
                return (new TemplateRender)->getConnection()->transaction(function () use ($existing, $revisionId, $idempotencyKey, $fingerprint, $snapshotChecksum, $snapshot, $output): TemplateRender {
                    return $existing() ?? TemplateRender::query()->create([
                        'template_revision_id' => $revisionId, 'idempotency_key' => $idempotencyKey, 'fingerprint' => $fingerprint,
                        'status' => 'pending', 'snapshot' => $snapshot, 'snapshot_checksum' => $snapshotChecksum, 'output' => $output, 'attempts' => 0, 'generation' => 0, 'available_at' => now(),
                        'expires_at' => now()->addSeconds(RenderConfiguration::integer('retention_seconds')),
                    ]);
                });
            } catch (UniqueConstraintViolationException $error) {
                return $existing() ?? throw $error;
            }
        });
    }

    /** Read one currently authorized durable request.
     */
    public function get(string $id, Authenticatable|SystemActor $actor): TemplateRender
    {
        return $this->operation->run($actor, function () use ($id) {
            $record = TemplateRender::query()->findOrFail($id);
            Access::authorize('read', $record);

            return $record;
        });
    }

    /** Read one request under its scope-local idempotency key.
     */
    public function byKey(string $key, Authenticatable|SystemActor $actor): TemplateRender
    {
        return $this->operation->run($actor, function () use ($key) {
            $record = TemplateRender::query()->where('idempotency_key', $key)->firstOrFail();
            Access::authorize('read', $record);

            return $record;
        });
    }

    /** Process a request under its captured actor and ownership envelope; returns durable failure state.
     */
    public function process(string $id, ?int $generation, ?string $token, Authenticatable|SystemActor $actor): TemplateRender
    {
        return $this->operation->run($actor, function () use ($id, $generation, $token) {
            $record = $this->get($id, $this->operation->actor());

            return $this->processor->run($id, $record->scope_id, $generation ?? $record->generation, $token);
        });
    }

    /** Schedule one pending generation after the outer commit.
     */
    public function dispatch(string $id, Authenticatable|SystemActor $actor): TemplateRender
    {
        return $this->operation->run($actor, function () use ($id) {
            return $this->dispatcher->dispatch($id);
        });
    }

    /** Atomically accept and schedule after the outer transaction commits.
     * @param  array{facts?: array<array-key,mixed>, context?: array<array-key,mixed>, inputs?: array<array-key,mixed>, settings?: array<array-key,mixed>, output?: 'html'|'pdf', options?: array{filename?: string, expectedPages?: int, maxPages?: int}, idempotency_key?: ?string, owner?: ?array<array-key,mixed>, request_identity?: ?string}  $data
     */
    public function queue(string $revisionId, array $data, Authenticatable|SystemActor $actor): TemplateRender
    {
        return $this->operation->run($actor, function () use ($revisionId, $data) {
            return (new TemplateRender)->getConnection()->transaction(function () use ($revisionId, $data): TemplateRender {
                $record = $this->accept($revisionId, $data, $this->operation->actor());

                return $this->dispatch($record->id, $this->operation->actor());
            });
        });
    }

    /** Recover a bounded batch of expired processing leases or interrupted dispatches.
     */
    public function recover(int $limit, Authenticatable|SystemActor $actor): int
    {
        return $this->operation->run($actor, function () use ($limit) {
            return $this->maintenance->recover($limit);
        });
    }

    /** Expire retained records and delegate private artifact deletion to Media.
     */
    public function prune(int $limit, Authenticatable|SystemActor $actor): int
    {
        return $this->operation->run($actor, function () use ($limit) {
            return $this->maintenance->prune($limit);
        });
    }

    /** Read a complete retained HTML/email bundle after current authorization and asset checks.
     * @return array{html: string, css: string, subject: ?string, text: ?string, revisionId: string, checksum: string, inlineAssets: list<array{cid: string, name: string, mimeType: string, content: string}>}
     */
    public function result(string $id, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($id) {
            $record = $this->readable($id);
            if ($record->output !== 'html') {
                throw ValidationException::withMessages(['output' => ['This request has a binary output.']]);
            }
            $result = json_decode($this->artifacts->read($record), true, 64, JSON_THROW_ON_ERROR);

            return RenderedDocument::fromArray($result)->toArray();
        });
    }

    /** Read checked retained binary/JSON output bytes.
     */
    public function bytes(string $id, Authenticatable|SystemActor $actor): string
    {
        return $this->operation->run($actor, function () use ($id) {
            return $this->artifacts->read($this->readable($id));
        });
    }

    private function readable(string $id): TemplateRender
    {
        $record = $this->get($id, $this->operation->actor());
        $this->pipeline->release($record->template_revision_id, 'read');
        if ($record->status === 'expired' || $record->purged_at || $record->expires_at?->isPast()) {
            throw new RenderUnavailable('This retained render has expired.');
        }
        if ($record->status !== 'completed') {
            throw new RenderUnavailable('This render has not completed.');
        }
        $snapshot = $record->snapshot;
        $prepared = $this->pipeline->validatePrepared(DocumentInputs::map($snapshot['prepared'] ?? null, 'prepared'));
        $this->pipeline->validateAssets($prepared['assets']);

        return $record;
    }
}
