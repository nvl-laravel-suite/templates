<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

/**
 * Native document persistence record.
 *
 * @property string $key
 * @property string $name
 * @property string $status
 * @property int $version
 * @property string|null $current_revision_id
 *
 * @api
 */
final class TemplateGroup extends TemplateModel
{
    protected string $tableKey = 'groups';

    protected function casts(): array
    {
        return ['version' => 'integer'];
    }
}
