<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Nvl\Support\Config\PackageStorage;
use Nvl\Support\Ownership\Contracts\Ownable;
use Nvl\Support\Ownership\Traits\HasOwnership;
use Nvl\Support\Ownership\ValueObjects\OwnershipDefinition;
use Nvl\Templates\Database\Factories\TemplateOwnerGrantFactory;
use Nvl\Templates\Definitions\Tables\TemplatesTables;

/**
 * Recipient-owned revocable capability to copy one central immutable version.
 *
 * @property string $id
 * @property string $template_version_id
 * @property int $source_revision
 * @property int $revision
 * @property string $owner_scope_key
 * @property string $owner_reference
 * @property Carbon|null $revoked_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read TemplateVersion $version
 *
 * @nvl-consumer-read id
 * @nvl-consumer-read revision
 * @nvl-consumer-read source_revision
 * @nvl-consumer-read template_version_id
 * @nvl-consumer-read revoked_at
 *
 * @api
 */
final class TemplateOwnerGrant extends Model implements Ownable
{
    /** @use HasFactory<TemplateOwnerGrantFactory> */
    use HasFactory;

    use HasOwnership;
    use HasUuids;

    /** @var list<string> */
    protected $fillable = [];

    /** @var array<string,int> */
    protected $attributes = ['revision' => 1];

    /** Capture this capability's recipient independently from its central source. */
    public static function ownershipDefinition(): OwnershipDefinition
    {
        return OwnershipDefinition::captured();
    }

    /** Resolve the configured native capability table. */
    public function getTable(): string
    {
        return TemplatesTables::get(TemplatesTables::OwnerGrants);
    }

    /** Resolve the actual Templates source connection. */
    public function getConnectionName(): ?string
    {
        return PackageStorage::connectionName($this->connection ?? PackageStorage::connection('templates') ?? parent::getConnectionName());
    }

    /** Return canonical persisted capability value casts.
     * @return array<string,string>
     */
    protected function casts(): array
    {
        return ['source_revision' => 'integer', 'revision' => 'integer', 'revoked_at' => 'immutable_datetime', 'created_at' => 'immutable_datetime', 'updated_at' => 'immutable_datetime'];
    }

    /** Define the source identity; central reads still require the catalog capability workflow.
     * @return BelongsTo<TemplateVersion,$this>
     */
    public function version(): BelongsTo
    {
        return $this->belongsTo(TemplateVersion::class, 'template_version_id');
    }

    /**
     * Return the explicitly admitted fixture builder.
     *
     * @internal
     */
    protected static function newFactory(): TemplateOwnerGrantFactory
    {
        return TemplateOwnerGrantFactory::new();
    }
}
