<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;
use Nvl\Content\Models\ContentPlacement;
use Nvl\Content\Relations\StringMorphMany;
use Nvl\Content\Services\ContentOwnerDeletion;
use Nvl\Support\Config\PackageStorage;
use Nvl\Support\Ownership\Contracts\Ownable;
use Nvl\Templates\Database\Factories\TemplateVersionFactory;
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Enums\TemplateVersionStatus;
use Nvl\Templates\Models\Concerns\OwnsTemplateChild;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Support\TemplatesConfiguration;

/**
 * Numbered publication snapshot of a template.
 *
 * @property string|null $owner_scope_key
 * @property string $id
 * @property string $template_id
 * @property int $version
 * @property TemplateVersionStatus $status
 * @property array<string, mixed>|null $metadata
 * @property array{ownerType:string,ownerId:string,group:string,blocks:list<array{placementId:string,parentId:string|null,key:string,region:string,sortOrder:int,blockId:string,definitionKey:string,definitionSchema:array<string,mixed>,definitionView:string|null,visibility:string,values:array<string, mixed>,translations:array<string, array<string, mixed>>,overrides:array<string, mixed>,blockRevision:int,placementRevision:int}>,version:string,tenantId:string|null,formatVersion:int,ownershipContext:array<string,mixed>|null}|null $content_snapshot
 * @property string|null $content_hash
 * @property int $revision
 * @property string|null $catalog_grant_id
 * @property string|null $catalog_source_version_id
 * @property int|null $catalog_source_revision
 * @property string|null $catalog_source_hash
 * @property string|null $catalog_import_key
 * @property string|null $published_by_type
 * @property string|null $published_by
 * @property Carbon|null $published_at
 * @property-read Template $template
 *
 * @api
 */
final class TemplateVersion extends Model implements Ownable
{
    /** @use HasFactory<TemplateVersionFactory> */
    use HasFactory;

    use HasUuids;
    use OwnsTemplateChild;

    public const string CONTENT_OWNER_TYPE = 'nvl-template-version';

    public const string CONTENT_GROUP = 'document';

    /** @var list<string> */
    protected $fillable = [
        'template_id',
        'version',
        'status',
        'metadata',
        'content_snapshot',
        'content_hash',
        'published_by_type',
        'published_by',
        'published_at',
        'catalog_grant_id',
        'catalog_source_version_id',
        'catalog_source_revision',
        'catalog_source_hash',
        'catalog_import_key',
        'catalog_import_request_hash',
    ];

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'draft',
        'revision' => 1,
    ];

    /** Resolve the configured native table owned by this model. */
    public function getTable(): string
    {
        return TemplatesConfiguration::table(TemplatesTables::get(TemplatesTables::Versions));
    }

    /** Resolve the actual package source connection. */
    public function getConnectionName(): ?string
    {
        return PackageStorage::connectionName($this->connection ?? PackageStorage::connection('templates') ?? parent::getConnectionName());
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'status' => TemplateVersionStatus::class,
            'metadata' => 'array',
            'content_snapshot' => 'array',
            'revision' => 'integer',
            'published_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return BelongsTo<Template, $this>
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(TemplateModelRegistry::modelClass(), 'template_id');
    }

    /**
     * Restrict the query to published versions.
     *
     * @param  Builder<static>  $query
     */
    public function scopePublished(Builder $query): void
    {
        $query->where('status', TemplateVersionStatus::Published->value);
    }

    /**
     * Increment the optimistic-lock revision for draft updates.
     */
    protected static function booted(): void
    {
        self::saving(static function (TemplateVersion $version): void {
            if ($version->exists && ! $version->isDirty('revision')) {
                $revision = $version->getOriginal('revision');
                $version->revision = (is_numeric($revision) ? (int) $revision : 0) + 1;
            }
        });
    }

    /**
     * Return the package's runtime fixture factory.
     *
     * @internal
     */
    protected static function newFactory(): TemplateVersionFactory
    {
        return TemplateVersionFactory::new();
    }

    /** Keep optional Content placement cleanup on the owning connection. */
    public function delete(): ?bool
    {
        if (config('nvl-templates.integrations.content', false)) {
            return app(ContentOwnerDeletion::class)->execute($this, fn (): ?bool => parent::delete());
        }

        return parent::delete();
    }

    /** @return list<string> */
    public function contentGroups(): array
    {
        return [self::CONTENT_GROUP];
    }

    /** Relation used only by the explicitly enabled Content integration.
     * @return MorphMany<ContentPlacement, $this>
     */
    public function contentPlacements(): MorphMany
    {
        $related = new ContentPlacement;

        return new StringMorphMany($related->newQuery(), $this, $related->qualifyColumn('owner_type'), $related->qualifyColumn('owner_id'), $this->getKeyName());
    }
}
