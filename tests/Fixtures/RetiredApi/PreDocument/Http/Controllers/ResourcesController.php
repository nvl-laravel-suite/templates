<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Models\TemplateResourceRevision;
use Nvl\Templates\Services\ResourceManager;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\Capabilities;
use Nvl\Templates\Support\JsonWire;

final class ResourcesController
{
    public function __construct(private Templates $templates) {}

    public function index(Request $request, string $template): JsonResponse
    {
        return response()->json(['data' => $this->templates->resourcesFor($template, $request->query('kind'))->map(fn ($r) => $this->resource($r))->values()]);
    }

    public function revision(string $template, string $resource, int $revision): JsonResponse
    {
        $row = app(ResourceManager::class)->revisionFor($template, $resource, $revision);

        return response()->json(['data' => $this->resource(TemplateResource::query()->findOrFail($row->resource_id), $row)]);
    }

    public function content(string $asset): Response
    {
        [$record,$bytes] = $this->templates->assets()->contents($asset);

        return response($bytes, 200, ['Content-Type' => $record->mime_type, 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    private function resource(TemplateResource $row, ?TemplateResourceRevision $revision = null): array
    {
        $revision ??= $row->current_revision_id ? TemplateResourceRevision::query()->findOrFail($row->current_revision_id) : null;

        return ['id' => $row->id, 'key' => $row->key, 'name' => $row->name, 'kind' => $row->kind, 'scope' => $row->scope, 'groupId' => $row->group_id, 'templateId' => $row->template_id, 'status' => $row->status, 'revision' => $revision?->revision ?? 0, 'revisionId' => $revision?->id, 'checksum' => $revision?->checksum, 'restrictions' => (object) ($row->restrictions ?? []), 'provenance' => $revision?->provenance, 'document' => $revision ? JsonWire::resource($revision->document) : null];
    }

    private function asset(TemplateAsset $row): array
    {
        return ['id' => $row->id, 'name' => $row->name, 'mimeType' => $row->mime_type, 'size' => $row->size, 'checksum' => $row->checksum, 'previewUrl' => route('templates.assets.content', ['asset' => $row->id])];
    }

    public function create(Request $request): JsonResponse
    {
        $d = $request->validate(['key' => 'required|string|max:191', 'name' => 'required|string|max:200', 'kind' => 'required|string', 'scope' => 'sometimes|in:tenant,group,template', 'ownerId' => 'nullable|string']);

        return response()->json(['data' => $this->templates->createResource($d['key'], $d['name'], $d['kind'], $d['scope'] ?? 'tenant', $d['ownerId'] ?? null)], 201);
    }

    public function publish(Request $request, string $resource): JsonResponse
    {
        $d = $request->validate(['document' => 'required|array', 'expectedRevision' => 'required|integer|min:0']);

        return response()->json(['data' => $this->templates->publishResource($resource, $d['document'], $d['expectedRevision'])], 201);
    }

    public function assets(): JsonResponse
    {
        Access::authorize('read');

        $data = request()->validate(['target' => 'sometimes|required|string|in:email,document']);
        $query = TemplateAsset::query()->whereNull('archived_at');
        if (isset($data['target'])) {
            $query->whereIn('mime_type', Capabilities::assetTypesByTarget()[$data['target']]);
        }
        $page = $query->orderByDesc('created_at')->orderByDesc('id')->paginate(30)->appends($data);
        $page->setCollection($page->getCollection()->filter(fn ($r) => Access::allows('read', $r))->map(fn ($r) => $this->asset($r)));

        return response()->json($page);
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file']);
        $asset = $this->templates->assets()->upload($request->file('file'));

        return response()->json(['data' => $this->asset($asset)], 201);
    }

    public function import(Request $request): JsonResponse
    {
        $d = $request->validate(['name' => 'required|string|max:200', 'url' => 'nullable|string|max:4096', 'source' => 'required_without:url|string', 'key' => 'required_without:url|string']);
        $asset = isset($d['url']) ? $this->templates->assets()->fromUrl($d['url'], $d['name']) : $this->templates->assets()->fromStorage($d['source'], $d['key'], $d['name']);

        return response()->json(['data' => $this->asset($asset)], 201);
    }
}
