<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Support;

use Closure;
use Illuminate\Contracts\Console\Kernel;
use PDO;

/**
 * Snapshots a migrated in-memory SQLite schema once per test class/provider graph and replays its DDL into fresh connections.
 */
trait MigratesInMemorySqlite
{
    /** @var array<string, string> */
    private static array $sqliteSchemaSnapshots = [];

    protected function migrateInMemorySqlite(?Closure $afterMigrate = null): void
    {
        $connection = $this->app['db']->connection();
        if ($connection->getDriverName() !== 'sqlite'
            || $connection->getDatabaseName() !== ':memory:'
            || $connection->getTablePrefix() !== '') {
            $this->artisan('migrate', ['--force' => true])->assertSuccessful();
            if ($afterMigrate !== null) {
                $afterMigrate();
            }

            return;
        }

        $key = static::class.':'.md5(serialize($this->getPackageProviders($this->app)));
        $pdo = $connection->getPdo();

        if (isset(self::$sqliteSchemaSnapshots[$key])) {
            $pdo->exec(self::$sqliteSchemaSnapshots[$key]);

            return;
        }

        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $this->app[Kernel::class]->setArtisan(null);
        if ($afterMigrate !== null) {
            $afterMigrate();
        }

        $statements = [];
        $tables = $pdo->query(
            "select name, sql from sqlite_master where type = 'table' and sql is not null and name not like 'sqlite_%' order by rowid",
        )->fetchAll(PDO::FETCH_ASSOC);
        foreach ($tables as $table) {
            $statements[] = (string) $table['sql'];
        }

        foreach ($tables as $table) {
            $quotedTable = '"'.str_replace('"', '""', (string) $table['name']).'"';
            foreach ($pdo->query('select * from '.$quotedTable)->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $columns = array_map(
                    static fn (string $column): string => '"'.str_replace('"', '""', $column).'"',
                    array_keys($row),
                );
                $values = array_map(
                    static fn (mixed $value): string => match (true) {
                        $value === null => 'NULL',
                        is_int($value), is_float($value) => (string) $value,
                        is_bool($value) => $value ? '1' : '0',
                        default => $pdo->quote((string) $value),
                    },
                    array_values($row),
                );
                $statements[] = sprintf(
                    'insert into %s (%s) values (%s)',
                    $quotedTable,
                    implode(', ', $columns),
                    implode(', ', $values),
                );
            }
        }

        $objects = $pdo->query(
            "select sql from sqlite_master where type <> 'table' and sql is not null and name not like 'sqlite_%' order by rowid",
        )->fetchAll(PDO::FETCH_COLUMN);
        foreach ($objects as $sql) {
            $statements[] = (string) $sql;
        }

        self::$sqliteSchemaSnapshots[$key] = implode(";\n", $statements);
    }
}
