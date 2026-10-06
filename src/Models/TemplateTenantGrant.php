<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Nvl\Support\Config\PackageStorage;
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Support\TemplatesConfiguration;

/**
 * Revocable platform permission to copy one immutable Template version.
 *
 * @property string $id
 * @property string $template_version_id
 * @property string $recipient_tenant_id
 * @property int $source_revision
 * @property int $revision
 * @property Carbon|null $revoked_at
 * @property-read TemplateVersion $version
 *
 * @api
 */
final class TemplateTenantGrant extends Model
{
    use HasUuids;

    protected $fillable = ['template_version_id', 'recipient_tenant_id', 'source_revision', 'revision', 'revoked_at'];

    protected $attributes = ['revision' => 1];

    public function getTable(): string
    {
        return TemplatesConfiguration::table(TemplatesTables::get(TemplatesTables::TenantGrants));
    }

    public function getConnectionName(): ?string
    {
        return PackageStorage::connectionName($this->connection ?? PackageStorage::connection('templates') ?? parent::getConnectionName());
    }

    protected function casts(): array
    {
        return ['source_revision' => 'integer', 'revision' => 'integer', 'revoked_at' => 'immutable_datetime'];
    }

    /** @return BelongsTo<TemplateVersion,$this> */
    public function version(): BelongsTo
    {
        return $this->belongsTo(TemplateVersion::class, 'template_version_id');
    }
}
