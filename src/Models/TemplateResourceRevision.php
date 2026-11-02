<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Native document persistence record.
 *
 * @property string $resource_id
 * @property int $revision
 * @property array<string, mixed> $document
 * @property string $checksum
 * @property array<string, mixed>|null $provenance
 * @property string|null $origin_revision_id
 *
 * @api
 */
final class TemplateResourceRevision extends TemplateModel
{
    use ImmutableRevision;

    protected string $tableKey = 'resource_revisions';

    protected function casts(): array
    {
        return ['revision' => 'integer', 'document' => 'array', 'provenance' => 'array'];
    }

    /** @return BelongsTo<TemplateResource, $this> */
    public function resource(): BelongsTo
    {
        return $this->belongsTo(TemplateResource::class, 'resource_id');
    }
}
