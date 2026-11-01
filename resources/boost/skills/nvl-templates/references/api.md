# Public API: nvl/templates

Generated from the package public contract. Use this reference to confirm fully qualified names, parameter order, defaults, native array shapes and return types. Read [usage](usage.md) for policy and operation semantics; declarations alone never grant authority.

Search for the relevant fully qualified service or contract and read only its matching symbol sections; this is a lookup catalog, not an instruction to load every declaration. `resolved` annotations expand imported aliases and domain type shapes. Framework inheritance and host-authored extensions remain outside this package contract.

## Symbols

- `Nvl\Templates\Contracts\TemplateAssetResolver`
- `Nvl\Templates\Contracts\TemplateAuthorization`
- `Nvl\Templates\Contracts\TemplateCatalogAccess`
- `Nvl\Templates\Contracts\TemplateOwnerResolver`
- `Nvl\Templates\Contracts\TemplatePayloadValidator`
- `Nvl\Templates\Contracts\TemplateRenderer`
- `Nvl\Templates\Database\Factories\TemplateAssignmentFactory`
- `Nvl\Templates\Database\Factories\TemplateFactory`
- `Nvl\Templates\Database\Factories\TemplateOwnerGrantFactory`
- `Nvl\Templates\Database\Factories\TemplateRenderFactory`
- `Nvl\Templates\Database\Factories\TemplateTranslationFactory`
- `Nvl\Templates\Database\Factories\TemplateVersionFactory`
- `Nvl\Templates\Enums\PdfOrientation`
- `Nvl\Templates\Enums\PdfPageSize`
- `Nvl\Templates\Enums\TemplateAbility`
- `Nvl\Templates\Enums\TemplateStatus`
- `Nvl\Templates\Enums\TemplatesResponseCode`
- `Nvl\Templates\Events\TemplateChanged`
- `Nvl\Templates\Events\TemplateRendered`
- `Nvl\Templates\Exceptions\StaleTemplateException`
- `Nvl\Templates\Exceptions\TemplateDependencyUnavailableException`
- `Nvl\Templates\Exceptions\TemplateResolutionException`
- `Nvl\Templates\Exceptions\TemplatesException`
- `Nvl\Templates\Models\Template`
- `Nvl\Templates\Models\TemplateAssignment`
- `Nvl\Templates\Models\TemplateOwnerGrant`
- `Nvl\Templates\Models\TemplateRender`
- `Nvl\Templates\Models\TemplateTranslation`
- `Nvl\Templates\Models\TemplateVersion`
- `Nvl\Templates\Ownership\TemplateOwnerCatalog`
- `Nvl\Templates\Rendering\TemplateRenderContext`
- `Nvl\Templates\Services\TemplateAssignments`
- `Nvl\Templates\Services\TemplateDefinitionRegistry`
- `Nvl\Templates\Services\TemplateDefinitions`
- `Nvl\Templates\Services\TemplateImporter`
- `Nvl\Templates\Services\TemplateLifecycle`
- `Nvl\Templates\Services\TemplateModelRegistry`
- `Nvl\Templates\Services\TemplateOwnerRegistry`
- `Nvl\Templates\Services\TemplateReader`
- `Nvl\Templates\Services\TemplateRenderer`
- `Nvl\Templates\Services\TemplateRendererRegistry`
- `Nvl\Templates\Template`

## Nvl\Templates\Contracts\TemplateAssetResolver

```text
interface Nvl\Templates\Contracts\TemplateAssetResolver
public abstract function resolve(string $key, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): ?string
public abstract function scope(string $scope, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor, ?string $type=null): array
@return array<string, string>
```

## Nvl\Templates\Contracts\TemplateAuthorization

```text
interface Nvl\Templates\Contracts\TemplateAuthorization
public abstract function authorize(Nvl\Templates\Enums\TemplateAbility $ability, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor, array $context=[]): void
@param array<string, mixed> $context
```

## Nvl\Templates\Contracts\TemplateCatalogAccess

```text
interface Nvl\Templates\Contracts\TemplateCatalogAccess
public abstract function assertCanGrant(string $sourceId, int $revision): void
public abstract function assertCanRevoke(string $grantId): void
```

## Nvl\Templates\Contracts\TemplateOwnerResolver

```text
interface Nvl\Templates\Contracts\TemplateOwnerResolver
public abstract function alias(): string
public abstract function resolve(string $identifier): ?Illuminate\Database\Eloquent\Model
```

## Nvl\Templates\Contracts\TemplatePayloadValidator

```text
interface Nvl\Templates\Contracts\TemplatePayloadValidator
public abstract function validate(array $schema, array $payload): void
@param array<string, mixed> $schema
@param array<string, mixed> $payload
public abstract function validateSchema(array $schema): void
@param array<string, mixed> $schema
```

## Nvl\Templates\Contracts\TemplateRenderer

```text
interface Nvl\Templates\Contracts\TemplateRenderer
public abstract function render(Nvl\Templates\Rendering\TemplateRenderContext $context): array
@return array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: (string | null), suggested_filename: (string | null)}
```

## Nvl\Templates\Database\Factories\TemplateAssignmentFactory

```text
final class Nvl\Templates\Database\Factories\TemplateAssignmentFactory extends Illuminate\Database\Eloquent\Factories\Factory
@extends Factory<TemplateAssignment>
resolved @extends Illuminate\Database\Eloquent\Factories\Factory<Nvl\Templates\Models\TemplateAssignment>
public function definition(): array
@return array<model-property<TemplateAssignment>, mixed>
resolved @return array<model-property<Nvl\Templates\Models\TemplateAssignment>, mixed>
public function forOwner(Illuminate\Database\Eloquent\Model $owner): static
public function forTemplate(Nvl\Templates\Models\Template $parent): static
public function forVersion(Nvl\Templates\Models\TemplateVersion $parent): static
```

## Nvl\Templates\Database\Factories\TemplateFactory

```text
final class Nvl\Templates\Database\Factories\TemplateFactory extends Illuminate\Database\Eloquent\Factories\Factory
@extends Factory<Template>
resolved @extends Illuminate\Database\Eloquent\Factories\Factory<Nvl\Templates\Models\Template>
public function definition(): array
@return array<model-property<Template>, mixed>
resolved @return array<model-property<Nvl\Templates\Models\Template>, mixed>
public function modelName(): string
```

## Nvl\Templates\Database\Factories\TemplateOwnerGrantFactory

```text
final class Nvl\Templates\Database\Factories\TemplateOwnerGrantFactory extends Illuminate\Database\Eloquent\Factories\Factory
@extends Factory<TemplateOwnerGrant>
resolved @extends Illuminate\Database\Eloquent\Factories\Factory<Nvl\Templates\Models\TemplateOwnerGrant>
public function configure(): static
public function definition(): array
@return array<model-property<TemplateOwnerGrant>, mixed>
resolved @return array<model-property<Nvl\Templates\Models\TemplateOwnerGrant>, mixed>
public function forVersion(Nvl\Templates\Models\TemplateVersion $source): static
```

## Nvl\Templates\Database\Factories\TemplateRenderFactory

```text
final class Nvl\Templates\Database\Factories\TemplateRenderFactory extends Illuminate\Database\Eloquent\Factories\Factory
@extends Factory<TemplateRender>
resolved @extends Illuminate\Database\Eloquent\Factories\Factory<Nvl\Templates\Models\TemplateRender>
public function definition(): array
@return array<model-property<TemplateRender>, mixed>
resolved @return array<model-property<Nvl\Templates\Models\TemplateRender>, mixed>
public function forAssignment(Nvl\Templates\Models\TemplateAssignment $assignment): static
public function forVersion(Nvl\Templates\Models\TemplateVersion $parent): static
```

## Nvl\Templates\Database\Factories\TemplateTranslationFactory

```text
final class Nvl\Templates\Database\Factories\TemplateTranslationFactory extends Illuminate\Database\Eloquent\Factories\Factory
@extends Factory<TemplateTranslation>
resolved @extends Illuminate\Database\Eloquent\Factories\Factory<Nvl\Templates\Models\TemplateTranslation>
public function definition(): array
@return array<model-property<TemplateTranslation>, mixed>
resolved @return array<model-property<Nvl\Templates\Models\TemplateTranslation>, mixed>
public function forTemplate(Nvl\Templates\Models\Template $parent): static
```

## Nvl\Templates\Database\Factories\TemplateVersionFactory

```text
final class Nvl\Templates\Database\Factories\TemplateVersionFactory extends Illuminate\Database\Eloquent\Factories\Factory
@extends Factory<TemplateVersion>
resolved @extends Illuminate\Database\Eloquent\Factories\Factory<Nvl\Templates\Models\TemplateVersion>
public function definition(): array
@return array<model-property<TemplateVersion>, mixed>
resolved @return array<model-property<Nvl\Templates\Models\TemplateVersion>, mixed>
public function forTemplate(Nvl\Templates\Models\Template $parent): static
public function published(array $snapshot): static
@param array{ownerType: string, ownerId: string, group: string, blocks: list<array{placementId: string, parentId: (string | null), key: string, region: string, sortOrder: int, blockId: string, definitionKey: string, definitionSchema: array<string, mixed>, definitionView: (string | null), visibility: string, values: array<string, mixed>, translations: array<string, array<string, mixed>>, overrides: array<string, mixed>, blockRevision: int, placementRevision: int}>, version: string, tenantId: (string | null), formatVersion: int, ownershipContext: (array<string, mixed> | null)} $snapshot
```

## Nvl\Templates\Enums\PdfOrientation

```text
enum Nvl\Templates\Enums\PdfOrientation implements BackedEnum, UnitEnum: string
public const Nvl\Templates\Enums\PdfOrientation Landscape=Nvl\Templates\Enums\PdfOrientation::Landscape="landscape"
public const Nvl\Templates\Enums\PdfOrientation Portrait=Nvl\Templates\Enums\PdfOrientation::Portrait="portrait"
public function mpdfValue(): string
public readonly string $name
public static function cases(): array
public readonly string $value
public static function from(string|int $value): static
public static function tryFrom(string|int $value): ?static
```

## Nvl\Templates\Enums\PdfPageSize

```text
enum Nvl\Templates\Enums\PdfPageSize implements BackedEnum, UnitEnum: string
public const Nvl\Templates\Enums\PdfPageSize A3=Nvl\Templates\Enums\PdfPageSize::A3="A3"
public const Nvl\Templates\Enums\PdfPageSize A4=Nvl\Templates\Enums\PdfPageSize::A4="A4"
public const Nvl\Templates\Enums\PdfPageSize A5=Nvl\Templates\Enums\PdfPageSize::A5="A5"
public const Nvl\Templates\Enums\PdfPageSize Legal=Nvl\Templates\Enums\PdfPageSize::Legal="Legal"
public const Nvl\Templates\Enums\PdfPageSize Letter=Nvl\Templates\Enums\PdfPageSize::Letter="Letter"
public readonly string $name
public static function cases(): array
public readonly string $value
public static function from(string|int $value): static
public static function tryFrom(string|int $value): ?static
```

## Nvl\Templates\Enums\TemplateAbility

```text
enum Nvl\Templates\Enums\TemplateAbility implements BackedEnum, UnitEnum: string
public const Nvl\Templates\Enums\TemplateAbility Assign=Nvl\Templates\Enums\TemplateAbility::Assign="assign"
public const Nvl\Templates\Enums\TemplateAbility Create=Nvl\Templates\Enums\TemplateAbility::Create="create"
public const Nvl\Templates\Enums\TemplateAbility Delete=Nvl\Templates\Enums\TemplateAbility::Delete="delete"
public const Nvl\Templates\Enums\TemplateAbility List=Nvl\Templates\Enums\TemplateAbility::List="list"
public const Nvl\Templates\Enums\TemplateAbility Publish=Nvl\Templates\Enums\TemplateAbility::Publish="publish"
public const Nvl\Templates\Enums\TemplateAbility Render=Nvl\Templates\Enums\TemplateAbility::Render="render"
public const Nvl\Templates\Enums\TemplateAbility Update=Nvl\Templates\Enums\TemplateAbility::Update="update"
public const Nvl\Templates\Enums\TemplateAbility View=Nvl\Templates\Enums\TemplateAbility::View="view"
public readonly string $name
public static function cases(): array
public readonly string $value
public static function from(string|int $value): static
public static function tryFrom(string|int $value): ?static
```

## Nvl\Templates\Enums\TemplateStatus

```text
enum Nvl\Templates\Enums\TemplateStatus implements BackedEnum, UnitEnum: string
public const Nvl\Templates\Enums\TemplateStatus Active=Nvl\Templates\Enums\TemplateStatus::Active="active"
public const Nvl\Templates\Enums\TemplateStatus Archived=Nvl\Templates\Enums\TemplateStatus::Archived="archived"
public const Nvl\Templates\Enums\TemplateStatus Inactive=Nvl\Templates\Enums\TemplateStatus::Inactive="inactive"
public readonly string $name
public static function cases(): array
public readonly string $value
public static function from(string|int $value): static
public static function tryFrom(string|int $value): ?static
```

## Nvl\Templates\Enums\TemplatesResponseCode

```text
enum Nvl\Templates\Enums\TemplatesResponseCode implements BackedEnum, Nvl\Support\Contracts\ResponseCode, UnitEnum: string
public const Nvl\Templates\Enums\TemplatesResponseCode OperationFailed=Nvl\Templates\Enums\TemplatesResponseCode::OperationFailed="operation_failed"
public const Nvl\Templates\Enums\TemplatesResponseCode PdfDependencyUnavailable=Nvl\Templates\Enums\TemplatesResponseCode::PdfDependencyUnavailable="pdf_dependency_unavailable"
public const Nvl\Templates\Enums\TemplatesResponseCode StaleTemplate=Nvl\Templates\Enums\TemplatesResponseCode::StaleTemplate="stale_template"
public const Nvl\Templates\Enums\TemplatesResponseCode TemplateResolutionFailed=Nvl\Templates\Enums\TemplatesResponseCode::TemplateResolutionFailed="template_resolution_failed"
public readonly string $name
public static function cases(): array
public readonly string $value
public static function from(string|int $value): static
public static function tryFrom(string|int $value): ?static
```

## Nvl\Templates\Events\TemplateChanged

```text
final class Nvl\Templates\Events\TemplateChanged implements Nvl\Support\Contracts\DomainEvent, Nvl\Support\Ownership\Contracts\OwnershipQueuedJob
public function __construct(string $templateId, string $operation, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor, int $schemaVersion=1): mixed
public function ownershipJobEnvelope(): Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope
public function schemaVersion(): int
public readonly Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor
public readonly string $operation
public readonly int $schemaVersion
public readonly string $templateId
```

## Nvl\Templates\Events\TemplateRendered

```text
final class Nvl\Templates\Events\TemplateRendered implements Nvl\Support\Contracts\DomainEvent, Nvl\Support\Ownership\Contracts\OwnershipQueuedJob
public function __construct(string $renderId, string $templateId, string $versionId, int $schemaVersion=1): mixed
public function ownershipJobEnvelope(): Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope
public function schemaVersion(): int
public readonly string $renderId
public readonly int $schemaVersion
public readonly string $templateId
public readonly string $versionId
```

## Nvl\Templates\Exceptions\StaleTemplateException

```text
final class Nvl\Templates\Exceptions\StaleTemplateException extends Nvl\Templates\Exceptions\TemplatesException
public static function forResource(string $resource, string $identifier): self
public function package(): string
public function publicContext(): array
@return array<string, mixed>
public function responseCode(): ?string
public function responseHeaders(): array
@return array<string, string>
public function suggestedStatus(): int
public function translationKey(): ?string
public function translationParameters(): array
@return array<string, (scalar | null)>
```

## Nvl\Templates\Exceptions\TemplateDependencyUnavailableException

```text
final class Nvl\Templates\Exceptions\TemplateDependencyUnavailableException extends Nvl\Templates\Exceptions\TemplatesException
public function package(): string
public function publicContext(): array
@return array<string, mixed>
public function responseCode(): ?string
public function responseHeaders(): array
@return array<string, string>
public function suggestedStatus(): int
public function translationKey(): ?string
public function translationParameters(): array
@return array<string, (scalar | null)>
```

## Nvl\Templates\Exceptions\TemplateResolutionException

```text
final class Nvl\Templates\Exceptions\TemplateResolutionException extends Nvl\Templates\Exceptions\TemplatesException
public function package(): string
public function publicContext(): array
@return array<string, mixed>
public function responseCode(): ?string
public function responseHeaders(): array
@return array<string, string>
public function suggestedStatus(): int
public function translationKey(): ?string
public function translationParameters(): array
@return array<string, (scalar | null)>
```

## Nvl\Templates\Exceptions\TemplatesException

```text
class Nvl\Templates\Exceptions\TemplatesException extends RuntimeException implements Nvl\Support\Contracts\RespondableException
public function package(): string
public function publicContext(): array
@return array<string, mixed>
public function responseCode(): ?string
public function responseHeaders(): array
@return array<string, string>
public function suggestedStatus(): int
public function translationKey(): ?string
public function translationParameters(): array
@return array<string, (scalar | null)>
```

## Nvl\Templates\Models\Template

```text
class Nvl\Templates\Models\Template extends Illuminate\Database\Eloquent\Model implements Nvl\Support\Ownership\Contracts\Ownable, Nvl\Translatable\Contracts\TranslatableModel
public static function allowsCentralCatalog(): bool
public function assignments(): Illuminate\Database\Eloquent\Relations\HasMany
@return HasMany<TemplateAssignment, $this>
resolved @return Illuminate\Database\Eloquent\Relations\HasMany<Nvl\Templates\Models\TemplateAssignment, $this>
public function delete(): ?bool
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getAllTranslations(): Illuminate\Database\Eloquent\Collection
@return Collection<int, Model>
resolved @return Illuminate\Database\Eloquent\Collection<int, Illuminate\Database\Eloquent\Model>
public function getAvailableLocales(): array
@return list<string>
public function getConnectionName(): ?string
public function getCurrentLocale(): string
public function getRelationValue(mixed $key): mixed
@param string $key
public function getTable(): string
public function getTranslatedAttributes(?string $locale=null): array
@return array<string, mixed>
public function getTranslation(?string $locale=null, bool $withFallback=true): ?Illuminate\Database\Eloquent\Model
public function hasTranslation(?string $locale=null): bool
public function isTranslatableAttribute(string $key): bool
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function resolveRouteBinding(mixed $value, mixed $field=null): ?Nvl\Templates\Models\Template
@param mixed $value
@param (string | null) $field
public function resolveTranslation(string $field, ?string $locale=null): Nvl\Translatable\TranslationResolution
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function scopeOrderByTranslated(Illuminate\Database\Eloquent\Builder $query, string $field, string $direction="asc", ?string $locale=null): Illuminate\Database\Eloquent\Builder
@param Builder<static> $query
resolved @param Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> $query
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template>
public function scopeWhereTranslated(Illuminate\Database\Eloquent\Builder $query, string $field, mixed $operator, mixed $value=\Nvl\Translatable\Enums\TranslationComparisonValue::Omitted, ?string $locale=null): Illuminate\Database\Eloquent\Builder
@param Builder<static> $query
resolved @param Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> $query
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template>
public function scopeWhereTranslationNotNull(Illuminate\Database\Eloquent\Builder $query, string $field, ?string $locale=null): Illuminate\Database\Eloquent\Builder
@param Builder<static> $query
resolved @param Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> $query
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template>
public function scopeWhereTranslationNull(Illuminate\Database\Eloquent\Builder $query, string $field, ?string $locale=null): Illuminate\Database\Eloquent\Builder
@param Builder<static> $query
resolved @param Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> $query
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template>
public function scopeWithAllTranslations(Illuminate\Database\Eloquent\Builder $query): Illuminate\Database\Eloquent\Builder
@param Builder<static> $query
resolved @param Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> $query
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template>
public function scopeWithResolvedTranslations(Illuminate\Database\Eloquent\Builder $query, ?string $locale=null): Illuminate\Database\Eloquent\Builder
@param Builder<static> $query
resolved @param Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> $query
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template>
public function setLocale(string $locale): self
public function translated(string $field, ?string $locale=null): mixed
public function translation(?string $locale=null): Illuminate\Database\Eloquent\Relations\HasOne
@return HasOne<Model, $this>
resolved @return Illuminate\Database\Eloquent\Relations\HasOne<Illuminate\Database\Eloquent\Model, $this>
public function translationDefinition(): Nvl\Translatable\RelatedTranslationDefinition
public function translationResourceKey(): int|string
public function translations(): Illuminate\Database\Eloquent\Relations\HasMany
@return HasMany<Model, $this>
resolved @return Illuminate\Database\Eloquent\Relations\HasMany<Illuminate\Database\Eloquent\Model, $this>
public function versions(): Illuminate\Database\Eloquent\Relations\HasMany
@return HasMany<TemplateVersion, $this>
resolved @return Illuminate\Database\Eloquent\Relations\HasMany<Nvl\Templates\Models\TemplateVersion, $this>
@method static Builder<static> orderByTranslated(string $field, string $direction = 'asc', ?string $locale = null)
resolved @method static Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> orderByTranslated(string $field, string $direction = 'asc', ?string $locale = null)
@method static Builder<static> whereTranslated(string $field, mixed $operator, mixed $value = TranslationComparisonValue::Omitted, ?string $locale = null)
resolved @method static Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> whereTranslated(string $field, mixed $operator, mixed $value = Nvl\Translatable\Enums\TranslationComparisonValue::Omitted, ?string $locale = null)
@method static Builder<static> whereTranslationNotNull(string $field, ?string $locale = null)
resolved @method static Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> whereTranslationNotNull(string $field, ?string $locale = null)
@method static Builder<static> whereTranslationNull(string $field, ?string $locale = null)
resolved @method static Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> whereTranslationNull(string $field, ?string $locale = null)
@method static Builder<static> withAllTranslations()
resolved @method static Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> withAllTranslations()
@method static Builder<static> withResolvedTranslations(?string $locale = null)
resolved @method static Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template> withResolvedTranslations(?string $locale = null)
@property-read Collection<int, TemplateAssignment> $assignments
resolved @property-read Illuminate\Database\Eloquent\Collection<int, Nvl\Templates\Models\TemplateAssignment> $assignments
@property string $id
@property string $key
@property (array<string, mixed> | null) $metadata
@property (string | null) $owner_scope_key
@property string $renderer
@property int $revision
@property (array<string, mixed> | null) $schema
@property TemplateStatus $status
resolved @property Nvl\Templates\Enums\TemplateStatus $status
@property-read Collection<int, TemplateTranslation> $translations
resolved @property-read Illuminate\Database\Eloquent\Collection<int, Nvl\Templates\Models\TemplateTranslation> $translations
@property-read Collection<int, TemplateVersion> $versions
resolved @property-read Illuminate\Database\Eloquent\Collection<int, Nvl\Templates\Models\TemplateVersion> $versions
```

## Nvl\Templates\Models\TemplateAssignment

```text
final class Nvl\Templates\Models\TemplateAssignment extends Illuminate\Database\Eloquent\Model implements Nvl\Support\Ownership\Contracts\Ownable
public function delete(): ?bool
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateAssignment>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function template(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<Template, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\Template, $this>
public function version(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<TemplateVersion, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\TemplateVersion, $this>
@property string $id
@property string $owner_id
@property string $owner_type
@property string $profile
@property int $revision
@property (array<string, mixed> | null) $settings
@property string $template_id
@property (string | null) $template_version_id
```

## Nvl\Templates\Models\TemplateOwnerGrant

```text
final class Nvl\Templates\Models\TemplateOwnerGrant extends Illuminate\Database\Eloquent\Model implements Nvl\Support\Ownership\Contracts\Ownable
public function delete(): ?bool
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateOwnerGrant>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function version(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<TemplateVersion, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\TemplateVersion, $this>
@property (Carbon | null) $created_at
resolved @property (Illuminate\Support\Carbon | null) $created_at
@property string $id
@property string $owner_reference
@property string $owner_scope_key
@property int $revision
@property (Carbon | null) $revoked_at
resolved @property (Illuminate\Support\Carbon | null) $revoked_at
@property int $source_revision
@property string $template_version_id
@property (Carbon | null) $updated_at
resolved @property (Illuminate\Support\Carbon | null) $updated_at
@property-read TemplateVersion $version
resolved @property-read Nvl\Templates\Models\TemplateVersion $version
```

## Nvl\Templates\Models\TemplateRender

```text
final class Nvl\Templates\Models\TemplateRender extends Illuminate\Database\Eloquent\Model implements Nvl\Support\Ownership\Contracts\Ownable
public function assignment(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<TemplateAssignment, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\TemplateAssignment, $this>
public function delete(): ?bool
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateRender>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function template(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<Template, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\Template, $this>
public function version(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<TemplateVersion, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\TemplateVersion, $this>
@property-read (TemplateAssignment | null) $assignment
resolved @property-read (Nvl\Templates\Models\TemplateAssignment | null) $assignment
@property int $attempts
@property (Carbon | null) $completed_at
resolved @property (Illuminate\Support\Carbon | null) $completed_at
@property (Carbon | null) $created_at
resolved @property (Illuminate\Support\Carbon | null) $created_at
@property int $dispatch_generation
@property (Carbon | null) $failed_at
resolved @property (Illuminate\Support\Carbon | null) $failed_at
@property (string | null) $failure
@property string $id
@property (string | null) $idempotency_key
@property (Carbon | null) $lease_expires_at
resolved @property (Illuminate\Support\Carbon | null) $lease_expires_at
@property string $locale
@property (string | null) $output_mime_type
@property (string | null) $output_name
@property (array<string, mixed> | null) $payload
@property string $payload_digest
@property (string | null) $processing_token
@property string $profile
@property (string | null) $requested_by
@property (string | null) $requested_by_type
@property (array<string, mixed> | null) $settings
@property (Carbon | null) $started_at
resolved @property (Illuminate\Support\Carbon | null) $started_at
@property TemplateRenderStatus $status
resolved @property Nvl\Templates\Enums\TemplateRenderStatus $status
@property-read Template $template
resolved @property-read Nvl\Templates\Models\Template $template
@property (string | null) $template_assignment_id
@property string $template_id
@property string $template_version_id
@property (Carbon | null) $updated_at
resolved @property (Illuminate\Support\Carbon | null) $updated_at
@property-read TemplateVersion $version
resolved @property-read Nvl\Templates\Models\TemplateVersion $version
```

## Nvl\Templates\Models\TemplateTranslation

```text
final class Nvl\Templates\Models\TemplateTranslation extends Illuminate\Database\Eloquent\Model implements Nvl\Support\Ownership\Contracts\Ownable
public function delete(): ?bool
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateTranslation>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function template(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<Template, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\Template, $this>
@property (string | null) $description
@property string $id
@property string $locale
@property-read Template $template
resolved @property-read Nvl\Templates\Models\Template $template
@property string $template_id
@property string $title
```

## Nvl\Templates\Models\TemplateVersion

```text
final class Nvl\Templates\Models\TemplateVersion extends Illuminate\Database\Eloquent\Model implements Nvl\Support\Ownership\Contracts\Ownable
public const string CONTENT_GROUP="document"
public const string CONTENT_OWNER_TYPE="nvl-template-version"
public function contentGroups(): array
@return list<string>
public function contentPlacements(): Illuminate\Database\Eloquent\Relations\MorphMany
@return MorphMany<ContentPlacement, $this>
resolved @return Illuminate\Database\Eloquent\Relations\MorphMany<Nvl\Content\Models\ContentPlacement, $this>
public function delete(): ?bool
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateVersion>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function scopePublished(Illuminate\Database\Eloquent\Builder $query): void
@param Builder<static> $query
resolved @param Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateVersion> $query
public function template(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<Template, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\Template, $this>
@property (string | null) $catalog_grant_id
@property (string | null) $catalog_import_key
@property (string | null) $catalog_source_hash
@property (int | null) $catalog_source_revision
@property (string | null) $catalog_source_version_id
@property (string | null) $content_hash
@property (array{ownerType: string, ownerId: string, group: string, blocks: list<array{placementId: string, parentId: (string | null), key: string, region: string, sortOrder: int, blockId: string, definitionKey: string, definitionSchema: array<string, mixed>, definitionView: (string | null), visibility: string, values: array<string, mixed>, translations: array<string, array<string, mixed>>, overrides: array<string, mixed>, blockRevision: int, placementRevision: int}>, version: string, tenantId: (string | null), formatVersion: int, ownershipContext: (array<string, mixed> | null)} | null) $content_snapshot
@property string $id
@property (array<string, mixed> | null) $metadata
@property (string | null) $owner_scope_key
@property (Carbon | null) $published_at
resolved @property (Illuminate\Support\Carbon | null) $published_at
@property (string | null) $published_by
@property (string | null) $published_by_type
@property int $revision
@property TemplateVersionStatus $status
resolved @property Nvl\Templates\Enums\TemplateVersionStatus $status
@property-read Template $template
resolved @property-read Nvl\Templates\Models\Template $template
@property string $template_id
@property int $version
```

## Nvl\Templates\Ownership\TemplateOwnerCatalog

```text
final readonly class Nvl\Templates\Ownership\TemplateOwnerCatalog
public function __construct(Nvl\Templates\Ownership\TemplateCatalogSource $sources, Nvl\Templates\Contracts\TemplateCatalogAccess $access, Nvl\Templates\Services\TemplateDefinitionRegistry $definitions, Nvl\Templates\Services\CanonicalJson $json, Nvl\Content\Services\ContentReader $content, Nvl\Media\Contracts\MediaCatalogImport $media, Nvl\Content\Contracts\ContentStorage $storage): mixed
public function grant(string $sourceId, int $revision): Nvl\Templates\Models\TemplateOwnerGrant
public function import(array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateVersion
@param array{grantId: string, expectedGrantRevision: int, expectedSourceRevision: int, targetKey: string, idempotency_key: string, mediaGrantIds: array<string, string>} $data
public function revoke(string $grantId, int $revision): Nvl\Templates\Models\TemplateOwnerGrant
```

## Nvl\Templates\Rendering\TemplateRenderContext

```text
final readonly class Nvl\Templates\Rendering\TemplateRenderContext
public function __construct(Nvl\Templates\Template $template, string $view, string $renderer, string $locale, ?string $subject, ?string $filename, ?array $pdf, array $rendererOptions): mixed
@param array<string, mixed> $rendererOptions
@param (array{pageSize?: (PdfPageSize | null), orientation?: (PdfOrientation | null), margins?: (array{left?: (float | null), right?: (float | null), top?: (float | null), bottom?: (float | null), header?: (float | null), footer?: (float | null)} | null), defaultFont?: (string | null), defaultFontSize?: (float | null), dpi?: (int | null), imageDpi?: (int | null), imageQuality?: (int | null), showImageErrors?: (bool | null), temporaryDirectory?: (string | null), title?: (string | null), author?: (string | null), creator?: (string | null), subject?: (string | null), keywords?: (string | null), headerView?: (string | null), headerHtml?: (string | null), headerData?: array<string, mixed>, footerView?: (string | null), footerHtml?: (string | null), footerData?: array<string, mixed>, watermark?: (string | null), watermarkOpacity?: (float | null), compress?: (bool | null), pdfa?: (bool | null), pdfaAuto?: (bool | null), protectionPermissions?: list<string>, userPassword?: (string | null), ownerPassword?: (string | null)} | null) $pdf
resolved @param (array{pageSize?: (Nvl\Templates\Enums\PdfPageSize | null), orientation?: (Nvl\Templates\Enums\PdfOrientation | null), margins?: (array{left?: (float | null), right?: (float | null), top?: (float | null), bottom?: (float | null), header?: (float | null), footer?: (float | null)} | null), defaultFont?: (string | null), defaultFontSize?: (float | null), dpi?: (int | null), imageDpi?: (int | null), imageQuality?: (int | null), showImageErrors?: (bool | null), temporaryDirectory?: (string | null), title?: (string | null), author?: (string | null), creator?: (string | null), subject?: (string | null), keywords?: (string | null), headerView?: (string | null), headerHtml?: (string | null), headerData?: array<string, mixed>, footerView?: (string | null), footerHtml?: (string | null), footerData?: array<string, mixed>, watermark?: (string | null), watermarkOpacity?: (float | null), compress?: (bool | null), pdfa?: (bool | null), pdfaAuto?: (bool | null), protectionPermissions?: list<string>, userPassword?: (string | null), ownerPassword?: (string | null)} | null) $pdf
public function blocks(): array
@return list<array<string, mixed>>
public function composition(): ?array
@return (array{blocks: list<array<string, mixed>>, regions: array<string, list<array<string, mixed>>>, locale: string, ...} | null)
public function data(): array
@return array<string, mixed>
public function regions(): array
@return array<string, list<array<string, mixed>>>
public function settings(): array
@return array<string, mixed>
public function viewData(): array
@return array{template: Template, options: self, composition: (array<string, mixed> | null), blocks: list<array<string, mixed>>, regions: array<string, list<array<string, mixed>>>, data: array<string, mixed>, settings: array<string, mixed>}
resolved @return array{template: Nvl\Templates\Template, options: Nvl\Templates\Rendering\TemplateRenderContext, composition: (array<string, mixed> | null), blocks: list<array<string, mixed>>, regions: array<string, list<array<string, mixed>>>, data: array<string, mixed>, settings: array<string, mixed>}
public readonly ?string $filename
public readonly string $locale
public readonly ?array $pdf
@param (array{pageSize?: (PdfPageSize | null), orientation?: (PdfOrientation | null), margins?: (array{left?: (float | null), right?: (float | null), top?: (float | null), bottom?: (float | null), header?: (float | null), footer?: (float | null)} | null), defaultFont?: (string | null), defaultFontSize?: (float | null), dpi?: (int | null), imageDpi?: (int | null), imageQuality?: (int | null), showImageErrors?: (bool | null), temporaryDirectory?: (string | null), title?: (string | null), author?: (string | null), creator?: (string | null), subject?: (string | null), keywords?: (string | null), headerView?: (string | null), headerHtml?: (string | null), headerData?: array<string, mixed>, footerView?: (string | null), footerHtml?: (string | null), footerData?: array<string, mixed>, watermark?: (string | null), watermarkOpacity?: (float | null), compress?: (bool | null), pdfa?: (bool | null), pdfaAuto?: (bool | null), protectionPermissions?: list<string>, userPassword?: (string | null), ownerPassword?: (string | null)} | null) $pdf
resolved @param (array{pageSize?: (Nvl\Templates\Enums\PdfPageSize | null), orientation?: (Nvl\Templates\Enums\PdfOrientation | null), margins?: (array{left?: (float | null), right?: (float | null), top?: (float | null), bottom?: (float | null), header?: (float | null), footer?: (float | null)} | null), defaultFont?: (string | null), defaultFontSize?: (float | null), dpi?: (int | null), imageDpi?: (int | null), imageQuality?: (int | null), showImageErrors?: (bool | null), temporaryDirectory?: (string | null), title?: (string | null), author?: (string | null), creator?: (string | null), subject?: (string | null), keywords?: (string | null), headerView?: (string | null), headerHtml?: (string | null), headerData?: array<string, mixed>, footerView?: (string | null), footerHtml?: (string | null), footerData?: array<string, mixed>, watermark?: (string | null), watermarkOpacity?: (float | null), compress?: (bool | null), pdfa?: (bool | null), pdfaAuto?: (bool | null), protectionPermissions?: list<string>, userPassword?: (string | null), ownerPassword?: (string | null)} | null) $pdf
public readonly string $renderer
public readonly array $rendererOptions
@param array<string, mixed> $rendererOptions
public readonly ?string $subject
public readonly Nvl\Templates\Template $template
public readonly string $view
```

## Nvl\Templates\Services\TemplateAssignments

```text
final readonly class Nvl\Templates\Services\TemplateAssignments
public function __construct(Nvl\Templates\Contracts\TemplateAuthorization $authorization, Nvl\Templates\Services\TemplateOwnerRegistry $owners, Nvl\Templates\Services\TemplateDefinitionRegistry $definitions, Nvl\Templates\Services\TemplateContentGuard $guard, Nvl\Templates\Services\TemplateVersionResolver $versions, Nvl\Support\Ownership\Contracts\OwnershipBoundary $boundary, Nvl\Support\Events\DomainEventDispatcher $domainEvents): mixed
public function assign(Nvl\Templates\Models\Template|string $template, array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateAssignment
@param array<string, mixed> $data
public function unassign(Nvl\Templates\Models\TemplateAssignment|string $assignment, int $expectedRevision, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): bool
```

## Nvl\Templates\Services\TemplateDefinitionRegistry

```text
final class Nvl\Templates\Services\TemplateDefinitionRegistry
public function __construct(Nvl\Templates\Services\TemplateContentGuard $guard, Nvl\Templates\Contracts\TemplatePayloadValidator $payloadValidator, Nvl\Templates\Services\StoredTemplateOptionsFactory $optionsFactory, Nvl\Templates\Services\TemplateRendererRegistry $renderers): mixed
public function all(): array
@return array<string, array{key: string, renderer: string, view: string, profiles: list<string>, schema: array<string, mixed>, rendererOptions: array<string, mixed>, subjectPath: (string | null), requiredRegions: list<string>, allowedContentDefinitions: list<string>}>
public function get(string $key): array
@return array{key: string, renderer: string, view: string, profiles: list<string>, schema: array<string, mixed>, rendererOptions: array<string, mixed>, subjectPath: (string | null), requiredRegions: list<string>, allowedContentDefinitions: list<string>}
public function register(array $definition): void
@param array{key: string, renderer: string, view: string, profiles?: list<string>, schema?: array<string, mixed>, rendererOptions?: array<string, mixed>, subjectPath?: (string | null), requiredRegions?: list<string>, allowedContentDefinitions?: list<string>} $definition
```

## Nvl\Templates\Services\TemplateDefinitions

```text
final readonly class Nvl\Templates\Services\TemplateDefinitions
public function __construct(Nvl\Templates\Services\TemplateDefinitionRegistry $definitions, Nvl\Templates\Contracts\TemplateAuthorization $authorization): mixed
public function sync(Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor, bool $dryRun=false): Illuminate\Support\Collection
@return Collection<int, array{key: string, operation: string}>
resolved @return Illuminate\Support\Collection<int, array{key: string, operation: string}>
```

## Nvl\Templates\Services\TemplateImporter

```text
final readonly class Nvl\Templates\Services\TemplateImporter
public function __construct(Nvl\Templates\Services\TemplateLifecycle $templates, Nvl\Templates\Services\TemplateAdoptionManifest $manifests, Nvl\Templates\Services\TemplateAdoptionSchema $schemas, Nvl\Templates\Services\MediaTemplateAssetRegistry $assets): mixed
public function adopt(array $manifest, bool $prepare=false, bool $apply=false): array
@param array<array-key, mixed> $manifest
@return array<string, mixed>
```

## Nvl\Templates\Services\TemplateLifecycle

```text
final readonly class Nvl\Templates\Services\TemplateLifecycle
public function __construct(Nvl\Templates\Contracts\TemplateAuthorization $authorization, Nvl\Templates\Services\TemplateDefinitionRegistry $definitions, Nvl\Templates\Services\TemplateContentGuard $guard, Nvl\Translatable\Services\RelatedTranslationStore $translations, Nvl\Support\Ownership\Contracts\OwnershipBoundary $boundary, Nvl\Support\Events\DomainEventDispatcher $domainEvents): mixed
public function create(array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\Template
@param array<string, mixed> $data
public function createVersion(Nvl\Templates\Models\Template|string $template, array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateVersion
@param array<string, mixed> $data
public function delete(Nvl\Templates\Models\Template|string $template, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): void
public function publishVersion(Nvl\Templates\Models\TemplateVersion|string $version, int $expectedRevision, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateVersion
public function update(Nvl\Templates\Models\Template|string $template, array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor, Nvl\Translatable\Enums\TranslationSyncMode $translationMode=\Nvl\Translatable\Enums\TranslationSyncMode::Replace): Nvl\Templates\Models\Template
@param array{status: (TemplateStatus | string), expected_revision: (int | string), metadata?: array<string, mixed>, translations?: array<string, array{title: string, description?: (string | null)}>} $data
resolved @param array{status: (Nvl\Templates\Enums\TemplateStatus | string), expected_revision: (int | string), metadata?: array<string, mixed>, translations?: array<string, array{title: string, description?: (string | null)}>} $data
public function updateVersion(Nvl\Templates\Models\TemplateVersion|string $version, array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateVersion
@param array{expected_revision: (int | string), metadata?: array<string, mixed>} $data
```

## Nvl\Templates\Services\TemplateModelRegistry

```text
final class Nvl\Templates\Services\TemplateModelRegistry
public function __construct(Illuminate\Contracts\Config\Repository $configuration, Nvl\Support\OwnerRegistry $identities): mixed
public static function projectionColumns(array $columns): array
@param list<string> $columns
@return list<string>
public function templateClass(): string
@return class-string<Template>
resolved @return class-string<Nvl\Templates\Models\Template>
```

## Nvl\Templates\Services\TemplateOwnerRegistry

```text
final class Nvl\Templates\Services\TemplateOwnerRegistry
public function __construct(Illuminate\Contracts\Container\Container $container, Nvl\Support\Ownership\Contracts\OwnershipBoundary $boundary, Nvl\Support\OwnerRegistry $identities): mixed
public function aliases(): array
@return list<string>
public function has(string $alias): bool
public function register(string $alias, string $resolver, ?string $owner=null): void
public function resolve(string $alias, string $identifier): Illuminate\Database\Eloquent\Model
```

## Nvl\Templates\Services\TemplateReader

```text
final readonly class Nvl\Templates\Services\TemplateReader
public function __construct(Nvl\Templates\Contracts\TemplateAuthorization $authorization, Nvl\Support\Ownership\Contracts\OwnershipBoundary $boundary): mixed
public function get(Nvl\Templates\Models\Template|string $template, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\Template
public function getRender(Nvl\Templates\Models\TemplateRender|string $render, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateRender
public function paginate(array $criteria, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor, ?int $perPage=null): Illuminate\Contracts\Pagination\LengthAwarePaginator
@param array<string, mixed> $criteria
@return LengthAwarePaginator<int, Template>
resolved @return Illuminate\Contracts\Pagination\LengthAwarePaginator<int, Nvl\Templates\Models\Template>
public function renders(array $criteria, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor, ?int $perPage=null): Illuminate\Contracts\Pagination\LengthAwarePaginator
@param array<string, mixed> $criteria
@return LengthAwarePaginator<int, TemplateRender>
resolved @return Illuminate\Contracts\Pagination\LengthAwarePaginator<int, Nvl\Templates\Models\TemplateRender>
```

## Nvl\Templates\Services\TemplateRenderer

```text
final readonly class Nvl\Templates\Services\TemplateRenderer
public function __construct(Nvl\Templates\Services\TemplateContextFactory $contexts, Nvl\Templates\Services\TemplateRendererRegistry $renderers, Nvl\Templates\Services\TemplateOutputGuard $outputGuard, Nvl\Templates\Contracts\TemplateAuthorization $authorization, Nvl\Templates\Services\StoredTemplateRenderResolver $resolver, Nvl\Support\Ownership\Contracts\OwnershipBoundary $boundary, Nvl\Templates\Services\CanonicalJson $canonicalJson, Nvl\Templates\Services\TemplateRenderDispatcher $dispatcher, Nvl\Support\Events\DomainEventDispatcher $domainEvents): mixed
public function process(Nvl\Templates\Models\TemplateRender|string $render, ?string $processingToken=null, ?int $dispatchGeneration=null): Nvl\Templates\Models\TemplateRender
public function queue(Nvl\Templates\Models\Template|string $template, array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateRender
@param array<string, mixed> $data
public function recover(Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Illuminate\Database\Eloquent\Collection
@return Collection<int, TemplateRender>
resolved @return Illuminate\Database\Eloquent\Collection<int, Nvl\Templates\Models\TemplateRender>
public function render(Nvl\Templates\Template|Nvl\Templates\Models\Template|string $template, array $context, array $options, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@param array<string, mixed> $context
@param array<string, mixed> $options
@return array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: (string | null), suggested_filename: (string | null)}
```

## Nvl\Templates\Services\TemplateRendererRegistry

```text
final class Nvl\Templates\Services\TemplateRendererRegistry
public function __construct(Illuminate\Contracts\Container\Container $container): mixed
public function all(): array
@return array<string, class-string<TemplateRenderer>>
resolved @return array<string, class-string<Nvl\Templates\Contracts\TemplateRenderer>>
public function get(string $alias): Nvl\Templates\Contracts\TemplateRenderer
public function has(string $alias): bool
public function register(string $alias, string $renderer): void
@param class-string $renderer
```

## Nvl\Templates\Template

```text
class Nvl\Templates\Template
public function __construct(string $key, string $view="", array $data=[], ?array $options=null, ?array $composition=null, array $schema=[], array $settings=[]): mixed
@param array<string, mixed> $data
@param array<string, mixed> $schema
@param array<string, mixed> $settings
@param (array{renderer?: (string | null), locale?: (string | null), subject?: (string | null), filename?: (string | null), pdf?: (array{pageSize?: (PdfPageSize | null), orientation?: (PdfOrientation | null), margins?: (array{left?: (float | null), right?: (float | null), top?: (float | null), bottom?: (float | null), header?: (float | null), footer?: (float | null)} | null), defaultFont?: (string | null), defaultFontSize?: (float | null), dpi?: (int | null), imageDpi?: (int | null), imageQuality?: (int | null), showImageErrors?: (bool | null), temporaryDirectory?: (string | null), title?: (string | null), author?: (string | null), creator?: (string | null), subject?: (string | null), keywords?: (string | null), headerView?: (string | null), headerHtml?: (string | null), headerData?: array<string, mixed>, footerView?: (string | null), footerHtml?: (string | null), footerData?: array<string, mixed>, watermark?: (string | null), watermarkOpacity?: (float | null), compress?: (bool | null), pdfa?: (bool | null), pdfaAuto?: (bool | null), protectionPermissions?: list<string>, userPassword?: (string | null), ownerPassword?: (string | null)} | null), rendererOptions?: array<string, mixed>} | null) $options
resolved @param (array{renderer?: (string | null), locale?: (string | null), subject?: (string | null), filename?: (string | null), pdf?: (array{pageSize?: (Nvl\Templates\Enums\PdfPageSize | null), orientation?: (Nvl\Templates\Enums\PdfOrientation | null), margins?: (array{left?: (float | null), right?: (float | null), top?: (float | null), bottom?: (float | null), header?: (float | null), footer?: (float | null)} | null), defaultFont?: (string | null), defaultFontSize?: (float | null), dpi?: (int | null), imageDpi?: (int | null), imageQuality?: (int | null), showImageErrors?: (bool | null), temporaryDirectory?: (string | null), title?: (string | null), author?: (string | null), creator?: (string | null), subject?: (string | null), keywords?: (string | null), headerView?: (string | null), headerHtml?: (string | null), headerData?: array<string, mixed>, footerView?: (string | null), footerHtml?: (string | null), footerData?: array<string, mixed>, watermark?: (string | null), watermarkOpacity?: (float | null), compress?: (bool | null), pdfa?: (bool | null), pdfaAuto?: (bool | null), protectionPermissions?: list<string>, userPassword?: (string | null), ownerPassword?: (string | null)} | null), rendererOptions?: array<string, mixed>} | null) $options
@param (array{blocks: list<array<string, mixed>>, regions: array<string, list<array<string, mixed>>>, locale: string, ...} | null) $composition
public readonly ?array $composition
@param (array{blocks: list<array<string, mixed>>, regions: array<string, list<array<string, mixed>>>, locale: string, ...} | null) $composition
public readonly array $data
@param array<string, mixed> $data
public readonly string $key
public readonly ?array $options
@param (array{renderer?: (string | null), locale?: (string | null), subject?: (string | null), filename?: (string | null), pdf?: (array{pageSize?: (PdfPageSize | null), orientation?: (PdfOrientation | null), margins?: (array{left?: (float | null), right?: (float | null), top?: (float | null), bottom?: (float | null), header?: (float | null), footer?: (float | null)} | null), defaultFont?: (string | null), defaultFontSize?: (float | null), dpi?: (int | null), imageDpi?: (int | null), imageQuality?: (int | null), showImageErrors?: (bool | null), temporaryDirectory?: (string | null), title?: (string | null), author?: (string | null), creator?: (string | null), subject?: (string | null), keywords?: (string | null), headerView?: (string | null), headerHtml?: (string | null), headerData?: array<string, mixed>, footerView?: (string | null), footerHtml?: (string | null), footerData?: array<string, mixed>, watermark?: (string | null), watermarkOpacity?: (float | null), compress?: (bool | null), pdfa?: (bool | null), pdfaAuto?: (bool | null), protectionPermissions?: list<string>, userPassword?: (string | null), ownerPassword?: (string | null)} | null), rendererOptions?: array<string, mixed>} | null) $options
resolved @param (array{renderer?: (string | null), locale?: (string | null), subject?: (string | null), filename?: (string | null), pdf?: (array{pageSize?: (Nvl\Templates\Enums\PdfPageSize | null), orientation?: (Nvl\Templates\Enums\PdfOrientation | null), margins?: (array{left?: (float | null), right?: (float | null), top?: (float | null), bottom?: (float | null), header?: (float | null), footer?: (float | null)} | null), defaultFont?: (string | null), defaultFontSize?: (float | null), dpi?: (int | null), imageDpi?: (int | null), imageQuality?: (int | null), showImageErrors?: (bool | null), temporaryDirectory?: (string | null), title?: (string | null), author?: (string | null), creator?: (string | null), subject?: (string | null), keywords?: (string | null), headerView?: (string | null), headerHtml?: (string | null), headerData?: array<string, mixed>, footerView?: (string | null), footerHtml?: (string | null), footerData?: array<string, mixed>, watermark?: (string | null), watermarkOpacity?: (float | null), compress?: (bool | null), pdfa?: (bool | null), pdfaAuto?: (bool | null), protectionPermissions?: list<string>, userPassword?: (string | null), ownerPassword?: (string | null)} | null), rendererOptions?: array<string, mixed>} | null) $options
public readonly array $schema
@param array<string, mixed> $schema
public readonly array $settings
@param array<string, mixed> $settings
public readonly string $view
```
