<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Native document persistence record.
 *
 * @property string $group_id
 * @property int $revision
 * @property array<string, mixed> $source
 * @property array<string, mixed> $document
 * @property string $checksum
 * @property Carbon $published_at
 *
 * @api
 */
final class TemplateGroupRevision extends TemplateModel
{
    use ImmutableRevision;

    protected string $tableKey = 'group_revisions';

    protected function casts(): array
    {
        return ['revision' => 'integer', 'document' => 'array', 'source' => 'array', 'published_at' => 'immutable_datetime'];
    }

    /** @return BelongsTo<TemplateGroup, $this> */
    public function group(): BelongsTo
    {
        return $this->belongsTo(TemplateGroup::class, 'group_id');
    }
}
