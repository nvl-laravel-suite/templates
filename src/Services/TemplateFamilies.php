<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Exceptions\DraftConflict;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Models\TemplateGroupRevision;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\CanonicalJson;

/**
 * Native document operations.
 *
 * @api
 */
final class TemplateFamilies
{
    public function __construct(
        private readonly TemplateOperation $operation,
        private readonly FamilyMaterializer $materializer,
        private readonly ResourceManager $resources,
        private readonly DocumentValidator $validator,
        private readonly FamilyLifecycle $families,
    ) {}

    /** Create a reusable family root.
     * @param  array{key: string, name: string}  $data
     */
    public function create(array $data, Authenticatable|SystemActor $actor): TemplateGroup
    {
        return $this->operation->run($actor, function () use ($data) {
            DocumentInputs::identity($data);
            $key = $data['key'];
            $name = $data['name'];
            Access::authorize('manage');

            return TemplateGroup::query()->create(['key' => $key, 'name' => $name]);
        });
    }

    /** Publish an immutable family source and dependency closure, then prepare eligible upgrades.
     * @param  array<array-key, mixed>  $document  Portable standalone template-document v1 source.
     */
    public function publish(string $groupId, array $document, int $expectedRevision, Authenticatable|SystemActor $actor): TemplateGroupRevision
    {
        return $this->operation->run($actor, function () use ($groupId, $document, $expectedRevision) {
            Access::authorize('manage');

            return (new TemplateGroup)->getConnection()->transaction(function () use ($groupId, $document, $expectedRevision): TemplateGroupRevision {
                $group = TemplateGroup::query()->lockForUpdate()->findOrFail($groupId);
                Access::authorize('manage', $group);
                if ($group->version !== $expectedRevision) {
                    throw new DraftConflict;
                }
                $sourceDefinition = DocumentInputs::map($document['source'] ?? null, 'source');
                if (($sourceDefinition['mode'] ?? null) !== 'standalone') {
                    throw ValidationException::withMessages(['source' => ['A family must have a standalone base definition.']]);
                }
                $source = $document;
                $this->materializer->materialize($source, []);
                $document = $this->resources->snapshot($group, $document);
                $this->validator->publication($document);
                $revision = TemplateGroupRevision::query()->create(['group_id' => $groupId, 'revision' => $group->version + 1, 'source' => $source, 'document' => $document, 'checksum' => CanonicalJson::hash($document), 'published_at' => now()]);
                $group->update(['version' => $revision->revision, 'current_revision_id' => $revision->id]);
                $this->families->upgradesFor($revision);

                return $revision;
            });
        });
    }
}
