<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Exceptions\DraftConflict;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\CanonicalJson;

/**
 * Native document operations.
 *
 * @api
 */
final class TemplateLifecycle
{
    public function __construct(
        private readonly TemplateOperation $operation,
        private readonly DocumentResolver $documents,
        private readonly DocumentValidator $validator,
        private readonly ResourceManager $resources,
    ) {}

    /** Create a scoped root from a closed identity map; ownership is never accepted from data.
     * @param  array{key: string, name: string, groupId?: string|null}  $data
     */
    public function create(array $data, Authenticatable|SystemActor $actor): Template
    {
        return $this->operation->run($actor, function () use ($data) {
            DocumentInputs::identity($data, true);
            $key = $data['key'];
            $name = $data['name'];
            $groupId = $data['groupId'] ?? null;
            Access::authorize('manage');
            if ($groupId !== null) {
                Access::authorize('manage', TemplateGroup::query()->findOrFail($groupId));
            }

            return TemplateModelRegistry::create(['key' => $key, 'name' => $name, 'group_id' => $groupId]);
        });
    }

    /** Save raw authoring authority with optimistic draft concurrency.
     * @param  array<array-key, mixed>  $document  Portable template-document v1 source; validated before persistence.
     */
    public function saveDraft(string $templateId, array $document, int $expectedVersion, Authenticatable|SystemActor $actor): TemplateDraft
    {
        return $this->operation->run($actor, function () use ($templateId, $document, $expectedVersion) {
            Access::authorize('manage');

            return TemplateModelRegistry::newInstance()->getConnection()->transaction(function () use ($templateId, $document, $expectedVersion): TemplateDraft {
                $template = TemplateModelRegistry::query()->lockForUpdate()->findOrFail($templateId);
                Access::authorize('manage', $template);
                $draft = TemplateDraft::query()->where('template_id', $templateId)->first();
                if (($draft->version ?? 0) !== $expectedVersion) {
                    throw new DraftConflict;
                }
                $this->validator->draft($document);
                $this->documents->effectiveDocument($template, $document);
                $draft ??= new TemplateDraft(['template_id' => $templateId]);
                $draft->fill(['document' => $document, 'version' => $expectedVersion + 1])->save();

                return $draft;
            });
        });
    }

    /** Publish an immutable effective snapshot of exactly the expected draft version.
     */
    public function publish(string $templateId, int $expectedVersion, Authenticatable|SystemActor $actor): TemplateRevision
    {
        return $this->operation->run($actor, function () use ($templateId, $expectedVersion) {
            Access::authorize('manage');

            return TemplateModelRegistry::newInstance()->getConnection()->transaction(function () use ($templateId, $expectedVersion): TemplateRevision {
                $template = TemplateModelRegistry::query()->lockForUpdate()->findOrFail($templateId);
                Access::authorize('manage', $template);
                $draft = TemplateDraft::query()->where('template_id', $templateId)->firstOrFail();
                if ($draft->version !== $expectedVersion) {
                    throw new DraftConflict;
                }
                [$effective, $family] = $this->documents->effectiveDocument($template, $draft->document);
                $this->documents->requireCompilation($draft->document, $effective);
                $effective = $this->resources->snapshot($this->documents->authoringTemplate($template), $effective);
                $this->validator->publication($effective);
                $revision = TemplateRevision::query()->create([
                    'template_id' => $templateId, 'revision' => $template->version + 1,
                    'group_id' => $family?->group_id, 'group_revision_id' => $family?->id,
                    'source' => $draft->document, 'document' => $effective,
                    'dependencies' => $effective['dependencies'] ?? [], 'checksum' => CanonicalJson::hash($effective), 'published_at' => now(),
                ]);
                $template->update(['version' => $revision->revision, 'current_revision_id' => $revision->id, 'group_id' => $family?->group_id]);
                if ($draft->proposed_basis !== null) {
                    $draft->update(['proposed_basis' => null]);
                }

                return $revision;
            });
        });
    }
}
