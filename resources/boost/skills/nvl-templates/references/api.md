# Public API: nvl/templates

Generated from the package public contract. Use this reference to confirm fully qualified names, parameter order, defaults, native array shapes and return types. Read [usage](usage.md) for policy and operation semantics; declarations alone never grant authority.

Search for the relevant fully qualified service or contract and read only its matching symbol sections; this is a lookup catalog, not an instruction to load every declaration. `resolved` annotations expand imported aliases and domain type shapes. Framework inheritance and host-authored extensions remain outside this package contract.

## Symbols

- `Nvl\Templates\Contracts\ContextProvider`
- `Nvl\Templates\Contracts\DnsResolver`
- `Nvl\Templates\Contracts\DocumentCompiler`
- `Nvl\Templates\Contracts\PdfDriver`
- `Nvl\Templates\Contracts\RenderExecutionContext`
- `Nvl\Templates\Contracts\TemplateAuthorization`
- `Nvl\Templates\Database\Factories\TemplateFactory`
- `Nvl\Templates\Drivers\Compiler\LocalNodeCompiler`
- `Nvl\Templates\Drivers\Pdf\ChromiumPdfDriver`
- `Nvl\Templates\Emails\RenderedTemplateMail`
- `Nvl\Templates\Enums\TemplateAbility`
- `Nvl\Templates\Exceptions\DraftConflict`
- `Nvl\Templates\Exceptions\RenderConflict`
- `Nvl\Templates\Exceptions\RenderUnavailable`
- `Nvl\Templates\Exceptions\RetryableRenderException`
- `Nvl\Templates\Models\FamilyChange`
- `Nvl\Templates\Models\Template`
- `Nvl\Templates\Models\TemplateAsset`
- `Nvl\Templates\Models\TemplateDraft`
- `Nvl\Templates\Models\TemplateGroup`
- `Nvl\Templates\Models\TemplateGroupRevision`
- `Nvl\Templates\Models\TemplateRender`
- `Nvl\Templates\Models\TemplateResource`
- `Nvl\Templates\Models\TemplateResourceRevision`
- `Nvl\Templates\Models\TemplateRevision`
- `Nvl\Templates\Rendering\RenderedDocument`
- `Nvl\Templates\Services\FamilyLifecycle`
- `Nvl\Templates\Services\RenderRequests`
- `Nvl\Templates\Services\ResourceManager`
- `Nvl\Templates\Services\TemplateAssets`
- `Nvl\Templates\Services\TemplateCatalog`
- `Nvl\Templates\Services\TemplateFamilies`
- `Nvl\Templates\Services\TemplateLifecycle`
- `Nvl\Templates\Services\TemplateModelRegistry`
- `Nvl\Templates\Services\TemplateReader`
- `Nvl\Templates\Services\TemplateRenderer`
- `Nvl\Templates\Support\Capabilities`
- `Nvl\Templates\ValueObjects\PdfOutput`

## Nvl\Templates\Contracts\ContextProvider

```text
interface Nvl\Templates\Contracts\ContextProvider
public abstract function resolve(Nvl\Templates\Models\TemplateRevision $release, array $owner, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@param array<array-key, mixed> $owner
@return array{facts?: array<array-key, mixed>, context?: array<array-key, mixed>}
```

## Nvl\Templates\Contracts\DnsResolver

```text
interface Nvl\Templates\Contracts\DnsResolver
public abstract function addresses(string $host): array
@return list<string>
```

## Nvl\Templates\Contracts\DocumentCompiler

```text
interface Nvl\Templates\Contracts\DocumentCompiler
public abstract function compile(array $document, array $data, array $assets=[]): array
@param array<array-key, mixed> $document
@param array<array-key, mixed> $data
@param array<array-key, string> $assets
@return array{html: string, css: string, subject?: (string | null), text?: (string | null)}
```

## Nvl\Templates\Contracts\PdfDriver

```text
interface Nvl\Templates\Contracts\PdfDriver
public abstract function identity(): string
public abstract function render(Nvl\Templates\Rendering\RenderedDocument $result, array $document, array $options=[]): Nvl\Templates\ValueObjects\PdfOutput
@param array<array-key, mixed> $document
@param array<array-key, mixed> $options
```

## Nvl\Templates\Contracts\RenderExecutionContext

```text
interface Nvl\Templates\Contracts\RenderExecutionContext
public abstract function capture(): array
@return array<array-key, mixed>
public abstract function run(array $context, Closure $operation): mixed
@template T
@param array<array-key, mixed> $context
@param Closure(): T $operation
@return T
template Nvl\Templates\Contracts\RenderExecutionContext::T
```

## Nvl\Templates\Contracts\TemplateAuthorization

```text
interface Nvl\Templates\Contracts\TemplateAuthorization
public abstract function authorize(Nvl\Templates\Enums\TemplateAbility $ability, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor, array $context=[]): void
@param array<string, mixed> $context
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

## Nvl\Templates\Drivers\Compiler\LocalNodeCompiler

```text
final class Nvl\Templates\Drivers\Compiler\LocalNodeCompiler implements Nvl\Templates\Contracts\DocumentCompiler
public function compile(array $document, array $data, array $assets=[]): array
```

## Nvl\Templates\Drivers\Pdf\ChromiumPdfDriver

```text
final class Nvl\Templates\Drivers\Pdf\ChromiumPdfDriver implements Nvl\Templates\Contracts\PdfDriver
public function identity(): string
public function render(Nvl\Templates\Rendering\RenderedDocument $result, array $document, array $options=[]): Nvl\Templates\ValueObjects\PdfOutput
```

## Nvl\Templates\Emails\RenderedTemplateMail

```text
final class Nvl\Templates\Emails\RenderedTemplateMail extends Illuminate\Mail\Mailable
public function __construct(array $rendered): mixed
@param array<array-key, mixed> $rendered
```

## Nvl\Templates\Enums\TemplateAbility

```text
enum Nvl\Templates\Enums\TemplateAbility implements BackedEnum, UnitEnum: string
public const Nvl\Templates\Enums\TemplateAbility Assign=Nvl\Templates\Enums\TemplateAbility::Assign="assign"
public const Nvl\Templates\Enums\TemplateAbility Copy=Nvl\Templates\Enums\TemplateAbility::Copy="copy"
public const Nvl\Templates\Enums\TemplateAbility Create=Nvl\Templates\Enums\TemplateAbility::Create="create"
public const Nvl\Templates\Enums\TemplateAbility Delete=Nvl\Templates\Enums\TemplateAbility::Delete="delete"
public const Nvl\Templates\Enums\TemplateAbility List=Nvl\Templates\Enums\TemplateAbility::List="list"
public const Nvl\Templates\Enums\TemplateAbility Manage=Nvl\Templates\Enums\TemplateAbility::Manage="manage"
public const Nvl\Templates\Enums\TemplateAbility Publish=Nvl\Templates\Enums\TemplateAbility::Publish="publish"
public const Nvl\Templates\Enums\TemplateAbility Read=Nvl\Templates\Enums\TemplateAbility::Read="read"
public const Nvl\Templates\Enums\TemplateAbility Render=Nvl\Templates\Enums\TemplateAbility::Render="render"
public const Nvl\Templates\Enums\TemplateAbility Update=Nvl\Templates\Enums\TemplateAbility::Update="update"
public const Nvl\Templates\Enums\TemplateAbility View=Nvl\Templates\Enums\TemplateAbility::View="view"
public readonly string $name
public static function cases(): array
public readonly string $value
public static function from(string|int $value): static
public static function tryFrom(string|int $value): ?static
```

## Nvl\Templates\Exceptions\DraftConflict

```text
final class Nvl\Templates\Exceptions\DraftConflict extends RuntimeException
public function __construct(): mixed
```

## Nvl\Templates\Exceptions\RenderConflict

```text
final class Nvl\Templates\Exceptions\RenderConflict extends RuntimeException
public function __construct(): mixed
```

## Nvl\Templates\Exceptions\RenderUnavailable

```text
final class Nvl\Templates\Exceptions\RenderUnavailable extends RuntimeException
```

## Nvl\Templates\Exceptions\RetryableRenderException

```text
final class Nvl\Templates\Exceptions\RetryableRenderException extends RuntimeException
public function __construct(string $reason): mixed
public readonly string $reason
```

## Nvl\Templates\Models\FamilyChange

```text
final class Nvl\Templates\Models\FamilyChange extends Nvl\Templates\Models\TemplateModel
public function delete(): mixed
@return ($this is Pivot ? (bool | int | null) : (bool | null))
resolved @return ($this is Illuminate\Database\Eloquent\Relations\Pivot ? (bool | int | null) : (bool | null))
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\FamilyChange>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function template(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<Template, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\Template, $this>
@property (int | null) $applied_version
@property int $expected_version
@property string $id
@property array<string, mixed> $inputs
@property string $operation
@property (string | null) $owner_reference
@property (string | null) $owner_scope_key
@property (array<string, mixed> | null) $resolutions
@property array<string, mixed> $result
@property string $scope_id
@property string $source_checksum
@property string $status
@property string $template_id
```

## Nvl\Templates\Models\Template

```text
class Nvl\Templates\Models\Template extends Nvl\Templates\Models\TemplateModel
public function delete(): mixed
@return ($this is Pivot ? (bool | int | null) : (bool | null))
resolved @return ($this is Illuminate\Database\Eloquent\Relations\Pivot ? (bool | int | null) : (bool | null))
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\Template>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
@property (string | null) $current_revision_id
@property (string | null) $group_id
@property string $id
@property string $key
@property string $name
@property (string | null) $owner_reference
@property (string | null) $owner_scope_key
@property string $scope_id
@property string $status
@property int $version
```

## Nvl\Templates\Models\TemplateAsset

```text
final class Nvl\Templates\Models\TemplateAsset extends Nvl\Templates\Models\TemplateModel implements Nvl\Media\Contracts\HasNvlMedia
public function delete(): mixed
@return ($this is Pivot ? (bool | int | null) : (bool | null))
resolved @return ($this is Illuminate\Database\Eloquent\Relations\Pivot ? (bool | int | null) : (bool | null))
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateAsset>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function registerNvlMedia(Nvl\Media\MediaRegistration $media, ?Nvl\Media\Models\Media $asset=null): void
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function scopeHasNvlMedia(Illuminate\Database\Eloquent\Builder $query, string $slot, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor, Nvl\Media\Contracts\MediaBatchAuthorization $policy): Illuminate\Database\Eloquent\Builder
@param Builder<static> $query
resolved @param Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateAsset> $query
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateAsset>
@property (CarbonImmutable | null) $archived_at
resolved @property (Carbon\CarbonImmutable | null) $archived_at
@property string $checksum
@property string $id
@property (string | null) $media_id
@property (int | null) $media_revision
@property string $mime_type
@property string $name
@property (string | null) $owner_reference
@property (string | null) $owner_scope_key
@property string $scope_id
@property int $size
```

## Nvl\Templates\Models\TemplateDraft

```text
final class Nvl\Templates\Models\TemplateDraft extends Nvl\Templates\Models\TemplateModel
public function delete(): mixed
@return ($this is Pivot ? (bool | int | null) : (bool | null))
resolved @return ($this is Illuminate\Database\Eloquent\Relations\Pivot ? (bool | int | null) : (bool | null))
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateDraft>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function template(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<Template, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\Template, $this>
@property array<string, mixed> $document
@property string $id
@property (string | null) $owner_reference
@property (string | null) $owner_scope_key
@property (array<string, mixed> | null) $proposed_basis
@property string $scope_id
@property string $template_id
@property int $version
```

## Nvl\Templates\Models\TemplateGroup

```text
final class Nvl\Templates\Models\TemplateGroup extends Nvl\Templates\Models\TemplateModel
public function delete(): mixed
@return ($this is Pivot ? (bool | int | null) : (bool | null))
resolved @return ($this is Illuminate\Database\Eloquent\Relations\Pivot ? (bool | int | null) : (bool | null))
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateGroup>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
@property (string | null) $current_revision_id
@property string $id
@property string $key
@property string $name
@property (string | null) $owner_reference
@property (string | null) $owner_scope_key
@property string $scope_id
@property string $status
@property int $version
```

## Nvl\Templates\Models\TemplateGroupRevision

```text
final class Nvl\Templates\Models\TemplateGroupRevision extends Nvl\Templates\Models\TemplateModel
public static function bootImmutableRevision(): void
public function delete(): mixed
@return ($this is Pivot ? (bool | int | null) : (bool | null))
resolved @return ($this is Illuminate\Database\Eloquent\Relations\Pivot ? (bool | int | null) : (bool | null))
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function group(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<TemplateGroup, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\TemplateGroup, $this>
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateGroupRevision>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
@property string $checksum
@property array<string, mixed> $document
@property string $group_id
@property string $id
@property (string | null) $owner_reference
@property (string | null) $owner_scope_key
@property Carbon $published_at
resolved @property Illuminate\Support\Carbon $published_at
@property int $revision
@property string $scope_id
@property array<string, mixed> $source
```

## Nvl\Templates\Models\TemplateRender

```text
final class Nvl\Templates\Models\TemplateRender extends Nvl\Templates\Models\TemplateModel implements Nvl\Media\Contracts\HasNvlMedia
public function delete(): mixed
@return ($this is Pivot ? (bool | int | null) : (bool | null))
resolved @return ($this is Illuminate\Database\Eloquent\Relations\Pivot ? (bool | int | null) : (bool | null))
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
public function registerNvlMedia(Nvl\Media\MediaRegistration $media, ?Nvl\Media\Models\Media $asset=null): void
public function revision(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<TemplateRevision, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\TemplateRevision, $this>
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function scopeHasNvlMedia(Illuminate\Database\Eloquent\Builder $query, string $slot, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor, Nvl\Media\Contracts\MediaBatchAuthorization $policy): Illuminate\Database\Eloquent\Builder
@param Builder<static> $query
resolved @param Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateRender> $query
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateRender>
@property int $attempts
@property (Carbon | null) $available_at
resolved @property (Illuminate\Support\Carbon | null) $available_at
@property (Carbon | null) $completed_at
resolved @property (Illuminate\Support\Carbon | null) $completed_at
@property (Carbon | null) $dispatch_requested_at
resolved @property (Illuminate\Support\Carbon | null) $dispatch_requested_at
@property (Carbon | null) $dispatched_at
resolved @property (Illuminate\Support\Carbon | null) $dispatched_at
@property (string | null) $error
@property (Carbon | null) $expires_at
resolved @property (Illuminate\Support\Carbon | null) $expires_at
@property (Carbon | null) $failed_at
resolved @property (Illuminate\Support\Carbon | null) $failed_at
@property string $fingerprint
@property int $generation
@property string $id
@property (string | null) $idempotency_key
@property (Carbon | null) $lease_expires_at
resolved @property (Illuminate\Support\Carbon | null) $lease_expires_at
@property string $output
@property (string | null) $owner_reference
@property (string | null) $owner_scope_key
@property (string | null) $processing_token
@property (Carbon | null) $purged_at
resolved @property (Illuminate\Support\Carbon | null) $purged_at
@property (array<string, mixed> | null) $result
@property string $scope_id
@property (array<string, mixed> | null) $snapshot
@property (string | null) $snapshot_checksum
@property string $status
@property string $template_revision_id
```

## Nvl\Templates\Models\TemplateResource

```text
final class Nvl\Templates\Models\TemplateResource extends Nvl\Templates\Models\TemplateModel
public function delete(): mixed
@return ($this is Pivot ? (bool | int | null) : (bool | null))
resolved @return ($this is Illuminate\Database\Eloquent\Relations\Pivot ? (bool | int | null) : (bool | null))
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateResource>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
@property (string | null) $current_revision_id
@property (string | null) $group_id
@property string $id
@property string $key
@property string $kind
@property string $name
@property string $owner_key
@property (string | null) $owner_reference
@property (string | null) $owner_scope_key
@property (array<string, mixed> | null) $restrictions
@property string $scope
@property string $scope_id
@property string $status
@property (string | null) $template_id
@property int $version
```

## Nvl\Templates\Models\TemplateResourceRevision

```text
final class Nvl\Templates\Models\TemplateResourceRevision extends Nvl\Templates\Models\TemplateModel
public static function bootImmutableRevision(): void
public function delete(): mixed
@return ($this is Pivot ? (bool | int | null) : (bool | null))
resolved @return ($this is Illuminate\Database\Eloquent\Relations\Pivot ? (bool | int | null) : (bool | null))
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateResourceRevision>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function resource(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<TemplateResource, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\TemplateResource, $this>
public function save(array $options=[]): bool
@param array<string, mixed> $options
@property string $checksum
@property array<string, mixed> $document
@property string $id
@property (string | null) $origin_revision_id
@property (string | null) $owner_reference
@property (string | null) $owner_scope_key
@property (array<string, mixed> | null) $provenance
@property string $resource_id
@property int $revision
@property string $scope_id
```

## Nvl\Templates\Models\TemplateRevision

```text
final class Nvl\Templates\Models\TemplateRevision extends Nvl\Templates\Models\TemplateModel
public static function bootImmutableRevision(): void
public function delete(): mixed
@return ($this is Pivot ? (bool | int | null) : (bool | null))
resolved @return ($this is Illuminate\Database\Eloquent\Relations\Pivot ? (bool | int | null) : (bool | null))
public function fresh(mixed $with=[]): ?static
@param (array<array-key, mixed> | string) $with
public function getConnectionName(): ?string
public function getTable(): string
public function newQueryForRestoration(mixed $ids): Illuminate\Database\Eloquent\Builder
@param (int | string | array<array-key, (int | string)>) $ids
@return Builder<static>
resolved @return Illuminate\Database\Eloquent\Builder<Nvl\Templates\Models\TemplateRevision>
public static function ownershipDefinition(): Nvl\Support\Ownership\ValueObjects\OwnershipDefinition
public function refresh(): static
public function refreshForUpdate(): static
public function save(array $options=[]): bool
@param array<string, mixed> $options
public function template(): Illuminate\Database\Eloquent\Relations\BelongsTo
@return BelongsTo<Template, $this>
resolved @return Illuminate\Database\Eloquent\Relations\BelongsTo<Nvl\Templates\Models\Template, $this>
@property string $checksum
@property array<array-key, mixed> $dependencies
@property array<string, mixed> $document
@property (string | null) $group_id
@property (string | null) $group_revision_id
@property string $id
@property (string | null) $owner_reference
@property (string | null) $owner_scope_key
@property Carbon $published_at
resolved @property Illuminate\Support\Carbon $published_at
@property int $revision
@property string $scope_id
@property array<string, mixed> $source
@property string $template_id
```

## Nvl\Templates\Rendering\RenderedDocument

```text
final readonly class Nvl\Templates\Rendering\RenderedDocument
public function toArray(): array
@return RenderResult
resolved @return array{html: string, css: string, subject: ?string, text: ?string, revisionId: string, checksum: string, inlineAssets: list<array{cid: string, name: string, mimeType: string, content: string}>}
public readonly string $checksum
public readonly string $css
public readonly string $html
public readonly array $inlineAssets
@param list<InlineAsset> $inlineAssets
resolved @param list<array{cid: string, name: string, mimeType: string, content: string}> $inlineAssets
public readonly string $revisionId
public readonly ?string $subject
public readonly ?string $text
```

## Nvl\Templates\Services\FamilyLifecycle

```text
final class Nvl\Templates\Services\FamilyLifecycle
public function __construct(Nvl\Templates\Services\TemplateOperation $operation, Nvl\Templates\Services\DocumentResolver $documents, Nvl\Templates\Services\ResourceManager $resources, Nvl\Templates\Services\ResourceCloner $cloner, Nvl\Templates\Services\FamilyMaterializer $materializer, Nvl\Templates\Services\AssetManager $assets): mixed
public function apply(string $templateId, string $candidateId, array $resolutions, int $expectedVersion, string $sourceChecksum, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@param array<string, ('local' | 'family')> $resolutions
@return array{version: int, sourceChecksum: string, source: array<array-key, mixed>, candidate: array<string, mixed>}
public function get(string $templateId, string $candidateId, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@return array<string, mixed>
public function listing(string $templateId, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@return list<array<string, mixed>>
public function prepare(string $templateId, string $operation, ?array $target, int $expectedVersion, string $sourceChecksum, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@param (array{groupId: string, revision: int} | null) $target
@return array<string, mixed>
public function review(string $templateId, string $candidateId, array $resolutions, int $expectedVersion, string $sourceChecksum, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@param array<string, ('local' | 'family')> $resolutions
@return array<string, mixed>
```

## Nvl\Templates\Services\RenderRequests

```text
final class Nvl\Templates\Services\RenderRequests
public function __construct(Nvl\Templates\Services\TemplateOperation $operation, Nvl\Templates\Services\RenderPipeline $pipeline, Nvl\Templates\Services\RenderDispatcher $dispatcher, Nvl\Templates\Services\RenderProcessor $processor, Nvl\Templates\Services\RenderMaintenance $maintenance, Nvl\Templates\Services\RenderArtifacts $artifacts, Nvl\Templates\Contracts\RenderExecutionContext $execution): mixed
public function accept(string $revisionId, array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateRender
@param array{facts?: array<array-key, mixed>, context?: array<array-key, mixed>, inputs?: array<array-key, mixed>, settings?: array<array-key, mixed>, output?: ('html' | 'pdf'), options?: array{filename?: string, expectedPages?: int, maxPages?: int}, idempotency_key?: ?string, owner?: ?array<array-key, mixed>, request_identity?: ?string} $data
public function byKey(string $key, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateRender
public function bytes(string $id, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): string
public function dispatch(string $id, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateRender
public function get(string $id, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateRender
public function process(string $id, ?int $generation, ?string $token, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateRender
public function prune(int $limit, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): int
public function queue(string $revisionId, array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateRender
@param array{facts?: array<array-key, mixed>, context?: array<array-key, mixed>, inputs?: array<array-key, mixed>, settings?: array<array-key, mixed>, output?: ('html' | 'pdf'), options?: array{filename?: string, expectedPages?: int, maxPages?: int}, idempotency_key?: ?string, owner?: ?array<array-key, mixed>, request_identity?: ?string} $data
public function recover(int $limit, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): int
public function result(string $id, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@return array{html: string, css: string, subject: ?string, text: ?string, revisionId: string, checksum: string, inlineAssets: list<array{cid: string, name: string, mimeType: string, content: string}>}
```

## Nvl\Templates\Services\ResourceManager

```text
final class Nvl\Templates\Services\ResourceManager
public function __construct(Nvl\Templates\Services\TemplateOperation $operation): mixed
public function catalog(string $templateId, ?string $kind, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Illuminate\Database\Eloquent\Collection
@return Collection<int, TemplateResource>
resolved @return Illuminate\Database\Eloquent\Collection<int, Nvl\Templates\Models\TemplateResource>
public function create(string $key, string $name, string $kind, string $scope, ?string $ownerId, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateResource
public function publish(string $id, array $document, int $expectedRevision, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateResourceRevision
@param array<array-key, mixed> $document
public function revisionFor(string $templateId, string $resourceId, int $revision, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateResourceRevision
```

## Nvl\Templates\Services\TemplateAssets

```text
final readonly class Nvl\Templates\Services\TemplateAssets
public function __construct(Nvl\Templates\Services\TemplateOperation $operation, Nvl\Templates\Services\AssetManager $assets): mixed
public function contents(string $id, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@return array{0: TemplateAsset, 1: string}
resolved @return array{0: Nvl\Templates\Models\TemplateAsset, 1: string}
public function fromStorage(string $source, string $key, string $name, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateAsset
public function fromUrl(string $url, string $name, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateAsset
public function resolve(string $id, string $target, bool $embedEmail, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@return array{id: string, checksum: string, mimeType: string, url: string, attachment: ?array{cid: string, name: string, mimeType: string, content: string}}
public function upload(Illuminate\Http\UploadedFile $file, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateAsset
```

## Nvl\Templates\Services\TemplateCatalog

```text
final readonly class Nvl\Templates\Services\TemplateCatalog
public function __construct(Nvl\Templates\Services\TemplateOperation $operation): mixed
public function assets(array $query, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Illuminate\Pagination\LengthAwarePaginator
@param array<array-key, mixed> $query
@return LengthAwarePaginator<int, TemplateAsset>
resolved @return Illuminate\Pagination\LengthAwarePaginator<int, Nvl\Templates\Models\TemplateAsset>
public function groupRevision(string $groupId, int $revision, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateGroupRevision
public function groups(array $query, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Illuminate\Pagination\LengthAwarePaginator
@param array<array-key, mixed> $query
@return LengthAwarePaginator<int, TemplateGroup>
resolved @return Illuminate\Pagination\LengthAwarePaginator<int, Nvl\Templates\Models\TemplateGroup>
public function templates(array $query, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Illuminate\Pagination\LengthAwarePaginator
@param array<array-key, mixed> $query
@return LengthAwarePaginator<int, Template>
resolved @return Illuminate\Pagination\LengthAwarePaginator<int, Nvl\Templates\Models\Template>
```

## Nvl\Templates\Services\TemplateFamilies

```text
final class Nvl\Templates\Services\TemplateFamilies
public function __construct(Nvl\Templates\Services\TemplateOperation $operation, Nvl\Templates\Services\FamilyMaterializer $materializer, Nvl\Templates\Services\ResourceManager $resources, Nvl\Templates\Services\DocumentValidator $validator, Nvl\Templates\Services\FamilyLifecycle $families): mixed
public function create(array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateGroup
@param array{key: string, name: string} $data
public function publish(string $groupId, array $document, int $expectedRevision, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateGroupRevision
@param array<array-key, mixed> $document
```

## Nvl\Templates\Services\TemplateLifecycle

```text
final class Nvl\Templates\Services\TemplateLifecycle
public function __construct(Nvl\Templates\Services\TemplateOperation $operation, Nvl\Templates\Services\DocumentResolver $documents, Nvl\Templates\Services\DocumentValidator $validator, Nvl\Templates\Services\ResourceManager $resources): mixed
public function create(array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\Template
@param array{key: string, name: string, groupId?: (string | null)} $data
public function publish(string $templateId, int $expectedVersion, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateRevision
public function saveDraft(string $templateId, array $document, int $expectedVersion, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\TemplateDraft
@param array<array-key, mixed> $document
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

## Nvl\Templates\Services\TemplateReader

```text
final class Nvl\Templates\Services\TemplateReader
public function __construct(Nvl\Templates\Services\TemplateOperation $operation, Nvl\Templates\Services\DocumentResolver $documents, Nvl\Templates\Services\ResourceManager $resources, Nvl\Templates\Services\FamilyLifecycle $families, Nvl\Templates\Services\AssetManager $assets): mixed
public function get(string $id, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\Models\Template
public function load(string $id, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@return array{template: array{id: string, key: string, name: string, groupId: ?string, status: string}, version: int, source: (array<array-key, mixed> | null), document: (array<array-key, mixed> | null), sourceChecksum: ?string, family: (array{id: string, revisionId: string, revision: int, source: array<array-key, mixed>, document: array<array-key, mixed>} | null), proposedGroupId: ?string, hasProposedBasis: bool, familyChanges: list<array<array-key, mixed>>, currentRevisionId: ?string, capabilities: array<array-key, mixed>, previewAssets: object, issues: list<array{path: string, message: string}>}
```

## Nvl\Templates\Services\TemplateRenderer

```text
final class Nvl\Templates\Services\TemplateRenderer
public function __construct(Nvl\Templates\Services\TemplateOperation $operation, Nvl\Templates\Services\DocumentResolver $documents, Nvl\Templates\Services\DocumentValidator $validator, Nvl\Templates\Services\ResourceManager $resources, Nvl\Templates\Services\RenderPipeline $pipeline, Nvl\Templates\Services\RuntimeDataResolver $runtime, Nvl\Templates\Services\AssetManager $assets, Nvl\Templates\Rendering\EmailProfile $email): mixed
public function pdf(string $revisionId, array $data, array $options, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): Nvl\Templates\ValueObjects\PdfOutput
@param array{facts?: array<array-key, mixed>, context?: array<array-key, mixed>, inputs?: array<array-key, mixed>, settings?: array<array-key, mixed>} $data
@param array{filename?: string, expectedPages?: int, maxPages?: int} $options
public function prepare(string $revisionId, array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@param array{facts?: array<array-key, mixed>, context?: array<array-key, mixed>, inputs?: array<array-key, mixed>, settings?: array<array-key, mixed>} $data
@return array{revisionId: string, document: array<array-key, mixed>, data: mixed, previewAssets: object}
public function preview(string $templateId, array $document, array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@param array<array-key, mixed> $document
@param array{facts?: array<array-key, mixed>, context?: array<array-key, mixed>, inputs?: array<array-key, mixed>, settings?: array<array-key, mixed>} $data
@return array{html: string, css: string, subject: ?string, text: ?string, revisionId: string, checksum: string, inlineAssets: list<array{cid: string, name: string, mimeType: string, content: string}>}
public function previewForBrowser(string $templateId, array $document, array $data, bool $includeInlineAssets, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@param array<array-key, mixed> $document
@param array{facts?: array<array-key, mixed>, context?: array<array-key, mixed>, inputs?: array<array-key, mixed>, settings?: array<array-key, mixed>} $data
@return array{html: string, css: string, subject: ?string, text: ?string, revisionId: string, checksum: string, inlineAssets: list<array{cid: string, name: string, mimeType: string, content: string}>, previewHtml: string}
public function render(string $revisionId, array $data, Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor $actor): array
@param array{facts?: array<array-key, mixed>, context?: array<array-key, mixed>, inputs?: array<array-key, mixed>, settings?: array<array-key, mixed>} $data
@return array{html: string, css: string, subject: ?string, text: ?string, revisionId: string, checksum: string, inlineAssets: list<array{cid: string, name: string, mimeType: string, content: string}>}
```

## Nvl\Templates\Support\Capabilities

```text
final class Nvl\Templates\Support\Capabilities
public static function assetTypesByTarget(): array
@return array{email: list<string>, document: list<string>}
public static function document(): array
@return array<string, mixed>
```

## Nvl\Templates\ValueObjects\PdfOutput

```text
final readonly class Nvl\Templates\ValueObjects\PdfOutput
public function __construct(string $bytes, string $filename="document.pdf"): mixed
public readonly string $bytes
public readonly string $checksum
public readonly string $filename
public readonly int $size
```
