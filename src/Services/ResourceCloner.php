<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Models\TemplateResourceRevision;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\CanonicalJson;

/** Plans without writes; apply runs inside the caller's draft transaction. */
/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * @internal
 */
final class ResourceCloner
{
    public function __construct(
        private readonly ResourceManager $resources,
        private readonly TemplateOperation $operation,
    ) {}

    /** @param array<array-key,mixed> $source
     * @return array<string,array{resource: TemplateResource, revision: TemplateResourceRevision}>
     */
    public function closure(Template $template, array $source): array
    {
        $this->resources->snapshot($template, $source);
        $found = [];
        $active = [];
        $walk = function (mixed $value, int $depth = 0, bool $dependency = false, bool $documentRoot = false) use (&$walk, &$found, &$active): void {
            if ($depth > config('nvl-templates.limits.depth')) {
                $this->fail('Resource dependency depth exceeded.');
            }
            if (! is_array($value)) {
                return;
            }
            $isReference = $dependency || ($value['kind'] ?? null) === 'content';
            $id = $isReference ? ($value['resourceId'] ?? $value['id'] ?? null) : null;
            if (is_string($id) && isset($value['revision'])) {
                $resource = TemplateResource::query()->findOrFail($id);
                Access::authorize('read', $resource);
                $revision = TemplateResourceRevision::query()->where('resource_id', $id)->where('revision', $value['revision'])->firstOrFail();
                if (isset($active[$revision->id])) {
                    $this->fail('Circular resource dependency.');
                }
                if (isset($found[$revision->id])) {
                    return;
                }
                if ($resource->status !== 'active') {
                    $this->fail('Only active resources may be copied.');
                }
                if (($resource->restrictions['exportable'] ?? true) !== true) {
                    $this->fail('A resource is not exportable.');
                }
                if ($resource->scope === 'group') {
                    Access::authorize('copy', $resource);
                }
                $active[$revision->id] = true;
                $walk($revision->document, $depth + 1, false, true);
                unset($active[$revision->id]);
                $found[$revision->id] = ['resource' => $resource, 'revision' => $revision];

                return;
            }
            foreach ($value as $key => $child) {
                if ($documentRoot && $key === 'dependencies' && is_array($child)) {
                    foreach ($child as $reference) {
                        $walk($reference, $depth + 1, true);
                    }
                } else {
                    $walk($child, $depth + 1);
                }
            }
        };
        $walk($source, 0, false, true);

        return $found;
    }

    /** @param array<array-key,mixed> $source
     * @return list<array{resourceId: string, revisionId: string, revision: int, checksum: string, scope: string, restrictions: array<array-key,mixed>|null}>
     */
    public function evidence(Template $template, array $source): array
    {
        $out = [];
        foreach ($this->closure($template, $source) as $item) {
            $r = $item['resource'];
            $v = $item['revision'];
            $out[] = ['resourceId' => $r->id, 'revisionId' => $v->id, 'revision' => $v->revision, 'checksum' => $v->checksum, 'scope' => $r->scope, 'restrictions' => $r->restrictions];
        }

        return $out;
    }

    /** @param array<array-key,mixed> $source
     * @return array{array<array-key,mixed>, array<string,array{resourceId: string, revisionId: string, revision: int, checksum: string}>}
     */
    public function copy(Template $template, array $source): array
    {
        Access::authorize('manage', TemplateModelRegistry::query()->findOrFail($template->id));
        $closure = $this->closure($template, $source);
        $map = [];
        foreach ($closure as $item) {
            $resource = $item['resource'];
            $revision = $item['revision'];
            if ($resource->scope !== 'group') {
                continue;
            }
            $body = $this->rewrite($revision->document, $map);
            if (! is_array($body)) {
                $this->fail('A reusable resource body must remain an array.');
            }
            $bodyHash = CanonicalJson::hash($body);
            $origin = ['resourceId' => $resource->id, 'revisionId' => $revision->id, 'revision' => $revision->revision, 'checksum' => $revision->checksum, 'bodyChecksum' => $bodyHash, 'groupId' => $resource->group_id, 'restrictions' => $resource->restrictions ?? []];
            $reuse = null;
            foreach (TemplateResource::query()->where('scope', 'template')->where('template_id', $template->id)->where('kind', $resource->kind)->where('status', 'active')->get() as $existing) {
                if (CanonicalJson::hash($existing->restrictions ?? []) !== CanonicalJson::hash($resource->restrictions ?? []) || ! Access::allows('read', $existing)) {
                    continue;
                }
                foreach (TemplateResourceRevision::query()->where('resource_id', $existing->id)->get() as $v) {
                    if ($v->provenance === $origin && $v->checksum === $bodyHash && CanonicalJson::hash($v->document) === $bodyHash) {
                        $reuse = [$existing, $v];
                        break 2;
                    }
                }
            }
            if ($reuse) {
                [$copy,$copyRevision] = $reuse;
            } else {
                $copy = $this->resources->create('copy-'.str_replace('-', '', $revision->id).'-'.bin2hex(random_bytes(4)), $resource->name, $resource->kind, 'template', $template->id, $this->operation->actor());
                $copy->update(['restrictions' => $resource->restrictions]);
                $copyRevision = TemplateResourceRevision::query()->create(['resource_id' => $copy->id, 'revision' => 1, 'document' => $body, 'checksum' => $bodyHash, 'provenance' => $origin, 'origin_revision_id' => $revision->id]);
                $copy->update(['version' => 1, 'current_revision_id' => $copyRevision->id]);
            }
            $map[$resource->id.'@'.$revision->revision] = ['resourceId' => $copy->id, 'revisionId' => $copyRevision->id, 'revision' => $copyRevision->revision, 'checksum' => $copyRevision->checksum];
        }

        return [DocumentInputs::map($this->rewrite($source, $map), 'source'), $map];
    }

    /** @param array<string,array{resourceId: string, revisionId: string, revision: int, checksum: string}> $map */
    private function rewrite(mixed $value, array $map, bool $dependency = false, bool $documentRoot = true): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        $isReference = $dependency || ($value['kind'] ?? null) === 'content';
        $id = $isReference ? ($value['resourceId'] ?? $value['id'] ?? null) : null;
        $revision = $value['revision'] ?? 0;
        if ($id !== null && (! is_string($id) || ! is_int($revision))) {
            $this->fail('A copied dependency requires a string identity and integer revision.');
        }
        $pin = $id !== null ? ($map[$id.'@'.$revision] ?? null) : null;
        if ($pin) {
            $field = isset($value['resourceId']) ? 'resourceId' : 'id';
            $value[$field] = $pin['resourceId'];
            $value['revision'] = $pin['revision'];
            foreach (['revisionId', 'checksum'] as $field) {
                if (isset($value[$field])) {
                    $value[$field] = $pin[$field];
                }
            }
        }
        foreach ($value as $key => $child) {
            if ($documentRoot && $key === 'dependencies' && is_array($child)) {
                $value[$key] = array_map(fn ($reference) => $this->rewrite($reference, $map, true, false), $child);
            } else {
                $value[$key] = $this->rewrite($child, $map, false, false);
            }
        }

        return $value;
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['resources' => [$message]]);
    }
}
