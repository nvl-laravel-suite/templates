<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Nvl\Templates\Database\Factories\TemplateFactory;

/**
 * Native document persistence record.
 *
 * @property string $key
 * @property string $name
 * @property string $status
 * @property int $version
 * @property string|null $current_revision_id
 * @property string|null $group_id
 *
 * @api
 */
class Template extends TemplateModel
{
    /** @use HasFactory<TemplateFactory> */
    use HasFactory;

    protected static function newFactory(): TemplateFactory
    {
        return TemplateFactory::new();
    }

    protected string $tableKey = 'templates';

    protected function casts(): array
    {
        return ['version' => 'integer'];
    }
}
