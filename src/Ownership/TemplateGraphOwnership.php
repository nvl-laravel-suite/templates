<?php

declare(strict_types=1);

namespace Nvl\Templates\Ownership;

use Illuminate\Database\Eloquent\Model;
use Nvl\Content\Contracts\ContentStorage;
use Nvl\Media\Services\MediaModelRegistry;
use Nvl\Support\Ownership\Exceptions\OwnershipViolation;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateOwnerRegistry;

/**
 * Rechecks secondary edges and immutable published content inside the actual source write lease.
 *
 * @internal
 */
final readonly class TemplateGraphOwnership
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(private TemplateOwnerRegistry $owners, private ContentStorage $contentStorage) {}

    /** Validate immutable content and secondary graph edges inside the source lease. */
    public function assertWrite(Model $model): void
    {
        if (! TemplatesOwnership::declared()) {
            return;
        }
        if (! $this->contentStorage->owned() || MediaModelRegistry::modelClass()::ownershipDefinition()->strategy === 'unscoped') {
            throw new OwnershipViolation('Owned Templates require owned Content and Media resources.');
        }
        if ($model instanceof TemplateVersion && $model->exists) {
            $row = $model->getConnection()->table($model->getTable())->where('id', $model->getRawOriginal('id'))->first();
            if ($row !== null && in_array($row->status, ['published', 'retired'], true) && (! in_array($model->status->value, ['published', 'retired'], true) || $model->isDirty(['metadata', 'content_snapshot', 'content_hash', 'published_by_type', 'published_by', 'published_at']))) {
                throw new OwnershipViolation('Published Template content is immutable.');
            }
        }
        if ($model instanceof TemplateRender && $model->exists) {
            foreach (['payload', 'settings'] as $column) {
                if ($model->isDirty($column) && ! ($model->getAttribute($column) === null && in_array($model->status->value, ['completed', 'failed'], true))) {
                    throw new OwnershipViolation('Template render inputs are immutable except for terminal erasure.');
                }
            }
        }
        if ($model instanceof TemplateAssignment) {
            $this->owners->resolve($model->owner_type, $model->owner_id);
        }
        if ($model instanceof TemplateAssignment || $model instanceof TemplateRender) {
            $version = $model->getAttribute('template_version_id');
            if ($version !== null && ! TemplateVersion::query()->whereKey($version)->where('template_id', $model->getAttribute('template_id'))->exists()) {
                throw new OwnershipViolation('A Template version must belong to the same canonical root.');
            }
        }
        if ($model instanceof TemplateRender && $model->exists && $model->isDirty('template_assignment_id') && $model->getAttribute('template_assignment_id') !== null) {
            throw new OwnershipViolation('A durable render assignment may only be cleared.');
        }
        if ($model instanceof TemplateRender && $model->getAttribute('template_assignment_id') !== null && ! TemplateAssignment::query()->whereKey($model->getAttribute('template_assignment_id'))->where('template_id', $model->getAttribute('template_id'))->exists()) {
            throw new OwnershipViolation('A Template render assignment must belong to the same canonical root.');
        }
    }
}
