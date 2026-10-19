<?php

declare(strict_types=1);

namespace Nvl\Templates\Ownership;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Schema\Blueprint;
use Nvl\Content\Contracts\ContentSnapshotIntegrity;
use Nvl\Content\Data\ContentCompositionSnapshotData;
use Nvl\Ownership\Contracts\OwnershipAdoptionAdapter;
use Nvl\Ownership\Services\OwnershipAdoptionStore;
use Nvl\Ownership\Services\OwnershipDatabaseConstraints;
use Nvl\Ownership\Services\OwnershipSchema;
use Nvl\Ownership\ValueObjects\OwnershipAdoptionPlan;
use Nvl\Ownership\ValueObjects\OwnershipBackfillResult;
use Nvl\Ownership\ValueObjects\OwnershipVerification;
use Nvl\Support\Ownership\Exceptions\OwnershipConfigurationInvalid;
use Nvl\Support\Ownership\Services\OwnershipResourceRegistry;
use Nvl\Templates\Models\TemplateVersion;

/**
 * Adopts exact reviewed Templates records without guessing primary owners from associations.
 *
 * @internal
 */
final readonly class TemplatesAdoptionAdapter implements OwnershipAdoptionAdapter
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private OwnershipResourceRegistry $resources,
        private OwnershipAdoptionStore $mappings,
        private OwnershipSchema $schema,
        private OwnershipDatabaseConstraints $constraints,
        private ContentSnapshotIntegrity $snapshots,
    ) {}

    /** @return list<string> */
    public function resources(): array
    {
        return ['templates.templates', 'templates.translations', 'templates.versions', 'templates.assignments', 'templates.renders', 'templates.catalog-grants'];
    }

    /** Prepare additive partitions and replace only the package's known global receipt identity. */
    public function prepare(OwnershipAdoptionPlan $plan): void
    {
        $root = new ($this->resources->get('templates.templates')->model);
        $connection = $root->getConnection();
        $schema = $connection->getSchemaBuilder();
        $version = new ($this->resources->get('templates.versions')->model);
        $grant = new ($this->resources->get('templates.catalog-grants')->model);
        if (! $schema->hasTable($grant->getTable())) {
            $schema->create($grant->getTable(), static function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('template_version_id');
                $table->unsignedBigInteger('source_revision');
                $table->unsignedBigInteger('revision')->default(1);
                $table->timestampTz('revoked_at')->nullable();
                $table->timestampsTz();
            });
        }
        foreach (['catalog_grant_id', 'catalog_source_version_id', 'catalog_source_revision', 'catalog_source_hash', 'catalog_import_key', 'catalog_import_request_hash'] as $column) {
            if (! $schema->hasColumn($version->getTable(), $column)) {
                $schema->table($version->getTable(), static function (Blueprint $table) use ($column): void {
                    if ($column === 'catalog_source_revision') {
                        $table->unsignedBigInteger($column)->nullable();
                    } elseif (in_array($column, ['catalog_grant_id', 'catalog_source_version_id'], true)) {
                        $table->uuid($column)->nullable();
                    } else {
                        $table->string($column, $column === 'catalog_import_key' ? 191 : 64)->nullable();
                    }
                });
            }
        }
        foreach ($this->resources() as $key) {
            $model = new ($this->resources->get($key)->model);
            foreach (['tenant_id', 'ownership_key'] as $column) {
                if ($schema->hasColumn($model->getTable(), $column)) {
                    $schema->table($model->getTable(), static fn (Blueprint $table) => ($column === 'tenant_id' ? $table->uuid($column) : $table->string($column, 191))->nullable()->change());
                }
            }
            $this->schema->prepare($key);
        }
        foreach (['templates.translations', 'templates.versions', 'templates.assignments', 'templates.renders'] as $key) {
            $child = new ($this->resources->get($key)->model);
            $column = 'template_id';
            $found = false;
            foreach ($schema->getForeignKeys($child->getTable()) as $foreign) {
                if ($foreign['columns'] === [$column] && $foreign['foreign_table'] === $root->getTable() && $foreign['foreign_columns'] === ['id']) {
                    $found = true;
                    break;
                }
            }
            if (! $found) {
                $name = 'templates_native_'.substr(hash('sha256', $child->getTable().$column), 0, 24);
                $schema->table($child->getTable(), static fn (Blueprint $table) => $table->foreign([$column], $name)->references(['id'])->on($root->getTable())->restrictOnDelete());
            }
        }
        $assignment = new ($this->resources->get('templates.assignments')->model);
        $render = new ($this->resources->get('templates.renders')->model);
        foreach ([[$root, [['key'], ['ownership_key', 'key']]], [$assignment, [['owner_type', 'owner_id', 'profile'], ['tenant_id', 'owner_type', 'owner_id', 'profile']]], [$render, [['idempotency_key'], ['tenant_id', 'idempotency_key']]]] as [$model, $identities]) {
            foreach ($schema->getIndexes($model->getTable()) as $index) {
                if ($index['unique'] && in_array($index['columns'], $identities, true)) {
                    $schema->table($model->getTable(), static fn (Blueprint $table) => $table->dropUnique($index['name']));
                }
            }
        }
        $this->unique($root, ['owner_scope_key', 'key'], 'templates_native_owner_key_unique');
        $this->unique($assignment, ['owner_scope_key', 'owner_type', 'owner_id', 'profile'], 'templates_native_assignment_unique');
        $this->unique($render, ['owner_scope_key', 'idempotency_key'], 'templates_native_render_unique');
        $this->unique($version, ['owner_scope_key', 'catalog_import_key'], 'templates_native_import_unique');
        $this->unique($grant, ['owner_scope_key', 'template_version_id'], 'templates_native_grant_unique');
        foreach ([['templates.assignments', 'template_version_id', 'templates.versions'], ['templates.renders', 'template_version_id', 'templates.versions']] as [$childKey,$column,$parentKey]) {
            $child = new ($this->resources->get($childKey)->model);
            $parent = new ($this->resources->get($parentKey)->model);
            $this->unique($parent, ['id', 'template_id'], 'templates_tuple_'.substr(hash('sha256', $parent->getTable()), 0, 20));
            $found = false;
            foreach ($schema->getForeignKeys($child->getTable()) as $foreign) {
                if ($foreign['columns'] === [$column, 'template_id'] && $foreign['foreign_table'] === $parent->getTable()) {
                    $found = true;
                    break;
                }
            }
            if (! $found) {
                $name = 'templates_tuple_'.substr(hash('sha256', $child->getTable().$column), 0, 20);
                $schema->table($child->getTable(), static fn (Blueprint $table) => $table->foreign([$column, 'template_id'], $name)->references(['id', 'template_id'])->on($parent->getTable())->restrictOnDelete());
            }
        }
    }

    /** @param list<string> $columns */
    private function unique(Model $model, array $columns, string $name): void
    {
        $schema = $model->getConnection()->getSchemaBuilder();
        foreach ($schema->getIndexes($model->getTable()) as $index) {
            if ($index['unique'] && $index['columns'] === $columns) {
                return;
            }
        }
        $schema->table($model->getTable(), static fn (Blueprint $table) => $table->unique($columns, $name));
    }

    /** Backfill bounded actual records from explicit immutable per-record mappings. */
    public function backfill(OwnershipAdoptionPlan $plan, ?string $cursor, int $limit): OwnershipBackfillResult
    {
        $processed = 0;
        do {
            $result = $this->backfillResource($plan, $cursor, $limit - $processed);
            $processed += $result->processed;
            $cursor = $result->nextCursor;
        } while ($cursor !== null && $processed < $limit);

        return new OwnershipBackfillResult($cursor, $processed);
    }

    /** Consume at most one resource page without counting empty tables as progress. */
    private function backfillResource(OwnershipAdoptionPlan $plan, ?string $cursor, int $limit): OwnershipBackfillResult
    {
        $parts = $cursor === null ? ['0', ''] : explode(':', $cursor, 2);
        if (count($parts) !== 2 || ! ctype_digit($parts[0])) {
            throw new OwnershipConfigurationInvalid('Invalid Templates adoption cursor.');
        }
        $keys = $this->resources();
        $position = (int) $parts[0];
        $key = $keys[$position] ?? throw new OwnershipConfigurationInvalid('Invalid Templates adoption resource.');
        $definition = $this->resources->get($key);
        $model = new $definition->model;
        $connection = $model->getConnection();
        $rows = $connection->table($model->getTable())->when($parts[1] !== '', static fn ($query) => $query->where('id', '>', $parts[1]))->orderBy('id')->limit($limit)->get();
        $last = '';
        $connection->transaction(function () use ($rows, $key, $plan, $definition, $model, $connection, &$last): void {
            foreach ($rows as $row) {
                if (! is_string($row->id)) {
                    throw new OwnershipConfigurationInvalid('Templates adoption requires canonical UUID records.');
                }
                $mapping = $this->mappings->forRecord($plan, $key, $row->id);
                $owner = $mapping->owner;
                if (isset($row->tenant_id) && $mapping->legacyTenantId !== $row->tenant_id) {
                    throw new OwnershipConfigurationInvalid('Reviewed Templates mappings must preserve the original tenant identity.');
                }
                $nativeOwner = $definition->ownership->foreignKey === null ? null : ($row->{$definition->ownership->foreignKey} ?? null);
                if ($nativeOwner !== null && ((! is_int($nativeOwner) && ! is_string($nativeOwner)) || (string) $nativeOwner !== $owner?->key)) {
                    throw new OwnershipConfigurationInvalid('Templates adoption cannot relabel an existing native primary owner.');
                }
                $attributes = ['owner_scope_key' => $owner?->scopeKey() ?? 'central'];
                $ownership = $definition->ownership;
                if ($ownership->strategy === 'captured') {
                    $attributes['owner_reference'] = $owner === null ? null : json_encode($owner->toArray(), JSON_THROW_ON_ERROR);
                } elseif ($ownership->strategy === 'column') {
                    $attributes[$ownership->foreignKey ?? throw new OwnershipConfigurationInvalid] = $owner?->key;
                } elseif ($ownership->strategy === 'pivot' && $owner !== null) {
                    $connection->table($ownership->table ?? throw new OwnershipConfigurationInvalid)->insertOrIgnore([
                        $ownership->resourceKey ?? throw new OwnershipConfigurationInvalid => $row->id,
                        $ownership->ownerKey ?? throw new OwnershipConfigurationInvalid => $owner->key,
                        'owner_scope_key' => $owner->scopeKey(),
                    ]);
                }
                if ($key === 'templates.versions' && $row->content_snapshot !== null) {
                    if (! is_string($row->content_snapshot)) {
                        throw new OwnershipConfigurationInvalid('Stored Template snapshots must contain canonical JSON.');
                    }
                    $payload = json_decode($row->content_snapshot, true, flags: JSON_THROW_ON_ERROR);
                    if (! is_array($payload)) {
                        throw new OwnershipConfigurationInvalid('Stored Template snapshot is malformed.');
                    }
                    $snapshot = ContentCompositionSnapshotData::from($payload);
                    $context = ['mode' => $owner === null ? 'central' : 'owner', 'owner' => $owner?->toArray()];
                    if ($snapshot->ownerId !== $row->id || $snapshot->ownerType !== $model->getMorphClass() || $snapshot->group !== TemplateVersion::CONTENT_GROUP || $snapshot->version !== $row->content_hash || ($snapshot->formatVersion === 2 && ($mapping->legacyTenantId === null || $snapshot->tenantId !== $mapping->legacyTenantId)) || ($snapshot->formatVersion === 3 && $snapshot->ownershipContext !== $context)) {
                        throw new OwnershipConfigurationInvalid('Reviewed Template snapshots must preserve canonical source identity and checksum.');
                    }
                    $snapshot = $this->snapshots->rebind($snapshot, $snapshot->ownerType, $snapshot->ownerId, $context);
                    $attributes['content_snapshot'] = json_encode($snapshot->toArray(), JSON_THROW_ON_ERROR);
                    $attributes['content_hash'] = $snapshot->version;
                }
                $connection->table($model->getTable())->where('id', $row->id)->update($attributes);
                $last = $row->id;
            }
        });
        $next = $rows->count() === $limit ? $position.':'.$last : ($position + 1 < count($keys) ? ($position + 1).':' : null);

        return new OwnershipBackfillResult($next, $rows->count());
    }

    /** Verify persisted partitions and the complete canonical domain graph. */
    public function verify(OwnershipAdoptionPlan $plan): OwnershipVerification
    {
        foreach ($this->resources() as $key) {
            $this->schema->verify($key);
        }

        foreach ([['templates.assignments', 'template_version_id', 'templates.versions'], ['templates.renders', 'template_version_id', 'templates.versions'], ['templates.renders', 'template_assignment_id', 'templates.assignments']] as [$childKey,$column,$parentKey]) {
            $child = new ($this->resources->get($childKey)->model);
            $parent = new ($this->resources->get($parentKey)->model);
            $bad = $child->getConnection()->table($child->getTable().' as child')->leftJoin($parent->getTable().' as parent', 'parent.id', '=', 'child.'.$column)->whereNotNull('child.'.$column)->where(static fn (Builder $q) => $q->whereNull('parent.id')->orWhereColumn('parent.owner_scope_key', '!=', 'child.owner_scope_key')->orWhereColumn('parent.template_id', '!=', 'child.template_id'))->exists();
            if ($bad) {
                throw new OwnershipConfigurationInvalid('Template graph must retain the exact canonical root and owner.');
            }
        }

        return new OwnershipVerification([]);
    }

    /** Install native graph constraints before activation can commit. */
    public function activate(OwnershipAdoptionPlan $plan): void
    {
        foreach ($this->resources() as $key) {
            $this->schema->constrain($key);
        }
        foreach ([['templates.assignments', 'template_version_id', 'templates.versions', true], ['templates.renders', 'template_version_id', 'templates.versions', false], ['templates.renders', 'template_assignment_id', 'templates.assignments', true]] as [$childKey,$column,$parentKey,$nullable]) {
            $child = new ($this->resources->get($childKey)->model);
            $parent = new ($this->resources->get($parentKey)->model);
            $this->constraints->reference($child->getConnection(), $child->getTable(), $column, $parent->getTable(), 'id', $nullable, ['template_id']);
        }
        $version = new ($this->resources->get('templates.versions')->model);
        $this->constraints->freeze($version->getConnection(), $version->getTable(), ['metadata', 'content_snapshot', 'content_hash', 'published_by_type', 'published_by', 'published_at'], afterStatuses: ['published', 'retired']);
        $render = new ($this->resources->get('templates.renders')->model);
        $this->constraints->freeze($render->getConnection(), $render->getTable(), ['payload', 'settings'], eraseStatuses: ['completed', 'failed']);
        $this->constraints->freeze($render->getConnection(), $render->getTable(), ['template_assignment_id'], eraseStatuses: ['pending', 'processing', 'completed', 'failed']);
        $targets = [];
        $hosts = config('nvl-templates.ownership.owner_resources', []);
        if (! is_array($hosts)) {
            throw new OwnershipConfigurationInvalid('Template hosts must be an alias to resource map.');
        }
        foreach ($hosts as $alias => $key) {
            if (! is_string($alias) || ! is_string($key)) {
                throw new OwnershipConfigurationInvalid('Template host aliases and resources must be strings.');
            }
            $parent = new ($this->resources->get($key)->model);
            $targets[] = ['type' => $alias, 'table' => $parent->getTable(), 'key' => $parent->getKeyName()];
        }

        $assignment = new ($this->resources->get('templates.assignments')->model);
        $this->constraints->polymorphicReference($assignment->getConnection(), $assignment->getTable(), 'owner_type', 'owner_id', $targets);

    }
}
