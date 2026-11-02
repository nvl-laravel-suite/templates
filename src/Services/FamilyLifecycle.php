<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Exceptions\DraftConflict;
use Nvl\Templates\Models\FamilyChange;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Models\TemplateGroupRevision;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Support\JsonWire;
use Nvl\Templates\Support\PreviewPayload;

/**
 * Complete explicit-actor domain operations.
 *
 * @phpstan-type Conflict array{id:string,path:string,message:string,localAllowed:bool,choices:list<string>,comparison?:array<array-key,mixed>}
 * @phpstan-type CandidateResult array{operation:string,targetGroupId:?string,targetRevision:?int,source:array<array-key,mixed>,document:array<array-key,mixed>,conflicts:list<Conflict>,changes:array{fromGroupId:?string,fromRevision:?int,toGroupId:?string,toRevision:?int},evidence:array{base:?string,target:?string,currentDependencies:array<array-key,mixed>,targetDependencies:array<array-key,mixed>}}
 *
 * @api
 */
final class FamilyLifecycle
{
    public function __construct(
        private readonly TemplateOperation $operation,
        private readonly DocumentResolver $documents,
        private readonly ResourceManager $resources,
        private readonly ResourceCloner $cloner,
        private readonly FamilyMaterializer $materializer,
        private readonly AssetManager $assets,
    ) {}

    /**
     * Source snapshot inside an admitted operation.
     *
     * @return array{0:array<array-key,mixed>,1:int}
     *
     * @internal
     */
    public function current(Template $template): array
    {
        $draft = TemplateDraft::query()->where('template_id', $template->id)->first();
        $source = $draft?->document;
        if ($source === null && $template->current_revision_id) {
            $source = TemplateRevision::query()->findOrFail($template->current_revision_id)->source;
        }
        if ($source === null && $template->group_id) {
            $group = TemplateGroup::query()->findOrFail($template->group_id);
            if ($group->current_revision_id) {
                $f = TemplateGroupRevision::query()->findOrFail($group->current_revision_id);
                $source = $this->variant($f, []);
            }
        }
        if ($source === null) {
            $this->fail('source', 'Save a source before preparing a family change.');
        }

        return [$source, $draft->version ?? 0];
    }

    /** Persist a review candidate from exact source/version evidence.
     * @param  array{groupId: string, revision: int}|null  $target  Null for detach.
     * @return array<string,mixed> Candidate review projection with id, status, source, document and conflicts.
     */
    public function prepare(string $templateId, string $operation, ?array $target, int $expectedVersion, string $sourceChecksum, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($templateId, $operation, $target, $expectedVersion, $sourceChecksum) {
            return TemplateModelRegistry::newInstance()->getConnection()->transaction(function () use ($templateId, $operation, $target, $expectedVersion, $sourceChecksum): array {
                $template = TemplateModelRegistry::query()->findOrFail($templateId);
                Access::authorize('manage', $template);
                [$source,$version] = $this->current($template);
                $this->check($source, $version, $expectedVersion, $sourceChecksum);
                $result = $this->build($template, $source, $operation, $target, []);
                $candidate = FamilyChange::query()->create(['template_id' => $templateId, 'operation' => $operation, 'status' => 'pending', 'expected_version' => $version, 'source_checksum' => $sourceChecksum, 'inputs' => ['source' => $source, 'target' => $target, 'evidence' => $result['evidence']], 'result' => $result]);

                return $this->dto($candidate);
            });
        });
    }

    /** Read the currently authorized candidate projections.
     * @return list<array<string,mixed>>
     */
    public function listing(string $templateId, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($templateId) {
            $template = TemplateModelRegistry::query()->findOrFail($templateId);
            Access::authorize('manage', $template);

            $visible = [];
            foreach (FamilyChange::query()->where('template_id', $templateId)->latest()->cursor() as $candidate) {
                try {
                    $visible[] = $this->dto($candidate);
                    PreviewPayload::check($visible);
                } catch (AuthorizationException|ModelNotFoundException) { /* Current read grants limit stored review snapshots too. */
                }
            }

            return $visible;
        });
    }

    /** Read one candidate after rechecking all source grants.
     * @return array<string,mixed> Candidate review projection.
     */
    public function get(string $templateId, string $candidateId, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($templateId, $candidateId) {
            return $this->dto($this->find($templateId, $candidateId));
        });
    }

    /** Compute conflict resolutions without changing persisted authoring state.
     * @param  array<string, 'local'|'family'>  $resolutions
     * @return array<string,mixed> Candidate review projection.
     */
    public function review(string $templateId, string $candidateId, array $resolutions, int $expectedVersion, string $sourceChecksum, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($templateId, $candidateId, $resolutions, $expectedVersion, $sourceChecksum) {
            $template = TemplateModelRegistry::query()->findOrFail($templateId);
            Access::authorize('manage', $template);
            $candidate = $this->find($templateId, $candidateId);
            [$source, $version] = $this->current($template);
            $this->check($source, $version, $expectedVersion, $sourceChecksum);
            if ($candidate->status !== 'pending' || $candidate->expected_version !== $version || $candidate->source_checksum !== $sourceChecksum) {
                throw new DraftConflict;
            }
            $initial = $this->build($template, $source, $candidate->operation, $this->target($candidate->inputs['target']), []);
            if (CanonicalJson::hash($initial['evidence']) !== CanonicalJson::hash($this->map($candidate->inputs['evidence']))) {
                throw new DraftConflict;
            }
            $conflicts = array_column($initial['conflicts'], null, 'id');
            foreach ($resolutions as $id => $choice) {
                if (! isset($conflicts[$id]) || ! in_array($choice, ['local', 'family'], true) || ($choice === 'local' && ! $conflicts[$id]['localAllowed'])) {
                    $this->fail('resolutions', 'An invalid conflict resolution was supplied.');
                }
            }
            foreach ($conflicts as $id => $conflict) {
                if (! isset($resolutions[$id])) {
                    $this->fail('resolutions', 'Resolve every conflict before previewing its result.');
                }
            }
            $projection = clone $candidate;
            $projection->result = $this->build($template, $source, $candidate->operation, $this->target($candidate->inputs['target']), $resolutions);

            return $this->dto($projection);
        });
    }

    /** Atomically apply a candidate after checking source, version and dependency evidence.
     * @param  array<string, 'local'|'family'>  $resolutions
     * @return array{version: int, sourceChecksum: string, source: array<array-key,mixed>, candidate: array<string,mixed>}
     */
    public function apply(string $templateId, string $candidateId, array $resolutions, int $expectedVersion, string $sourceChecksum, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($templateId, $candidateId, $resolutions, $expectedVersion, $sourceChecksum) {
            return TemplateModelRegistry::newInstance()->getConnection()->transaction(function () use ($templateId, $candidateId, $resolutions, $expectedVersion, $sourceChecksum): array {
                $template = TemplateModelRegistry::query()->lockForUpdate()->findOrFail($templateId);
                Access::authorize('manage', $template);
                $candidate = $this->find($templateId, $candidateId);
                if ($candidate->status !== 'pending') {
                    throw new DraftConflict;
                }
                [$source,$version] = $this->current($template);
                $this->check($source, $version, $expectedVersion, $sourceChecksum);
                if ($candidate->expected_version !== $version || $candidate->source_checksum !== $sourceChecksum) {
                    throw new DraftConflict;
                }
                $initial = $this->build($template, $source, $candidate->operation, $this->target($candidate->inputs['target']), []);
                if (CanonicalJson::hash($initial['evidence']) !== CanonicalJson::hash($this->map($candidate->inputs['evidence']))) {
                    throw new DraftConflict;
                }
                $known = array_column($initial['conflicts'], null, 'id');
                foreach ($resolutions as $id => $choice) {
                    if (! isset($known[$id]) || ! in_array($choice, ['local', 'family'], true) || ($choice === 'local' && ! $known[$id]['localAllowed'])) {
                        $this->fail('resolutions', 'An invalid conflict resolution was supplied.');
                    }
                }
                foreach ($known as $id => $conflict) {
                    if (! isset($resolutions[$id])) {
                        $this->fail('resolutions', 'Resolve every conflict before applying this candidate.');
                    }
                }
                $resolved = $this->build($template, $source, $candidate->operation, $this->target($candidate->inputs['target']), $resolutions);
                $newSource = $resolved['source'];
                $map = [];
                if ($candidate->operation === 'detach') {
                    $context = $this->documents->authoringTemplate($template);
                    [$newSource,$map] = $this->cloner->copy($context, $newSource);
                }
                $draft = TemplateDraft::query()->where('template_id', $templateId)->first() ?? new TemplateDraft(['template_id' => $templateId]);
                $draft->fill(['version' => $version + 1, 'document' => $newSource, 'proposed_basis' => ['candidateId' => $candidate->id, 'groupId' => $resolved['targetGroupId']]])->save();
                [$appliedDocument] = $this->documents->prepareSource($template, $newSource);
                $resolved['source'] = $newSource;
                $resolved['document'] = $appliedDocument;
                $candidate->update(['status' => 'applied', 'resolutions' => $resolutions, 'applied_version' => $draft->version, 'result' => array_replace($resolved, ['resourceMap' => $map])]);

                $payload = ['version' => $draft->version, 'sourceChecksum' => CanonicalJson::hash($newSource), 'source' => JsonWire::document($newSource, $this->map($candidate->result['document'])), 'candidate' => $this->dto($candidate)];
                PreviewPayload::check($payload);

                return $payload;
            });
        });
    }

    /**
     * Candidate scheduling within family publication.
     *
     * @internal
     */
    public function upgradesFor(TemplateGroupRevision $family): void
    {
        $proposedMembers = TemplateDraft::query()->select('template_id');
        // JSON paths use the query grammar; they are not Eloquent attribute names.
        $proposedMembers->getQuery()->where('proposed_basis->groupId', $family->group_id);
        $members = TemplateModelRegistry::query()->where(fn ($query) => $query->where('group_id', $family->group_id)->orWhereIn('id', $proposedMembers))->get();
        foreach ($members as $template) {
            // Publishing a family must not fail because another variant is unavailable to this actor.
            if (! Access::allows('manage', $template)) {
                continue;
            }
            try {
                [$source,$version] = $this->current($template);
                $sourceAuthority = $this->map($source['source'] ?? []);
                $sourceGroup = $this->map($sourceAuthority['group'] ?? []);
                if (($sourceAuthority['mode'] ?? null) !== 'group-variant' || ($sourceGroup['id'] ?? null) !== $family->group_id || ($sourceGroup['revision'] ?? 0) >= $family->revision) {
                    continue;
                }
                $this->prepare($template->id, 'upgrade', ['groupId' => $family->group_id, 'revision' => $family->revision], $version, CanonicalJson::hash($source), $this->operation->actor());
            } catch (ValidationException|ModelNotFoundException|AuthorizationException|DraftConflict) {/* Unavailable or concurrently edited drafts can prepare a fresh candidate later. */
            }
        }
    }

    /**
     * @param  array<array-key,mixed>  $source
     * @param  array<array-key,mixed>  $choices
     * @param  array<array-key,mixed>|null  $target
     * @return CandidateResult
     */
    private function build(Template $template, array $source, string $operation, ?array $target, array $choices): array
    {
        if ($target !== null && (array_diff(array_keys($target), ['groupId', 'revision']) || $operation === 'detach')) {
            $this->fail('target', 'Use only the exact target family and revision; detach requires null.');
        }
        if (! in_array($operation, ['upgrade', 'rebase', 'detach', 'regroup'], true)) {
            $this->fail('operation', 'Unsupported family operation.');
        }
        $authority = $this->map($source['source'] ?? []);
        $sourceGroup = $this->map($authority['group'] ?? []);
        $api = $this->documents;
        $context = $api->authoringTemplate($template);
        $current = $api->rawEffective($template, $source);
        $currentUnavailable = false;
        try {
            $currentSnapshot = $this->resources->snapshot($context, $current);
        } catch (ValidationException|ModelNotFoundException|AuthorizationException $error) {
            if ($operation === 'detach') {
                throw $error;
            }
            $currentUnavailable = true;
            $currentSnapshot = ['dependencies' => []];
        }
        $base = null;
        if (($authority['mode'] ?? null) === 'group-variant') {
            $base = TemplateGroupRevision::query()->where('group_id', $sourceGroup['id'] ?? null)->where('revision', $sourceGroup['revision'] ?? null)->firstOrFail();
        }
        $conflicts = [];
        $comparisonBytes = 32768;
        if ($currentUnavailable) {
            $conflicts[] = $this->conflict('unavailable-source', 'resources', 'The old family has unavailable resources. Review and adopt the authorized target family before continuing.', false);
        }
        $family = null;
        $sourceOut = $source;
        if ($operation === 'detach') {
            if ($base === null) {
                $this->fail('operation', 'Only a family variant may be detached.');
            }
            $evidence = $this->cloner->evidence($context, $current);
            $sourceOut = $current;
            $detachedSource = $this->map($sourceOut['source'] ?? []);
            $detachedSource['mode'] = 'standalone';
            $sourceOut['source'] = $detachedSource;
            unset($sourceOut['compiled'],$sourceOut['variationPoints']);
            $document = $currentSnapshot;
        } else {
            if (! is_string($target['groupId'] ?? null) || ! is_int($target['revision'] ?? null)) {
                $this->fail('target', 'Choose an exact family revision.');
            }
            $group = TemplateGroup::query()->findOrFail($target['groupId']);
            Access::authorize('read', $group);
            $family = TemplateGroupRevision::query()->where('group_id', $group->id)->where('revision', $target['revision'])->firstOrFail();
            Access::authorize('read', $family);
            if ($group->status !== 'active') {
                $this->fail('target', 'The target family is unavailable.');
            }
            if (in_array($operation, ['upgrade', 'rebase'], true) && ($base === null || $base->group_id !== $family->group_id || $family->revision <= $base->revision)) {
                $this->fail('target', 'Upgrade and rebase require a newer revision of the same family.');
            }
            if ($operation === 'regroup' && $base?->group_id === $family->group_id) {
                $this->fail('target', 'Regroup requires a different family.');
            }
            if ($source['target'] !== $family->document['target']) {
                $this->fail('target', 'A family change cannot change the output target.');
            }
            $targetContext = clone $template;
            $targetContext->group_id = $family->group_id;
            $overrides = $this->map($authority['overrides'] ?? []);
            if ($operation === 'regroup') {
                try {
                    $comparable = $current;
                    $comparableSource = $this->map($comparable['source'] ?? []);
                    $comparableDefinition = $this->map($comparableSource['definition'] ?? []);
                    $familyDefinition = $this->map($this->map($family->source['source'] ?? [])['definition'] ?? []);
                    $comparableDefinition['id'] = $familyDefinition['id'] ?? null;
                    $comparableDefinition['name'] = $familyDefinition['name'] ?? null;
                    $comparableSource['definition'] = $comparableDefinition;
                    $comparable['source'] = $comparableSource;
                    if (array_key_exists('variationPoints', $family->source)) {
                        $comparable['variationPoints'] = $family->source['variationPoints'];
                    } else {
                        unset($comparable['variationPoints']);
                    }
                    $overrides = $this->materializer->derive($family->source, $comparable, []);
                } catch (ValidationException $e) {
                    $conflicts[] = $this->conflict('regroup', 'source', 'The current design has differences unsupported by the target family.', false);
                    $overrides = [];
                }
            } else {
                foreach ($overrides as $namespace => $values) {
                    if (! in_array($namespace, ['content', 'settingsDefaults', 'variations'], true) || ! is_array($values)) {
                        continue;
                    }
                    foreach ($values as $key => $value) {
                        $id = $namespace.'.'.$key;
                        $valid = true;
                        try {
                            $trial = $this->materializer->materialize($family->source, [$namespace => [$key => $value]]);
                            $this->validateValues($targetContext, $trial);
                        } catch (ValidationException|ModelNotFoundException|AuthorizationException) {
                            $valid = false;
                        }
                        $old = $namespace === 'variations' ? $this->pointBasis($base->source, (string) $key) : ($this->map($base->source[$namespace] ?? [])[$key] ?? null);
                        $new = $namespace === 'variations' ? $this->pointBasis($family->source, (string) $key) : ($this->map($family->source[$namespace] ?? [])[$key] ?? null);
                        if (! $valid || CanonicalJson::hash([$old]) !== CanonicalJson::hash([$new])) {
                            $focusedValues = ! $currentUnavailable && $namespace === 'variations'
                                ? $this->pointValues($this->nullableMap($old), $this->nullableMap($new), $this->map($value), $base->source, $family->source, $comparisonBytes)
                                : null;
                            $comparison = $currentUnavailable ? null : $this->comparison(
                                $namespace === 'variations' ? 'structure' : 'value',
                                [$namespace === 'variations' ? $old !== null : array_key_exists($key, $this->map($base->source[$namespace] ?? [])), $namespace === 'variations' ? $old : $this->comparisonValue($base->source, $namespace, $key, $old)],
                                [true, $namespace === 'variations' ? $value : $this->comparisonValue($base->source, $namespace, $key, $value)],
                                [$namespace === 'variations' ? $new !== null : array_key_exists($key, $this->map($family->source[$namespace] ?? [])), $namespace === 'variations' ? $new : $this->comparisonValue($family->source, $namespace, $key, $new)],
                                $comparisonBytes,
                            );
                            if ($focusedValues !== null) {
                                $comparison['values'] = $focusedValues;
                            }
                            $conflicts[] = $this->conflict($id, 'source.overrides.'.$id, $valid ? 'The inherited value changed beneath this local override.' : 'This override is no longer allowed by the target family.', $valid, $comparison);
                            if (($choices[$id] ?? null) === 'family' || ! $valid) {
                                $remaining = $this->map($overrides[$namespace]);
                                unset($remaining[$key]);
                                $overrides[$namespace] = $remaining;
                            }
                        }
                    }
                }
                foreach (['exposedInputs', 'exposedSettings'] as $namespace) {
                    if (isset($overrides[$namespace]) && array_diff($this->strings($overrides[$namespace]), $this->strings($family->source[$namespace] ?? []))) {
                        $id = $namespace;
                        $comparison = $currentUnavailable ? null : $this->comparison(
                            'capabilities',
                            [array_key_exists($namespace, $base->source), $base->source[$namespace] ?? null],
                            [true, $overrides[$namespace]],
                            [array_key_exists($namespace, $family->source), $family->source[$namespace] ?? null],
                            $comparisonBytes,
                        );
                        $conflicts[] = $this->conflict($id, 'source.overrides.'.$namespace, 'The family narrowed the permitted editor controls.', false, $comparison);
                        unset($overrides[$namespace]);
                    }
                }
            }
            $sourceOut = $this->variant($family, $overrides);
            $document = $this->materializer->materialize($family->source, $overrides);
            $targetContext = clone $template;
            $targetContext->group_id = $family->group_id;
            try {
                $targetSnapshot = $this->resources->snapshot($targetContext, $document);
            } catch (ValidationException|ModelNotFoundException|AuthorizationException) {
                $conflicts[] = $this->conflict('resources', 'resources', 'References are unavailable in the target scope. Adopting the family discards these local differences and uses its complete design.', false);
                $sourceOut = $this->variant($family, []);
                $document = $family->source;
                $targetSnapshot = $this->resources->snapshot($targetContext, $document);
            }
            $document = $targetSnapshot;
            $resultSource = $this->map($document['source'] ?? []);
            $resultDefinition = $this->map($resultSource['definition'] ?? []);
            $resultDefinition['id'] = 't_'.str_replace('-', '', $template->id);
            $resultDefinition['name'] = $template->name;
            $resultSource['definition'] = $resultDefinition;
            $document['source'] = $resultSource;
            $evidence = $targetSnapshot['dependencies'] ?? [];
        }

        return ['operation' => $operation, 'targetGroupId' => $family?->group_id, 'targetRevision' => $family?->revision, 'source' => $sourceOut, 'document' => $document, 'conflicts' => $conflicts, 'changes' => ['fromGroupId' => $base?->group_id, 'fromRevision' => $base?->revision, 'toGroupId' => $family?->group_id, 'toRevision' => $family?->revision],
            'evidence' => ['base' => $base?->checksum, 'target' => $family?->checksum, 'currentDependencies' => $this->map($currentSnapshot['dependencies'] ?? []), 'targetDependencies' => $this->map($evidence)]];
    }

    /**
     * @param  array<array-key,mixed>  $document
     */
    private function validateValues(Template $context, array $document): void
    {
        $resolved = $this->resources->snapshot($context, $document);
        foreach (['content' => 'content', 'settingsDefaults' => 'settings'] as $key => $namespace) {
            $runtimeSchemas = $this->map($this->map($document['dataSchema'] ?? [])['properties'] ?? []);
            $schema = $this->map($runtimeSchemas[$namespace] ?? ['type' => 'object']);
            if ($namespace === 'settings') {
                /** @param array<array-key,mixed> $schema
                 * @return array<array-key,mixed> */
                $relax = function (array $schema) use (&$relax): array {
                    unset($schema['required']);
                    if (isset($schema['properties'])) {
                        $properties = $this->map($schema['properties']);
                        foreach ($properties as $id => $child) {
                            $properties[$id] = $relax($this->map($child));
                        }
                        $schema['properties'] = $properties;
                    }

                    return $schema;
                };
                $schema = $relax($schema);
            }
            app(SchemaValidator::class)->validate($resolved[$key] ?? [], $schema, 'source.overrides.'.$key);
        }
    }

    /**
     * @param  array<array-key,mixed>  $document
     */
    private function pointBasis(array $document, string $id): mixed
    {
        $definition = $this->map($this->map($document['source'] ?? [])['definition'] ?? []);
        $definitionNodes = $this->map($definition['nodes'] ?? []);
        foreach ($this->map($document['variationPoints'] ?? []) as $rawPoint) {
            $point = $this->map($rawPoint);
            if (($point['id'] ?? null) !== $id) {
                continue;
            }
            $nodeId = $this->text($point['nodeId'] ?? '');
            $node = $this->map($definitionNodes[$nodeId] ?? []);
            $kind = $this->text($point['kind']);
            $property = $this->text($point['property'] ?? '');
            if ($kind === 'node-property') {
                return [$point, $node[$property] ?? null];
            }
            if ($kind === 'node-style') {
                return [$point, $this->map($node['style'] ?? [])[$property] ?? null];
            }
            if ($kind === 'block-property') {
                $block = $this->registeredBlock($definition, $node);
                $props = $this->map($node['props'] ?? []);
                $binding = $this->nullableMap($props[$property] ?? null);
                $metadata = ($binding['source'] ?? null) === 'literal' ? [] : $this->map($this->map($block['propertyMetadata'] ?? [])[$property] ?? []);

                return [$point, [$node['blockId'] ?? null, $node['version'] ?? null],
                    ['assigned' => array_key_exists($property, $this->map($node['props'] ?? [])), 'value' => $this->map($node['props'] ?? [])[$property] ?? null],
                    ['hasDefault' => array_key_exists('defaultValue', $metadata), 'defaultValue' => $metadata['defaultValue'] ?? null]];
            }
            $nodes = [];
            $regionNodes = $definitionNodes;
            $slotBasis = null;
            $visit = function (string $id) use (&$visit, &$nodes, &$regionNodes): void {
                if (isset($nodes[$id]) || ! isset($regionNodes[$id])) {
                    return;
                }
                $n = $this->map($regionNodes[$id]);
                $nodes[$id] = $n;
                foreach ($this->strings($n['children'] ?? []) as $child) {
                    $visit($child);
                }
                foreach ($this->map($n['slots'] ?? []) as $children) {
                    foreach ($this->strings($children) as $child) {
                        $visit($child);
                    }
                }
            };
            if ($kind === 'placement') {
                $order = [$nodeId];
            } else {
                $target = $this->map($point['target']);
                $targetNodeId = $this->text($target['nodeId'] ?? '');
                $parent = $this->map($definitionNodes[$targetNodeId] ?? []);
                $slots = $this->map($parent['slots'] ?? []);
                if ($target['kind'] === 'block-slot') {
                    $slotName = $this->text($target['slot']);
                    $assigned = array_key_exists($slotName, $slots);
                    $slotBasis = [$parent['blockId'] ?? null, $parent['version'] ?? null, 'assigned' => $assigned];
                    $order = $this->strings($slots[$slotName] ?? []);
                    if (! $assigned) {
                        $block = $this->registeredBlock($definition, $parent);
                        $regionNodes = $this->map($block['nodes'] ?? []);
                        foreach ($regionNodes as $rawSlot) {
                            $slot = $this->map($rawSlot);
                            if (($slot['kind'] ?? null) === 'slot' && $slot['slot'] === $target['slot']) {
                                $order = $this->strings($slot['children']);
                                break;
                            }
                        }
                    }
                } else {
                    $order = $this->strings($target['kind'] === 'roots' ? $definition['roots'] : ($parent['children'] ?? []));
                }
            }
            foreach ($order as $nodeId) {
                $visit($nodeId);
            }

            return [$point, $order, $nodes, $slotBasis];
        }

        return null;
    }

    /**
     * @param  array<array-key,mixed>  $definition
     * @param  array<array-key,mixed>  $node
     * @return array<array-key,mixed>|null
     */
    private function registeredBlock(array $definition, array $node): ?array
    {
        foreach ($this->map($definition['blocks'] ?? []) as $rawBlock) {
            $block = $this->map($rawBlock);
            if ($block['id'] === ($node['blockId'] ?? null) && $block['version'] === ($node['version'] ?? null)) {
                return $block;
            }
        }

        return null;
    }

    /**
     * @param  array<array-key,mixed>  $overrides
     * @return array<array-key,mixed>
     */
    private function variant(TemplateGroupRevision $family, array $overrides): array
    {
        return ['format' => 'template-document', 'schemaVersion' => 1, 'target' => $family->document['target'], 'source' => ['mode' => 'group-variant', 'group' => ['id' => $family->group_id, 'revision' => $family->revision], 'overrides' => $overrides]];
    }

    /**
     * @param  array<array-key,mixed>  $patch
     * @param  array<array-key,mixed>  $previousDocument
     * @param  array<array-key,mixed>  $targetDocument
     * @param  array<array-key,mixed>|null  $previous
     * @param  array<array-key,mixed>|null  $target
     * @return array<array-key,mixed>|null
     */
    private function pointValues(?array $previous, ?array $target, array $patch, array $previousDocument, array $targetDocument, int &$remainingBytes): ?array
    {
        $previousPoint = $this->map($previous[0] ?? []);
        $targetPoint = $this->map($target[0] ?? []);
        $kind = $previousPoint['kind'] ?? null;
        if (! in_array($kind, ['node-property', 'node-style', 'block-property'], true) || ($patch['kind'] ?? null) !== $kind || ($target !== null && ($targetPoint['kind'] ?? null) !== $kind)) {
            return null;
        }
        [$previousPresent, $previousValue] = $this->pointValue($previous, $previousDocument);
        [$localPresent, $localValue] = $this->pointValue($previous, $previousDocument, $patch);
        [$targetPresent, $targetValue] = $this->pointValue($target, $targetDocument);

        return [
            'previous' => $this->comparisonSnapshot($previousValue, $previousPresent, $remainingBytes),
            'local' => $this->comparisonSnapshot($localValue, $localPresent, $remainingBytes),
            'target' => $this->comparisonSnapshot($targetValue, $targetPresent, $remainingBytes),
        ];
    }

    /**
     * @param  array<array-key,mixed>|null  $basis
     * @param  array<array-key,mixed>  $document
     * @param  array<array-key,mixed>|null  $patch
     * @return array{0:bool,1:mixed}
     */
    private function pointValue(?array $basis, array $document, ?array $patch = null): array
    {
        if ($basis === null) {
            return [false, null];
        }
        $point = $this->map($basis[0]);
        $nodeId = $this->text($point['nodeId']);
        $property = $this->text($point['property']);
        $definition = $this->map($this->map($document['source'] ?? [])['definition'] ?? []);
        $node = $this->map($this->map($definition['nodes'] ?? [])[$nodeId] ?? []);
        $binding = false;
        if ($patch !== null) {
            $present = array_key_exists('value', $patch);
            $value = $patch['value'] ?? null;
            $binding = $point['kind'] === 'block-property';
        } elseif ($point['kind'] === 'block-property') {
            $assignment = $this->map($basis[2]);
            $defaults = $this->map($basis[3]);
            $binding = $this->boolean($assignment['assigned']);
            $present = $binding || $this->boolean($defaults['hasDefault']);
            $value = $binding ? $assignment['value'] : $defaults['defaultValue'];
        } else {
            $present = array_key_exists($property, $point['kind'] === 'node-style' ? $this->map($node['style'] ?? []) : $node);
            $value = $basis[1];
        }
        if (! $present) {
            return [false, null];
        }
        if ($point['kind'] === 'block-property') {
            $block = $this->registeredBlock($definition, $node);
            $schema = $this->map($this->map($block['props'] ?? [])[$property] ?? []);
            if ($binding) {
                if (is_array($value) && ($value['source'] ?? null) === 'literal' && array_key_exists('value', $value)) {
                    $value['value'] = JsonWire::value($value['value'], $schema);
                }

                return [true, $value];
            }
        } else {
            $schema = $this->map($point['schema']);
        }

        return [true, JsonWire::value($value, $schema)];
    }

    /**
     * @param  array<array-key,mixed>  $document
     */
    private function comparisonValue(array $document, string $namespace, string|int $key, mixed $value): mixed
    {
        $properties = $this->map($this->map($document['dataSchema'] ?? [])['properties'] ?? []);
        $schema = $this->map($properties[$namespace === 'content' ? 'content' : 'settings'] ?? ['type' => 'object']);
        $wire = JsonWire::value([$key => $value], $schema);

        if ($wire instanceof \stdClass) {
            return $wire->{$key};
        }
        if (is_array($wire)) {
            return $wire[$key];
        }
        $this->fail('schema', 'A comparison namespace must remain an object or array.');
    }

    /**
     * @param  array{0:bool,1:mixed}  $previous
     * @param  array{0:bool,1:mixed}  $local
     * @param  array{0:bool,1:mixed}  $target
     * @return array<string,mixed>
     */
    private function comparison(string $kind, array $previous, array $local, array $target, int &$remainingBytes): array
    {
        return [
            'kind' => $kind,
            'previous' => $this->comparisonSnapshot($previous[1], $previous[0], $remainingBytes),
            'local' => $this->comparisonSnapshot($local[1], $local[0], $remainingBytes),
            'target' => $this->comparisonSnapshot($target[1], $target[0], $remainingBytes),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function comparisonSnapshot(mixed $value, bool $present, int &$remainingBytes): array
    {
        if (! $present) {
            return ['present' => false, 'type' => 'missing', 'preview' => '', 'truncated' => false];
        }
        $type = match (true) {
            $value === null => 'null',
            is_string($value) => 'string',
            is_bool($value) => 'boolean',
            is_int($value), is_float($value) => 'number',
            is_array($value) && array_is_list($value) => 'array',
            default => 'object',
        };
        $display = is_string($value) ? $value : json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        $preview = mb_strcut($display, 0, min(2048, $remainingBytes), 'UTF-8');
        $remainingBytes -= strlen($preview);

        return ['present' => true, 'type' => $type, 'preview' => $preview, 'truncated' => strlen($preview) < strlen($display), 'checksum' => CanonicalJson::hash([$value])];
    }

    /**
     * @param  array<array-key,mixed>|null  $comparison
     * @return Conflict
     */
    private function conflict(string $id, string $path, string $message, bool $local, ?array $comparison = null): array
    {
        $conflict = ['id' => $id, 'path' => $path, 'message' => $message, 'localAllowed' => $local, 'choices' => $local ? ['local', 'family'] : ['family']];
        if ($comparison !== null) {
            $conflict['comparison'] = $comparison;
        }

        return $conflict;
    }

    /**
     * @param  array<array-key,mixed>  $source
     */
    private function check(array $source, int $version, int $expected, string $hash): void
    {
        if ($version !== $expected || CanonicalJson::hash($source) !== $hash) {
            throw new DraftConflict;
        }
    }

    private function find(string $templateId, string $id): FamilyChange
    {
        $t = TemplateModelRegistry::query()->findOrFail($templateId);
        Access::authorize('manage', $t);

        return FamilyChange::query()->where('template_id', $templateId)->findOrFail($id);
    }

    /**
     * @return array<string,mixed>
     */
    private function dto(FamilyChange $c): array
    {
        $r = $c->result;
        $changes = $this->map($r['changes'] ?? []);
        foreach ([
            [$changes['fromGroupId'] ?? null, $changes['fromRevision'] ?? null],
            [$r['targetGroupId'] ?? null, $r['targetRevision'] ?? null],
        ] as [$groupId, $revision]) {
            if ($groupId === null || $groupId === '') {
                continue;
            }
            $groupId = $this->text($groupId);
            Access::authorize('read', TemplateGroup::query()->findOrFail($groupId));
            $family = TemplateGroupRevision::query()->where('group_id', $groupId)->where('revision', $revision)->firstOrFail();
            Access::authorize('read', $family);
        }
        $evidence = $this->map($r['evidence'] ?? []);
        foreach (array_merge($this->map($evidence['currentDependencies'] ?? []), $this->map($evidence['targetDependencies'] ?? [])) as $rawPin) {
            $pin = $this->map($rawPin);
            Access::authorize('read', TemplateResource::query()->findOrFail($pin['resourceId']));
        }
        unset($r['evidence']);
        $rawSource = $this->map($r['source']);
        $document = $this->map($r['document']);
        $wireSource = JsonWire::document($rawSource, $document);
        $authority = $this->map($rawSource['source'] ?? []);
        if (($authority['mode'] ?? null) === 'group-variant') {
            $wireAuthority = $this->map($wireSource['source'] ?? []);
            $rawOverrides = $this->map($authority['overrides'] ?? []);
            $overrides = (array) ($wireAuthority['overrides'] ?? []);
            $properties = $this->map($this->map($document['dataSchema'] ?? [])['properties'] ?? []);
            foreach (['content' => 'content', 'settingsDefaults' => 'settings'] as $key => $namespace) {
                if (array_key_exists($key, $rawOverrides)) {
                    $overrides[$key] = JsonWire::value($rawOverrides[$key], $this->map($properties[$namespace] ?? ['type' => 'object']));
                }
            }
            $wireAuthority['overrides'] = (object) $overrides;
            $wireSource['source'] = $wireAuthority;
        }
        $r['source'] = $wireSource;
        $previewAssets = [];
        $r['previewAssets'] = (object) $previewAssets;
        $r['document'] = JsonWire::document($document);
        if (isset($r['resourceMap'])) {
            $r['resourceMap'] = (object) $r['resourceMap'];
        }
        $payload = ['id' => $c->id, 'templateId' => $c->template_id, 'expectedVersion' => $c->expected_version, 'sourceChecksum' => $c->source_checksum, 'status' => $c->status, 'appliedVersion' => $c->applied_version, 'resolutions' => (object) ($c->resolutions ?? []), ...$r];
        PreviewPayload::check($payload);
        foreach ($this->map($document['managedAssets'] ?? []) as $id => $rawAssetId) {
            $assetId = $this->text($rawAssetId);
            Access::authorize('read', TemplateAsset::query()->findOrFail($assetId));
            $previewAssets[$id] = $this->assets->resolve($assetId)['url'];
            $payload['previewAssets'] = (object) $previewAssets;
            PreviewPayload::check($payload);
        }

        return $payload;
    }

    /** @return array<array-key,mixed> */
    private function map(mixed $value): array
    {
        if (! is_array($value)) {
            $this->fail('source', 'Expected a decoded JSON container.');
        }

        return $value;
    }

    /** @return array<array-key,mixed>|null */
    private function nullableMap(mixed $value): ?array
    {
        return $value === null ? null : $this->map($value);
    }

    /** @return array{groupId:string,revision:int}|null */
    private function target(mixed $value): ?array
    {
        if ($value === null) {
            return null;
        }
        $target = $this->map($value);
        if (array_diff(array_keys($target), ['groupId', 'revision']) || ! is_string($target['groupId'] ?? null) || ! is_int($target['revision'] ?? null)) {
            $this->fail('target', 'Choose an exact family revision.');
        }

        return ['groupId' => $target['groupId'], 'revision' => $target['revision']];
    }

    /** @return list<string> */
    private function strings(mixed $value): array
    {
        $strings = [];
        foreach ($this->map($value) as $item) {
            if (! is_string($item)) {
                $this->fail('source', 'Expected string identifiers.');
            }
            $strings[] = $item;
        }

        return $strings;
    }

    private function text(mixed $value): string
    {
        if (! is_string($value)) {
            $this->fail('source', 'Expected a string identity.');
        }

        return $value;
    }

    private function boolean(mixed $value): bool
    {
        if (! is_bool($value)) {
            $this->fail('source', 'Expected an explicit presence flag.');
        }

        return $value;
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => [$message]]);
    }
}
