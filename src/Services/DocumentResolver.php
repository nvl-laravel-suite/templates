<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Models\TemplateGroupRevision;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Support\Compiler;

/**
 * Resolves raw authoring authority inside an admitted operation.
 *
 * @internal
 */
final class DocumentResolver
{
    public function __construct(
        private readonly TemplateOperation $operation,
        private readonly DocumentValidator $validator,
        private readonly ResourceManager $resources,
        private readonly FamilyMaterializer $materializer,
    ) {}

    /** @param array<array-key,mixed> $source
     * @return array{array<array-key,mixed>, TemplateGroupRevision|null}
     */
    public function prepareSource(Template $template, array $source, bool $resolveResources = true): array
    {
        Access::authorize('manage', $template);
        $this->validator->draft($source);
        [$effective,$family] = $this->effectiveDocument($template, $source);

        return [$resolveResources ? $this->resources->snapshot($this->authoringTemplate($template), $effective) : $effective, $family];
    }

    public function authoringTemplate(Template $template): Template
    {
        $draft = TemplateDraft::query()->where('template_id', $template->id)->first();
        if ($draft?->proposed_basis !== null) {
            $template = clone $template;
            $groupId = $draft->proposed_basis['groupId'] ?? null;
            if ($groupId !== null && ! is_string($groupId)) {
                throw ValidationException::withMessages(['source' => ['The proposed family identity is invalid.']]);
            }
            $template->group_id = $groupId;
        }

        return $template;
    }

    /** @param array<array-key,mixed> $source
     * @return array<array-key,mixed>
     */
    public function rawEffective(Template $template, array $source): array
    {
        [$effective] = $this->effectiveDocument($template, $source);

        return $effective;
    }

    /** @param array<array-key,mixed> $source
     * @return array{array<array-key,mixed>, TemplateGroupRevision|null}
     */
    public function effectiveDocument(Template $template, array $source): array
    {
        $this->operation->actor();
        $template = $this->authoringTemplate($template);
        $authoring = DocumentInputs::map($source['source'] ?? null, 'source');
        $mode = $authoring['mode'] ?? null;
        $groupPin = DocumentInputs::map($authoring['group'] ?? [], 'source.group');
        if ($mode === 'standalone' && $template->group_id === null) {
            return [$source, null];
        }
        if ($mode !== 'group-variant' || $template->group_id === null || ($groupPin['id'] ?? null) !== $template->group_id) {
            throw ValidationException::withMessages(['source' => ['The source must match the template family or standalone mode.']]);
        }
        if (array_diff(array_keys($source), ['format', 'schemaVersion', 'target', 'source', 'compiled']) ||
            array_diff(array_keys($authoring), ['mode', 'group', 'overrides']) ||
            array_diff(array_keys($groupPin), ['id', 'revision'])) {
            throw ValidationException::withMessages(['source' => ['A family variant stores only its exact family pin and declared overrides.']]);
        }
        $group = TemplateGroup::query()->findOrFail($template->group_id);
        Access::authorize('read', $group);
        $family = TemplateGroupRevision::query()->where('group_id', $template->group_id)->where('revision', $groupPin['revision'] ?? 0)->firstOrFail();
        Access::authorize('read', $family);
        if (($source['target'] ?? null) !== $family->document['target']) {
            throw ValidationException::withMessages(['target' => ['A variant must keep the pinned family output target.']]);
        }
        // Resolve the resource closure only after local overrides replace inherited references.
        $effective = $this->materializer->materialize($family->source, DocumentInputs::map($authoring['overrides'] ?? [], 'source.overrides'));
        $effective = DocumentInputs::map($effective, 'document');
        $definitionSource = DocumentInputs::map($effective['source'] ?? null, 'source');
        $definition = DocumentInputs::map($definitionSource['definition'] ?? null, 'source.definition');
        $definition['id'] = 't_'.str_replace('-', '', $template->id);
        $definition['name'] = $template->name;
        $definitionSource['definition'] = $definition;
        $effective['source'] = $definitionSource;
        // Browser artifacts attest preview freshness; the materialized family remains output authority.
        if (isset($source['compiled'])) {
            $compiled = DocumentInputs::map($source['compiled'], 'compiled');
            $sourceKey = $compiled['sourceKey'] ?? null;
            $key = is_string($sourceKey) ? json_decode($sourceKey, true) : null;
            $envelope = array_intersect_key($source, array_flip(['format', 'schemaVersion', 'target', 'source']));
            if (! is_array($key) || CanonicalJson::hash($key) !== CanonicalJson::hash($envelope) || ! is_array($compiled['artifacts'] ?? null)) {
                throw ValidationException::withMessages(['compiled' => ['Compilation does not match the current authoring source.']]);
            }
        }

        return [$effective, $family];
    }

    /**
     * Compile every structural delta, including style and typography, through trusted server code.
     * Browser stamps check source freshness; their artifacts never replace family output or sidecars.
     *
     * @param  array<array-key,mixed>  $source
     * @param  array<array-key,mixed>  $effective
     */
    public function requireCompilation(array $source, array &$effective): void
    {
        $authoring = DocumentInputs::map($source['source'] ?? null, 'source');
        $overrides = DocumentInputs::map($authoring['overrides'] ?? [], 'source.overrides');
        if (($overrides['variations'] ?? []) === []) {
            return;
        }
        if (Compiler::configured() === null) {
            throw ValidationException::withMessages(['compiled' => ['Structural family variants require a configured trusted compiler before preview or publication.']]);
        }
        $artifacts = DocumentInputs::map($effective['artifacts'] ?? [], 'artifacts');
        $effective['artifacts'] = array_replace($artifacts, ['engine' => 'shared', 'html' => '', 'css' => '']);
        if (isset($effective['rendering'])) {
            $rendering = DocumentInputs::map($effective['rendering'], 'rendering');
            $effective['rendering'] = array_replace($rendering, ['engine' => 'shared']);
        }
    }
}
