<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Http\Controllers;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\ContextProvider;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Models\TemplateGroupRevision;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Rendering\EmailProfile;
use Nvl\Templates\Services\EditorPayload;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\Capabilities;
use Nvl\Templates\Support\JsonWire;

final class TemplatesController
{
    public function __construct(private Templates $templates) {}

    public function index(Request $request): JsonResponse
    {
        Access::authorize('read');

        $page = Template::query()->orderBy('name')->paginate(min(100, max(1, $request->integer('perPage', 25))));
        $page->setCollection($page->getCollection()->filter(fn ($record) => Access::allows('read', $record))->values());

        return response()->json($page);
    }

    public function groups(): JsonResponse
    {
        Access::authorize('read');

        return response()->json(['data' => TemplateGroup::query()->orderBy('name')->get()->filter(fn ($record) => Access::allows('read', $record))->values()]);
    }

    public function create(Request $request): JsonResponse
    {
        $data = $request->validate(['key' => 'required|string|max:191|regex:/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/', 'name' => 'required|string|max:200', 'groupId' => 'nullable|string']);

        return response()->json(['data' => $this->templates->createTemplate($data['key'], $data['name'], $data['groupId'] ?? null)], 201);
    }

    public function createGroup(Request $request): JsonResponse
    {
        $data = $request->validate(['key' => 'required|string|max:191|regex:/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/', 'name' => 'required|string|max:200']);

        return response()->json(['data' => $this->templates->createGroup($data['key'], $data['name'])], 201);
    }

    public function show(string $template): JsonResponse
    {
        $record = $this->templates->getTemplate($template);

        return response()->json(['data' => [...$record->toArray(), 'draft' => $this->wire(TemplateDraft::query()->where('template_id', $record->id)->first()), 'currentRevision' => $record->current_revision_id ? $this->wire(TemplateRevision::query()->findOrFail($record->current_revision_id)) : null]]);
    }

    public function editor(string $template): JsonResponse
    {
        return response()->json(['data' => app(EditorPayload::class)->load($template)]);
    }

    public function groupRevision(string $group, int $revision): JsonResponse
    {
        $record = TemplateGroup::query()->findOrFail($group);
        Access::authorize('read', $record);
        $release = TemplateGroupRevision::query()->where('group_id', $group)->where('revision', $revision)->firstOrFail();

        return response()->json(['data' => $this->wire($release)]);
    }

    public function save(Request $request, string $template): JsonResponse
    {
        $data = $request->validate(['document' => 'required|array', 'expectedVersion' => 'required|integer|min:0']);

        return response()->json(['data' => $this->wire($this->templates->saveDraft($template, $data['document'], $data['expectedVersion']))]);
    }

    public function publish(Request $request, string $template): JsonResponse
    {
        $data = $request->validate(['expectedVersion' => 'required|integer|min:0']);

        return response()->json(['data' => $this->wire($this->templates->publish($template, $data['expectedVersion']))], 201);
    }

    public function publishGroup(Request $request, string $group): JsonResponse
    {
        $data = $request->validate(['document' => 'required|array', 'expectedRevision' => 'required|integer|min:0']);

        return response()->json(['data' => $this->wire($this->templates->publishGroup($group, $data['document'], $data['expectedRevision']))], 201);
    }

    public function render(Request $request, string $revision): JsonResponse
    {
        $data = $request->validate(['owner' => 'sometimes|array', 'inputs' => 'sometimes|array', 'settings' => 'sometimes|array', 'facts' => 'prohibited', 'context' => 'prohibited', 'document' => 'prohibited']);
        $release = TemplateRevision::query()->findOrFail($revision);
        Access::authorize('render', $release);
        $trusted = app(ContextProvider::class)->resolve($release, $data['owner'] ?? [], $request->user() ?? throw new AuthorizationException);

        return response()->json(['data' => $this->templates->render($revision, $trusted['facts'] ?? [], $trusted['context'] ?? [], $data['inputs'] ?? [], $data['settings'] ?? [])->toArray()]);
    }

    public function prepare(Request $request, string $revision): JsonResponse
    {
        $data = $request->validate(['owner' => 'sometimes|array', 'inputs' => 'sometimes|array', 'settings' => 'sometimes|array', 'facts' => 'prohibited', 'context' => 'prohibited', 'document' => 'prohibited']);
        $release = TemplateRevision::query()->findOrFail($revision);
        Access::authorize('render', $release);
        $trusted = app(ContextProvider::class)->resolve($release, $data['owner'] ?? [], $request->user() ?? throw new AuthorizationException);

        return response()->json(['data' => $this->templates->prepare($revision, $trusted['facts'] ?? [], $trusted['context'] ?? [], $data['inputs'] ?? [], $data['settings'] ?? [])]);
    }

    public function preview(Request $request, string $template): JsonResponse
    {
        Access::authorize('manage');
        $data = $request->validate(['document' => 'required|array', 'facts' => 'sometimes|array', 'context' => 'sometimes|array', 'inputs' => 'sometimes|array', 'settings' => 'sometimes|array', 'include_inline_assets' => 'sometimes|boolean']);
        $result = $this->templates->preview($template, $data['document'], $data['facts'] ?? [], $data['context'] ?? [], $data['inputs'] ?? [], $data['settings'] ?? []);
        $output = $result->toArray();
        $output['previewHtml'] = app(EmailProfile::class)->browserPreview($result->html, $result->inlineAssets, config('nvl-templates.limits.preview_bytes', 8388608));
        if (! ($data['include_inline_assets'] ?? true)) {
            $output['inlineAssets'] = [];
        }
        $response = response()->json(['data' => $output]);
        if (strlen($response->getContent()) > config('nvl-templates.limits.preview_bytes', 8388608)) {
            throw ValidationException::withMessages(['preview' => ['Serialized preview exceeds the response byte limit. Omit inline assets from browser responses or reduce the preview media.']]);
        }

        return $response;
    }

    private function wire(?Model $record): ?array
    {
        if ($record === null) {
            return null;
        }
        $data = $record->toArray();
        foreach (['document', 'source'] as $key) {
            if (isset($data[$key]) && is_array($data[$key])) {
                $family = null;
                if (($data[$key]['source']['mode'] ?? null) === 'group-variant') {
                    $family = TemplateGroupRevision::query()->where('group_id', $data[$key]['source']['group']['id'])->where('revision', $data[$key]['source']['group']['revision'])->first()?->source;
                }
                $data[$key] = JsonWire::document($data[$key], $family);
            }
        }
        if ($record instanceof TemplateGroupRevision || $record instanceof TemplateRevision) {
            foreach ($record->document['dependencies'] ?? [] as $pin) {
                Access::authorize('read', TemplateResource::query()->findOrFail($pin['resourceId']));
            }
        }
        if ($record instanceof TemplateGroupRevision) {
            $assets = [];
            foreach ($record->document['managedAssets'] ?? [] as $id => $assetId) {
                $this->templates->assets()->contents($assetId);
                $assets[$id] = route('templates.assets.content', ['asset' => $assetId]);
            }
            $data['previewAssets'] = (object) $assets;
        }

        return $data;
    }

    public function capabilities(): JsonResponse
    {
        Access::authorize('read');

        return response()->json(['data' => Capabilities::document()]);
    }
}
