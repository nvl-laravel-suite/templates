<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Models\TemplateGroupRevision;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Support\Capabilities;
use Nvl\Templates\Support\JsonWire;
use Nvl\Templates\Support\PreviewPayload;

/**
 * Authorized editor and catalog reads.
 *
 * @api
 */
final class TemplateReader
{
    public function __construct(
        private readonly TemplateOperation $operation,
        private readonly DocumentResolver $documents,
        private readonly ResourceManager $resources,
        private readonly FamilyLifecycle $families,
        private readonly AssetManager $assets,
    ) {}

    /** Read an editor projection with raw source authority, effective document and review candidates.
     * @return array{template: array{id: string,key: string,name: string,groupId: ?string,status: string}, version: int, source: array<array-key,mixed>|null, document: array<array-key,mixed>|null, sourceChecksum: ?string, family: array{id: string,revisionId: string,revision: int,source: array<array-key,mixed>,document: array<array-key,mixed>}|null, proposedGroupId: ?string, hasProposedBasis: bool, familyChanges: list<array<array-key,mixed>>, currentRevisionId: ?string, capabilities: array<array-key,mixed>, previewAssets: object, issues: list<array{path: string,message: string}>}
     */
    public function load(string $id, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($id) {
            $api = $this->documents;
            $template = TemplateModelRegistry::query()->findOrFail($id);
            Access::authorize('read', $template);
            Access::authorize('manage', $template);
            $draft = TemplateDraft::query()->where('template_id', $id)->first();
            $release = $template->current_revision_id ? TemplateRevision::query()->findOrFail($template->current_revision_id) : null;
            $source = $draft->document ?? $release?->source;
            if ($source === null && $template->group_id) {
                $group = TemplateGroup::query()->findOrFail($template->group_id);
                if ($group->current_revision_id) {
                    $family = TemplateGroupRevision::query()->findOrFail($group->current_revision_id);
                    $source = ['format' => 'template-document', 'schemaVersion' => 1, 'target' => $family->document['target'], 'source' => ['mode' => 'group-variant', 'group' => ['id' => $group->id, 'revision' => $family->revision], 'overrides' => []]];
                }
            }
            $sourceDefinition = $source === null ? [] : DocumentInputs::map($source['source'] ?? null, 'source');
            $document = null;
            $family = null;
            $issues = [];
            if ($source !== null) {
                try {
                    [$document,$family] = $api->prepareSource($template, $source, resolveResources: false);
                    $document = $this->resources->snapshot($api->authoringTemplate($template), $document);
                } catch (ValidationException $e) {
                    foreach ($e->errors() as $path => $messages) {
                        if (! is_string($path) || ! is_array($messages)) {
                            throw $e;
                        }
                        foreach ($messages as $message) {
                            if (! is_string($message)) {
                                throw $e;
                            }
                            $issues[] = ['path' => $path, 'message' => $message];
                        }
                    }
                } catch (ModelNotFoundException) {
                    $issues[] = ['path' => 'resources', 'message' => 'A referenced family or reusable resource is unavailable. Repair or replace its reference.'];
                }
                if ($document === null && ($sourceDefinition['mode'] ?? null) === 'standalone') {
                    $document = $source;
                }
            }
            $previewAssets = [];
            $raw = $source === null ? null : JsonWire::document($source, $family?->source);
            if ($source !== null && $raw !== null && ($sourceDefinition['mode'] ?? null) === 'group-variant') {
                $rawSource = DocumentInputs::map($raw['source'] ?? null, 'source');
                $wireOverrides = $rawSource['overrides'] ?? [];
                $overrides = DocumentInputs::map(is_object($wireOverrides) ? get_object_vars($wireOverrides) : $wireOverrides, 'source.overrides');
                $sourceOverrides = DocumentInputs::map($sourceDefinition['overrides'] ?? [], 'source.overrides');
                $schema = DocumentInputs::map($document['dataSchema'] ?? [], 'dataSchema');
                $properties = DocumentInputs::map($schema['properties'] ?? [], 'dataSchema.properties');
                foreach (['content' => 'content', 'settingsDefaults' => 'settings'] as $key => $namespace) {
                    if (isset($overrides[$key])) {
                        $overrides[$key] = JsonWire::value($sourceOverrides[$key] ?? null, DocumentInputs::map($properties[$namespace] ?? ['type' => 'object'], 'dataSchema.properties.'.$namespace));
                    }
                }
                $rawSource['overrides'] = (object) $overrides;
                $raw['source'] = $rawSource;
            }
            $proposedGroupId = $draft->proposed_basis['groupId'] ?? null;
            if ($proposedGroupId !== null && ! is_string($proposedGroupId)) {
                throw ValidationException::withMessages(['source' => ['The proposed family identity is invalid.']]);
            }

            $payload = ['template' => ['id' => $template->id, 'key' => $template->key, 'name' => $template->name, 'groupId' => $template->group_id, 'status' => $template->status],
                'version' => $draft->version ?? 0, 'source' => $raw, 'document' => $document === null ? null : JsonWire::document($document),
                'sourceChecksum' => $source === null ? null : CanonicalJson::hash($source),
                'family' => $family ? ['id' => $family->group_id, 'revisionId' => $family->id, 'revision' => $family->revision, 'source' => JsonWire::document($family->source), 'document' => JsonWire::document($this->familyPreview($family))] : null,
                'proposedGroupId' => $proposedGroupId, 'hasProposedBasis' => $draft?->proposed_basis !== null, 'familyChanges' => $this->families->listing($id, $this->operation->actor()), 'currentRevisionId' => $release?->id, 'capabilities' => DocumentInputs::map(Capabilities::document(), 'capabilities'), 'previewAssets' => (object) $previewAssets, 'issues' => $issues];
            PreviewPayload::check($payload);
            foreach (DocumentInputs::map($document['managedAssets'] ?? [], 'managedAssets') as $key => $assetId) {
                if (! is_string($assetId)) {
                    throw ValidationException::withMessages(['managedAssets' => ['A managed asset identity must be a string.']]);
                }
                $previewAssets[$key] = $this->assets->resolve($assetId)['url'];
                $payload['previewAssets'] = (object) $previewAssets;
                PreviewPayload::check($payload);
            }

            return $payload;
        });
    }

    /** Read one authorized configured template root. */
    public function get(string $id, Authenticatable|SystemActor $actor): Template
    {
        return $this->operation->run($actor, function () use ($id): Template {
            $template = TemplateModelRegistry::query()->findOrFail($id);
            Access::authorize('read', $template);

            return $template;
        });
    }

    /** @return array<array-key,mixed> */
    private function familyPreview(TemplateGroupRevision $family): array
    {
        try {
            $dependencies = $family->document['dependencies'] ?? [];
            if (! is_array($dependencies)) {
                throw ValidationException::withMessages(['dependencies' => ['A dependency list is required.']]);
            }
            foreach ($dependencies as $pin) {
                if (! is_array($pin) || ! is_string($pin['resourceId'] ?? null)) {
                    throw ValidationException::withMessages(['dependencies' => ['A pinned resource identity is required.']]);
                }
                Access::authorize('read', TemplateResource::query()->findOrFail($pin['resourceId']));
            }

            return $family->document;
        } catch (AuthorizationException|ModelNotFoundException) {
            // Local overrides can remove a dependency without granting access to its old snapshot.
            return $family->source;
        }
    }
}
