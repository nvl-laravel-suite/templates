<?php

declare(strict_types=1);

namespace Nvl\Templates\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Database\Migrations\Migrator;
use Illuminate\Database\Schema\Builder;
use Illuminate\Support\Facades\Schema;
use LogicException;
use Nvl\Support\Config\PackageStorage;
use Nvl\Templates\Support\Scope;
use PDO;
use PDOException;

/** Clears the known empty footprint left by the failed Templates 7.0.2 InnoDB migration. */
final class RecoverTemplatesDocumentSchema extends Command
{
    protected $signature = 'nvl:templates:schema:recover
        {--database= : Connection holding the Laravel migration repository}
        {--apply : Remove the verified empty tables so the corrected migration can run}';

    protected $description = 'Recover the interrupted Templates 7.0.2 MySQL document installation';

    private const string GraphMigrationSuffix = '_nvl_templates_create_document_graph';

    private const array RootTables = ['groups', 'templates', 'resources'];

    public function handle(Migrator $migrator): int
    {
        $database = $this->option('database') ?? config()->string('database.default');

        try {
            if (! is_string($database) || $database === '') {
                throw new LogicException('The migration repository connection must be a configured connection name.');
            }

            return $migrator->usingConnection($database, fn (): int => $this->recover($migrator));
        } catch (LogicException|PDOException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }

    private function recover(Migrator $migrator): int
    {
        $schema = Schema::connection(PackageStorage::connection('templates'));
        $connection = $schema->getConnection();
        if ($connection->getDriverName() !== 'mysql') {
            throw new LogicException('Templates 7.0.2 recovery requires a MySQL connection.');
        }

        $repository = $migrator->getRepository();
        $hasRepository = $repository->repositoryExists();
        $ran = $hasRepository ? $repository->getRan() : [];
        $namespace = $connection->getDatabaseName();
        $qualify = static fn (string $key): string => self::qualify($namespace, Scope::table($key));
        $configured = array_map($qualify, array_keys(config()->array('nvl-templates.tables')));
        $existing = array_values(array_filter($configured, static fn (string $table): bool => $schema->getColumnListing($table) !== []));
        if ($existing === [] || array_any($ran, static fn (string $name): bool => str_ends_with($name, self::GraphMigrationSuffix))) {
            $this->info('No pending Templates document graph requires recovery.');

            return self::SUCCESS;
        }

        $tables = array_map($qualify, self::RootTables);
        if (! $hasRepository || array_diff($existing, $tables) !== [] || array_diff($tables, $existing) !== []) {
            throw new LogicException('The existing tables and migration history do not match the interrupted Templates 7.0.2 graph.');
        }

        if (! $this->option('apply')) {
            $this->assertInterruptedGraph($schema, $tables);
            $this->info('Dry run verified the empty interrupted Templates tables '.implode(', ', $tables).'.');

            return self::SUCCESS;
        }

        $pdo = $connection->getPdo();
        if (! $pdo instanceof PDO || $pdo->inTransaction() || $connection->transactionLevel() !== 0
            || ! in_array($connection->scalar('select @@session.foreign_key_checks', [], false), [1, '1', true], true)) {
            throw new LogicException('Templates recovery requires foreign key checks and no active database transaction.');
        }

        $quoted = array_map($connection->getQueryGrammar()->wrapTable(...), $tables);
        $locks = array_map(static fn (string $table): string => $table.' WRITE', $quoted);
        if ($pdo->exec('LOCK TABLES '.implode(', ', $locks)) === false) {
            throw new LogicException('Templates recovery could not lock the interrupted tables.');
        }
        try {
            $this->assertInterruptedGraph($schema, $tables);
            if ($connection->getRawPdo() !== $pdo) {
                throw new LogicException('Templates recovery lost its locked MySQL session.');
            }
            if ($pdo->exec('DROP TABLE '.implode(', ', array_reverse($quoted))) === false) {
                throw new LogicException('Templates recovery could not remove the interrupted tables.');
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

        $this->info('Removed the empty Templates 7.0.2 footprint. Run the corrected Templates migrations.');

        return self::SUCCESS;
    }

    private static function qualify(string $namespace, string $table): string
    {
        return str_contains($table, '.') ? $table : $namespace.'.'.$table;
    }

    /** @param  array{string, string, string}  $tables */
    private function assertInterruptedGraph(Builder $schema, array $tables): void
    {
        $connection = $schema->getConnection();
        $identities = array_map(function (string $table) use ($schema, $connection): array {
            [$namespace, $name] = $schema->parseSchemaAndTable($table, true);

            return [$namespace, $connection->getTablePrefix().$name];
        }, $tables);
        [$groups, $templates] = $identities;
        foreach ($tables as $position => $table) {
            $identity = $identities[$position];
            if (! $this->canInspectTriggers($connection, $identity)) {
                throw new LogicException("Templates recovery needs MySQL TRIGGER metadata visibility for [{$table}].");
            }
            $physical = $connection->select(
                "select 1 from information_schema.tables where table_schema = ? and table_name = ? and table_type = 'BASE TABLE' and engine = 'InnoDB' and left(table_collation, 8) = 'utf8mb4_'",
                $identity,
                false,
            );
            $triggers = $connection->select(
                'select trigger_name from information_schema.triggers where event_object_schema = ? and event_object_table = ?',
                $identity,
                false,
            );
            $unexpectedReferences = $connection->select(
                'select 1 from information_schema.key_column_usage where referenced_table_schema = ? and referenced_table_name = ? and not (table_schema = ? and table_name = ? and ? = 1)',
                [...$identity, ...$templates, $position === 0 ? 1 : 0],
                false,
            );
            $unexpectedChecks = $connection->select(
                "select 1 from information_schema.table_constraints where table_schema = ? and table_name = ? and constraint_type = 'CHECK'",
                $identity,
                false,
            );
            if ($physical === [] || $triggers !== [] || $unexpectedReferences !== [] || $unexpectedChecks !== []
                || ! $this->matchesStructure($schema, $table, self::RootTables[$position], $groups)
                || $connection->table($table)->useWritePdo()->exists()) {
                throw new LogicException("Table [{$table}] does not match the empty Templates 7.0.2 footprint.");
            }
        }
    }

    /** @param  array{string|null, string}  $identity */
    private function canInspectTriggers(Connection $connection, array $identity): bool
    {
        return $connection->select(
            <<<'SQL'
                with active_accounts as (
                    select concat(quote(left(current_user(), length(current_user()) - length(substring_index(current_user(), '@', -1)) - 1)), '@', quote(substring_index(current_user(), '@', -1))) as grantee
                    union select concat(quote(role_name), '@', quote(role_host)) from information_schema.enabled_roles
                ), trigger_grants as (
                    select grantee from information_schema.user_privileges where privilege_type = 'TRIGGER' and @@global.partial_revokes = 0
                    union select grantee from information_schema.schema_privileges where privilege_type = 'TRIGGER' and table_schema = ?
                    union select grantee from information_schema.table_privileges where privilege_type = 'TRIGGER' and table_schema = ? and table_name = ?
                )
                select 1 from active_accounts join trigger_grants using (grantee) limit 1
                SQL,
            [$identity[0], ...$identity],
            false,
        ) !== [];
    }

    /** @param  array{string|null, string}  $groups */
    private function matchesStructure(Builder $schema, string $table, string $kind, array $groups): bool
    {
        $expected = [
            'id' => ['char(36)', false], 'scope_id' => ['varchar(128)', false], 'owner_scope_key' => ['varchar(191)', true],
            'owner_reference' => ['text', true], 'created_at' => ['timestamp', true], 'updated_at' => ['timestamp', true],
            'key' => ['varchar(255)', false], 'name' => ['varchar(255)', false], 'status' => ['varchar(255)', false, 'active'],
            'version' => ['int unsigned', false, '0'], 'current_revision_id' => ['char(36)', true],
        ];
        if ($kind === 'templates') {
            $expected['group_id'] = ['char(36)', true];
        } elseif ($kind === 'resources') {
            $expected += [
                'kind' => ['varchar(255)', false], 'scope' => ['varchar(255)', false], 'owner_key' => ['varchar(255)', false],
                'group_id' => ['char(36)', true], 'template_id' => ['char(36)', true],
            ];
        }

        $columns = $schema->getColumns($table);
        if (array_column($columns, 'name') !== array_keys($expected)) {
            return false;
        }
        foreach ($columns as $column) {
            [$type, $nullable] = $expected[$column['name']];
            $default = $expected[$column['name']][2] ?? null;
            $actualDefault = is_int($column['default']) ? (string) $column['default'] : $column['default'];
            if ($column['type'] !== $type || $column['nullable'] !== $nullable || $actualDefault !== $default
                || $column['generation'] !== null || $column['auto_increment'] || $column['comment'] !== null) {
                return false;
            }
        }

        $indexes = ['primary:id', 'unique:scope_id,id'];
        if ($kind !== 'resources') {
            $indexes[] = 'unique:scope_id,key';
        }
        if ($kind === 'templates') {
            $indexes[] = 'index:scope_id,group_id';
        }
        $actualIndexes = array_map(
            static fn (array $index): string => ($index['primary'] ? 'primary' : ($index['unique'] ? 'unique' : 'index')).':'.implode(',', $index['columns']),
            $schema->getIndexes($table),
        );
        sort($indexes);
        sort($actualIndexes);
        if ($indexes !== $actualIndexes) {
            return false;
        }

        $foreignKeys = $schema->getForeignKeys($table);
        if ($kind !== 'templates') {
            return $foreignKeys === [];
        }

        return count($foreignKeys) === 1 && $foreignKeys[0]['columns'] === ['scope_id', 'group_id']
            && [$foreignKeys[0]['foreign_schema'], $foreignKeys[0]['foreign_table']] === $groups
            && $foreignKeys[0]['foreign_columns'] === ['scope_id', 'id'] && $foreignKeys[0]['on_delete'] === 'restrict';
    }
}
