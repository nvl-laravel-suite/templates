<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Nvl\Support\Config\PackageStorage;
use Nvl\Support\Ownership\Contracts\Ownable;
use Nvl\Support\Ownership\Traits\HasOwnership;
use Nvl\Templates\Database\Factories\TemplateFactory;
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Support\TemplatesConfiguration;
use Nvl\Translatable\Contracts\TranslatableModel;
use Nvl\Translatable\Enums\TranslationMutationPolicy;
use Nvl\Translatable\RelatedTranslationDefinition;
use Nvl\Translatable\Translatable as HasTranslations;

/**
 * Structural, renderer-bound template aggregate.
 *
 * @property string|null $owner_scope_key
 * @property string $id
 * @property string|null $tenant_id
 * @property string $ownership_key
 * @property string $key
 * @property string $renderer
 * @property TemplateStatus $status
 * @property array<string, mixed>|null $schema
 * @property array<string, mixed>|null $metadata
 * @property int $revision
 * @property-read Collection<int, TemplateTranslation> $translations
 * @property-read Collection<int, TemplateVersion> $versions
 * @property-read Collection<int, TemplateAssignment> $assignments
 *
 * @api
 */
class Template extends Model implements Ownable, TranslatableModel
{
    /** @use HasFactory<TemplateFactory> */
    use HasFactory;

    use HasOwnership;
    use HasTranslations;

    /** Central sources require an explicitly enabled configured subclass. */
    public static function allowsCentralCatalog(): bool
    {
        return false;
    }

    /** @param mixed $value
     * @param  string|null  $field
     */
    public function resolveRouteBinding($value, $field = null): ?Template
    {
        $model = TemplateModelRegistry::newInstance();

        return $model->newQuery()->where($field ?? $model->getRouteKeyName(), $value)->first();
    }

    use HasUuids;

    /** @var list<string> */
    protected $fillable = [
        'key',
        'tenant_id',
        'ownership_key',
        'renderer',
        'status',
        'schema',
        'metadata',
    ];

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'active',
        'revision' => 1,
    ];

    protected function defineTranslations(): RelatedTranslationDefinition
    {
        return new RelatedTranslationDefinition(
            translationModel: TemplateTranslation::class,
            foreignKey: 'template_id',
            fields: ['title', 'description'],
            mutationPolicy: TranslationMutationPolicy::DomainActionOnly,
            ownershipResource: 'templates.templates',
        );
    }

    /** Resolve the configured native table owned by this model. */
    public function getTable(): string
    {
        return TemplatesConfiguration::table(TemplatesTables::get(TemplatesTables::Templates));
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
            'status' => TemplateStatus::class,
            'schema' => 'array',
            'metadata' => 'array',
            'revision' => 'integer',
        ];
    }

    /**
     * @return HasMany<TemplateVersion, $this>
     */
    public function versions(): HasMany
    {
        return $this->hasMany(TemplateVersion::class, 'template_id')->orderByDesc('version');
    }

    /**
     * @return HasMany<TemplateAssignment, $this>
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(TemplateAssignment::class, 'template_id');
    }

    /**
     * Increment the optimistic-lock revision for ordinary updates.
     */
    protected static function booted(): void
    {
        self::saving(static function (Template $template): void {
            if ($template->exists && ! $template->isDirty('revision')) {
                $revision = $template->getOriginal('revision');
                $template->revision = (is_numeric($revision) ? (int) $revision : 0) + 1;
            }
        });
    }

    /**
     * Return the package's runtime fixture factory.
     *
     * @internal
     */
    protected static function newFactory(): TemplateFactory
    {
        return TemplateFactory::new();
    }
}
