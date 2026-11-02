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
 * @property string $kind
 * @property string $scope
 * @property string $owner_key
 * @property string|null $group_id
 * @property string|null $template_id
 * @property string|null $current_revision_id
 * @property array<string, mixed>|null $restrictions
 *
 * @api
 */
final class TemplateResource extends TemplateModel
{
    protected string $tableKey = 'resources';

    protected function casts(): array
    {
        return ['version' => 'integer', 'restrictions' => 'array'];
    }
}
