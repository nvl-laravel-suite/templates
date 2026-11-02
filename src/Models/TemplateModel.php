<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LogicException;
use Nvl\Support\Config\PackageStorage;
use Nvl\Support\Ownership\Contracts\Ownable;
use Nvl\Support\Ownership\Traits\HasOwnership;
use Nvl\Templates\Services\DocumentModelWriter;
use Nvl\Templates\Support\Scope;

/**
 * Native document persistence with trusted partition and Ownership guards.
 *
 * @property string $id
 * @property string $scope_id
 * @property string|null $owner_scope_key
 * @property string|null $owner_reference
 *
 * @internal
 */
abstract class TemplateModel extends Model implements Ownable
{
    use HasOwnership;
    use HasUuids;

    /** @var list<string> */
    protected $guarded = ['scope_id', 'owner_scope_key', 'owner_reference'];

    protected string $tableKey;

    public function getTable(): string
    {
        return Scope::table($this->tableKey);
    }

    public function getConnectionName(): ?string
    {
        return PackageStorage::connectionName($this->connection ?? PackageStorage::connection('templates') ?? parent::getConnectionName());
    }

    /** @param array<string, mixed> $options */
    public function save(array $options = []): bool
    {
        return app(DocumentModelWriter::class)->save($this, fn (): bool => parent::save($options));
    }

    protected static function booted(): void
    {
        static::addGlobalScope('templates_scope', static fn (Builder $query) => $query->where($query->getModel()->qualifyColumn('scope_id'), Scope::current()));
        static::creating(static function (self $model): void {
            if (isset($model->scope_id) && $model->scope_id !== Scope::current()) {
                throw new LogicException('Cannot create a template record in another application scope.');
            }
            $model->scope_id = Scope::current();
        });
        static::updating(static function (self $model): void {
            if ($model->isDirty('scope_id')) {
                throw new LogicException('The template partition is immutable.');
            }
        });
    }
}
