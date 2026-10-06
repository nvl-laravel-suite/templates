<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Nvl\Support\Config\PackageStorage;
use Nvl\Templates\Database\Factories\TemplateTranslationFactory;
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Support\TemplatesConfiguration;

/**
 * Localized template label and management description.
 *
 * @property string $id
 * @property string $template_id
 * @property string $locale
 * @property string $title
 * @property string|null $description
 * @property-read Template $template
 *
 * @api
 *
 * @nvl-consumer-read id
 */
final class TemplateTranslation extends Model
{
    /** @use HasFactory<TemplateTranslationFactory> */
    use HasFactory;

    use HasUuids;

    /** @var list<string> */
    protected $fillable = ['template_id', 'tenant_id', 'ownership_key', 'locale', 'title', 'description'];

    public function getTable(): string
    {
        return TemplatesConfiguration::table(TemplatesTables::get(TemplatesTables::I18n));
    }

    public function getConnectionName(): ?string
    {
        return PackageStorage::connectionName($this->connection ?? PackageStorage::connection('templates') ?? parent::getConnectionName());
    }

    /**
     * Return the canonical template for this locale row.
     *
     * @return BelongsTo<Template, $this>
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class, 'template_id');
    }

    /**
     * Return the package's runtime fixture factory.
     *
     * @internal
     */
    protected static function newFactory(): TemplateTranslationFactory
    {
        return TemplateTranslationFactory::new();
    }
}
