<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Exceptions\DraftConflict;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Models\TemplateResourceRevision;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\CanonicalJson;

/**
 * Complete explicit-actor domain operations.
 *
 * @api
 */
final class ResourceManager
{
    public function __construct(private readonly TemplateOperation $operation) {}

    /** Create an active reusable resource within tenant, family, or template catalog scope.
     */
    public function create(string $key, string $name, string $kind, string $scope, ?string $ownerId, Authenticatable|SystemActor $actor): TemplateResource
    {
        return $this->operation->run($actor, function () use ($key, $name, $kind, $scope, $ownerId) {
            DocumentInputs::identity(['key' => $key, 'name' => $name]);
            Access::authorize('manage');
            if (! in_array($kind, ['layout', 'partial', 'content', 'theme', 'settings', 'editor'], true) || ! in_array($scope, ['tenant', 'group', 'template'], true) || ($scope === 'tenant') !== ($ownerId === null)) {
                $this->fail('Invalid resource kind or owner scope.');
            }
            if ($scope === 'group') {
                Access::authorize('manage', TemplateGroup::query()->findOrFail($ownerId));
            }
            if ($scope === 'template') {
                Access::authorize('manage', TemplateModelRegistry::query()->findOrFail($ownerId));
            }

            return TemplateResource::query()->create([
                'key' => $key, 'name' => $name, 'kind' => $kind, 'scope' => $scope, 'owner_key' => $scope.($ownerId ? ':'.$ownerId : ''),
                'group_id' => $scope === 'group' ? $ownerId : null, 'template_id' => $scope === 'template' ? $ownerId : null,
            ]);
        });
    }

    /** Publish an immutable resource body at the expected current revision.
     * @param  array<array-key,mixed>  $document  Reusable content body or nested portable dependency definitions.
     */
    public function publish(string $id, array $document, int $expectedRevision, Authenticatable|SystemActor $actor): TemplateResourceRevision
    {
        return $this->operation->run($actor, function () use ($id, $document, $expectedRevision) {
            return (new TemplateResource)->getConnection()->transaction(function () use ($id, $document, $expectedRevision): TemplateResourceRevision {
                $resource = TemplateResource::query()->lockForUpdate()->findOrFail($id);
                Access::authorize('manage', $resource);
                if ($resource->version !== $expectedRevision) {
                    throw new DraftConflict;
                }
                if (strlen(json_encode($document, JSON_THROW_ON_ERROR)) > config('nvl-templates.limits.document_bytes')) {
                    $this->fail('Resource exceeds the byte limit.');
                }
                $revision = TemplateResourceRevision::query()->create(['resource_id' => $id, 'revision' => $expectedRevision + 1, 'document' => $document, 'checksum' => CanonicalJson::hash($document)]);
                $resource->update(['version' => $revision->revision, 'current_revision_id' => $revision->id]);

                return $revision;
            });
        });
    }

    /** List only currently readable resources visible to the authoring family.
     * @return Collection<int, TemplateResource>
     */
    public function catalog(string $templateId, ?string $kind, Authenticatable|SystemActor $actor): Collection
    {
        return $this->operation->run($actor, function () use ($templateId, $kind) {
            $template = TemplateModelRegistry::query()->findOrFail($templateId);
            Access::authorize('read', $template);
            $template = app(DocumentResolver::class)->authoringTemplate($template);

            return TemplateResource::query()->where('status', 'active')->when($kind, fn ($q) => $q->where('kind', $kind))
                ->where(function ($q) use ($template): void {
                    $q->where('scope', 'tenant')->orWhere(fn ($q) => $q->where('scope', 'template')->where('template_id', $template->id));
                    if ($template->group_id) {
                        $q->orWhere(fn ($q) => $q->where('scope', 'group')->where('group_id', $template->group_id));
                    }
                })->orderBy('name')->orderBy('id')->get()->filter(fn ($resource) => Access::allows('read', $resource))->values();
        });
    }

    /** Read the exact immutable resource revision after template catalog visibility checks.
     */
    public function revisionFor(string $templateId, string $resourceId, int $revision, Authenticatable|SystemActor $actor): TemplateResourceRevision
    {
        return $this->operation->run($actor, function () use ($templateId, $resourceId, $revision) {
            $template = TemplateModelRegistry::query()->findOrFail($templateId);
            Access::authorize('read', $template);
            $template = app(DocumentResolver::class)->authoringTemplate($template);
            $resource = TemplateResource::query()->findOrFail($resourceId);
            Access::authorize('read', $resource);
            $this->assertVisible($resource, $template);

            return TemplateResourceRevision::query()->where('resource_id', $resourceId)->where('revision', $revision)->firstOrFail();
        });
    }

    /**
     * Resolve an authorized dependency closure inside an admitted operation.
     *
     * @param  array<array-key,mixed>  $document
     * @return array<array-key,mixed>
     *
     * @internal
     */
    public function snapshot(Template|TemplateGroup $template, array $document): array
    {
        $pins = [];
        $active = [];
        $resolved = $this->visitDocument($document, 0, null, $template, $pins, $active);
        foreach ($this->dependencies($document) as $ref) {
            $this->resolveReference($ref, null, 0, $template, $pins, $active);
        }
        $resolved = DocumentInputs::map($resolved, 'document');
        $resolved['dependencies'] = array_values($pins);

        return $resolved;
    }

    /** @param array<string,array{resourceId: string,revisionId: string,revision: int,checksum: string}> $pins
     * @param  array<string,bool>  $active
     * @return array{mixed, TemplateResource}
     */
    private function resolveReference(mixed $ref, ?TemplateResource $parent, int $depth, Template|TemplateGroup $template, array &$pins, array &$active): array
    {
        if ($depth > config('nvl-templates.limits.depth')) {
            $this->fail('Resource dependency depth exceeded.');
        }
        $id = is_array($ref) ? ($ref['resourceId'] ?? $ref['id'] ?? null) : null;
        if (! is_string($id) || $id === '' || ! is_int($ref['revision'] ?? null) || $ref['revision'] < 1) {
            $this->fail('A resource reference needs an identity and a positive integer revision.');
        }
        $resource = TemplateResource::query()->findOrFail($id);
        Access::authorize('read', $resource);
        $this->assertVisible($resource, $template, $parent);
        $revision = TemplateResourceRevision::query()->where('resource_id', $resource->id)->where('revision', $ref['revision'])->firstOrFail();
        if (isset($active[$revision->id])) {
            $this->fail('Circular resource dependency.');
        }
        $active[$revision->id] = true;
        $body = $this->visitDocument($revision->document, $depth + 1, $resource, $template, $pins, $active);
        foreach ($this->dependencies($revision->document) as $dependency) {
            $this->resolveReference($dependency, $resource, $depth + 1, $template, $pins, $active);
        }
        unset($active[$revision->id]);
        $pins[$revision->id] = ['resourceId' => $resource->id, 'revisionId' => $revision->id, 'revision' => $revision->revision, 'checksum' => $revision->checksum];

        return [$body, $resource];
    }

    /** @param array<string,array{resourceId: string,revisionId: string,revision: int,checksum: string}> $pins
     * @param  array<string,bool>  $active
     */
    private function visitDocument(mixed $value, int $depth, ?TemplateResource $parent, Template|TemplateGroup $template, array &$pins, array &$active): mixed
    {
        if ($depth > config('nvl-templates.limits.depth')) {
            $this->fail('Resource dependency depth exceeded.');
        }
        if (! is_array($value)) {
            return $value;
        }
        if (($value['kind'] ?? null) === 'content') {
            $path = $value['path'] ?? '';
            if (! is_string($path)) {
                $this->fail('A content path must be a string.');
            }
            [$body, $resource] = $this->resolveReference($value, $parent, $depth + 1, $template, $pins, $active);
            if ($resource->kind !== 'content') {
                $this->fail('A content binding must reference content.');
            }
            if ($path !== '' && (! is_array($body) || ! Arr::has($body, $path))) {
                $this->fail('Content path does not exist.');
            }

            return $path === '' ? $body : Arr::get($body, $path);
        }
        $out = [];
        foreach ($value as $key => $child) {
            $out[$key] = $this->visitDocument($child, $depth + 1, $parent, $template, $pins, $active);
        }

        return $out;
    }

    /** @param array<array-key,mixed> $document
     * @return list<mixed>
     */
    private function dependencies(array $document): array
    {
        $dependencies = $document['dependencies'] ?? [];
        if (! is_array($dependencies) || ! array_is_list($dependencies)) {
            $this->fail('Resource dependencies must be an ordered list.');
        }

        return $dependencies;
    }

    private function assertVisible(TemplateResource $resource, Template|TemplateGroup $template, ?TemplateResource $parent = null): void
    {
        $groupId = $template instanceof TemplateGroup ? $template->id : $template->group_id;
        $visible = $resource->scope === 'tenant' || ($resource->scope === 'group' && $resource->group_id === $groupId) || ($template instanceof Template && $resource->scope === 'template' && $resource->template_id === $template->id);
        if ($resource->status !== 'active' || ! $visible || ($parent?->scope === 'tenant' && $resource->scope !== 'tenant') || ($parent?->scope === 'group' && $resource->scope === 'template')) {
            $this->fail('Resource is outside the permitted template scope.');
        }
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['resources' => [$message]]);
    }
}
