<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Native document persistence record.
 *
 * @property string $template_id
 * @property string $operation
 * @property int $expected_version
 * @property string $source_checksum
 * @property array<string, mixed> $inputs
 * @property array<string, mixed> $result
 * @property string $status
 * @property array<string, mixed>|null $resolutions
 * @property int|null $applied_version
 *
 * @api
 */
final class FamilyChange extends TemplateModel
{
    protected string $tableKey = 'family_changes';

    protected function casts(): array
    {
        return ['expected_version' => 'integer', 'inputs' => 'array', 'result' => 'array', 'resolutions' => 'array', 'applied_version' => 'integer'];
    }

    /** @return BelongsTo<Template, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(TemplateModelRegistry::modelClass(), 'template_id');
    }
}
