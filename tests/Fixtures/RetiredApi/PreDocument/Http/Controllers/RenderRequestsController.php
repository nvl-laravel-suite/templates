<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Http\Controllers;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\ContextProvider;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Services\RenderPipeline;
use Nvl\Templates\Services\RenderRequests;

final class RenderRequestsController
{
    public function __construct(private RenderRequests $renders) {}

    public function create(Request $request, string $revision): JsonResponse
    {
        $data = $request->validate(['owner' => 'sometimes|array', 'inputs' => 'sometimes|array', 'settings' => 'sometimes|array',
            'facts' => 'prohibited', 'context' => 'prohibited', 'document' => 'prohibited', 'output' => 'sometimes|in:html,pdf',
            'options' => 'sometimes|array', 'execution' => 'sometimes|in:sync,queued,accept', 'idempotencyKey' => 'sometimes|string|max:191']);
        $execution = $data['execution'] ?? 'sync';
        if ($execution === 'queued' && config('nvl-templates.rendering.queue.enabled') !== true) {
            throw ValidationException::withMessages(['execution' => ['Queued template rendering is not enabled.']]);
        }
        $header = $request->header('Idempotency-Key');
        if ($header !== null && isset($data['idempotencyKey']) && $data['idempotencyKey'] !== $header) {
            throw ValidationException::withMessages(['idempotencyKey' => ['The header and body render keys must match.']]);
        }
        $release = app(RenderPipeline::class)->release($revision);
        $trusted = app(ContextProvider::class)->resolve($release, $data['owner'] ?? [], $request->user() ?? throw new AuthorizationException);
        $arguments = [$revision, $trusted['facts'] ?? [], $trusted['context'] ?? [], $data['inputs'] ?? [], $data['settings'] ?? [],
            $data['output'] ?? 'html', $data['options'] ?? [], $data['idempotencyKey'] ?? $header, $data['owner'] ?? []];
        $record = $execution === 'queued' ? $this->renders->queue(...$arguments) : $this->renders->accept(...$arguments);
        if ($execution === 'sync') {
            $record = $this->renders->process($record->id);
        }
        $record = $this->renders->get($record->id);

        return response()->json(['data' => $this->metadata($record)], in_array($record->status, ['pending', 'processing', 'retrying'], true) ? 202 : 201);
    }

    public function show(string $render): JsonResponse
    {
        return response()->json(['data' => $this->metadata($this->renders->get($render))]);
    }

    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate(['idempotencyKey' => 'required|string|max:191']);

        return response()->json(['data' => $this->metadata($this->renders->byKey($data['idempotencyKey']))]);
    }

    public function dispatch(string $render): JsonResponse
    {
        return response()->json(['data' => $this->metadata($this->renders->dispatch($render))], 202);
    }

    public function result(string $render): JsonResponse|Response
    {
        $record = $this->renders->get($render);
        if ($record->output === 'pdf') {
            $bytes = $this->renders->bytes($render);

            return response($bytes, 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="'.$record->result['filename'].'"',
                'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
        }

        return response()->json(['data' => $this->renders->result($render)->toArray()])->header('Cache-Control', 'private, no-store');
    }

    private function metadata(TemplateRender $record): array
    {
        return ['id' => $record->id, 'revisionId' => $record->template_revision_id, 'status' => $record->status, 'output' => $record->output,
            'attempts' => $record->attempts, 'error' => $record->error, 'completedAt' => $record->completed_at?->toISOString(),
            'expiresAt' => $record->expires_at?->toISOString(), 'result' => $record->status === 'completed' ? array_intersect_key($record->result ?? [], array_flip(['size', 'checksum', 'mimeType', 'filename'])) : null];
    }
}
