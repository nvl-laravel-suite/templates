<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Native document persistence record.
 *
 * @property string $template_id
 * @property int $revision
 * @property string|null $group_id
 * @property string|null $group_revision_id
 * @property array<string, mixed> $source
 * @property array<string, mixed> $document
 * @property array<array-key, mixed> $dependencies
 * @property string $checksum
 * @property Carbon $published_at
 *
 * @api
 */
final class TemplateRevision extends TemplateModel
{
    use ImmutableRevision;

    protected string $tableKey = 'revisions';

    protected function casts(): array
    {
        return ['revision' => 'integer', 'source' => 'array', 'document' => 'array', 'dependencies' => 'array', 'published_at' => 'immutable_datetime'];
    }

    /** @return BelongsTo<Template, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(TemplateModelRegistry::modelClass(), 'template_id');
    }
}
