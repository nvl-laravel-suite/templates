<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;
use Illuminate\Support\Facades\Schema;
use Nvl\Support\Config\PackageStorage;
use Nvl\Support\Ownership\Services\OwnershipStorageTables;
use Nvl\Support\Ownership\Services\PersistedOwnershipStorage;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Support\Scope;

return new class extends Migration
{
    private const array Placeholders = ['owner_scope_key', 'owner_reference'];

    public function getConnection(): ?string
    {
        return PackageStorage::connection('templates');
    }

    public function up(): void
    {
        if (TemplateModelRegistry::modelClass()::ownershipDefinition()->strategy !== 'unscoped') {
            return;
        }

        $schema = Schema::connection($this->getConnection());
        $connection = $schema->getConnection();
        $tables = [];
        $hasPlaceholders = false;
        foreach (array_keys(config()->array('nvl-templates.tables')) as $key) {
            $table = Scope::table($key);
            $columns = $schema->getColumnListing($table);
            if ($columns === []) {
                throw new LogicException("Templates ownership cleanup requires the existing document table [{$table}].");
            }
            $tables['templates.'.str_replace('_', '-', $key)] = $table;
            $hasPlaceholders = $hasPlaceholders || array_intersect(self::Placeholders, $columns) !== [];
        }
        if (! $hasPlaceholders) {
            return;
        }

        if (in_array($connection->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->dropOnMySql($schema, $tables);

            return;
        }

        $connection->transaction(function () use ($schema, $tables, $connection): void {
            if ($connection->getDriverName() === 'pgsql') {
                $quoted = array_map($connection->getQueryGrammar()->wrapTable(...), $tables);
                $connection->statement('LOCK TABLE '.implode(', ', $quoted).' IN ACCESS EXCLUSIVE MODE');
            }
            foreach ($this->verifiedPlaceholders($schema, $tables) as $table => $columns) {
                $schema->table($table, static fn (Blueprint $blueprint) => $blueprint->dropColumn($columns));
            }
        });
    }

    /** Fresh graphs never had these placeholders. Removing NULL-only columns needs no data restoration. */
    public function down(): void {}

    /** @param  array<string, string>  $tables */
    private function dropOnMySql(Builder $schema, array $tables): void
    {
        $connection = $schema->getConnection();
        $pdo = $connection->getPdo();
        if (! $pdo instanceof PDO || $pdo->inTransaction() || $connection->transactionLevel() !== 0
            || $connection->scalar('select database()', [], false) !== $connection->getDatabaseName()) {
            throw new LogicException('Templates placeholder removal requires its configured MySQL source and no active transaction.');
        }

        $grammar = $connection->getQueryGrammar();
        $locks = array_map(static fn (string $table): string => $grammar->wrapTable($table).' WRITE', $tables);
        if ($schema->getColumnListing(OwnershipStorageTables::Markers) !== []) {
            $locks[] = $grammar->wrapTable(OwnershipStorageTables::Markers).' READ';
        }
        if ($pdo->exec('LOCK TABLES '.implode(', ', $locks)) === false) {
            throw new LogicException('Templates placeholder removal could not lock the document tables.');
        }
        try {
            foreach ($this->verifiedPlaceholders($schema, $tables) as $table => $columns) {
                if ($connection->getRawPdo() !== $pdo) {
                    throw new LogicException('Templates placeholder removal lost its locked MySQL session.');
                }
                $drops = array_map(static fn (string $column): string => 'DROP COLUMN '.$grammar->wrap($column), $columns);
                if ($pdo->exec('ALTER TABLE '.$grammar->wrapTable($table).' '.implode(', ', $drops)) === false) {
                    throw new LogicException("Templates could not remove unused ownership columns from [{$table}].");
                }
            }
        } finally {
            try {
                $pdo->exec('UNLOCK TABLES');
            } catch (PDOException) {
                if ($connection->getRawPdo() === $pdo) {
                    $connection->disconnect();
                }
            }
        }
    }

    /**
     * Inspect the whole graph before changing any table, including on engines with implicit DDL commits.
     *
     * @param  array<string, string>  $tables
     * @return array<string, non-empty-list<string>>
     */
    private function verifiedPlaceholders(Builder $schema, array $tables): array
    {
        $connection = $schema->getConnection();
        $storage = new PersistedOwnershipStorage;
        $markers = $storage->probe($connection)['markers'];
        $drop = [];
        foreach ($tables as $resource => $table) {
            $storage->assertMarkers($markers, $resource, $table);
            $columns = array_column($schema->getColumns($table), null, 'name');
            if ($columns === []) {
                throw new LogicException("Templates ownership cleanup requires the existing document table [{$table}].");
            }
            $placeholders = array_values(array_intersect(self::Placeholders, array_keys($columns)));
            if ($placeholders === []) {
                continue;
            }
            $records = $connection->table($table)->useWritePdo();
            foreach ($placeholders as $column) {
                if (! $columns[$column]['nullable'] || $columns[$column]['generation'] !== null) {
                    throw new LogicException("Templates ownership column [{$table}.{$column}] is not a nullable placeholder.");
                }
                $records->orWhereNotNull($column);
            }
            if ($records->exists()) {
                throw new LogicException("Templates table [{$table}] contains ownership values. Keep its owned configuration or resolve the data before migrating.");
            }
            foreach ([...$schema->getIndexes($table), ...$schema->getForeignKeys($table)] as $constraint) {
                if (array_intersect($placeholders, $constraint['columns']) !== []) {
                    throw new LogicException("Templates table [{$table}] has an ownership key or foreign key. Resolve its ownership before migrating.");
                }
            }
            $drop[$table] = $placeholders;
        }

        return $drop;
    }
};
