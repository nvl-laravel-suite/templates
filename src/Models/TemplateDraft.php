<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Native document persistence record.
 *
 * @property string $template_id
 * @property int $version
 * @property array<string, mixed> $document
 * @property array<string, mixed>|null $proposed_basis
 *
 * @api
 */
final class TemplateDraft extends TemplateModel
{
    protected string $tableKey = 'drafts';

    protected function casts(): array
    {
        return ['version' => 'integer', 'document' => 'array', 'proposed_basis' => 'array'];
    }

    /** @return BelongsTo<Template, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(TemplateModelRegistry::modelClass(), 'template_id');
    }
}
