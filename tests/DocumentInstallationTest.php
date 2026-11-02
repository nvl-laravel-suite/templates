<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;

final class DocumentInstallationTest extends TestCase
{
    protected function getPackageProviders($app): array
    {
        return [LocaleServiceProvider::class, TranslatableServiceProvider::class, TemplatesServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite.database', ':memory:');
        $app['config']->set('database.connections.documents', ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']);
    }

    public function test_document_migrations_use_the_actual_configured_connection(): void
    {
        config(['nvl-templates.connection' => 'documents']);
        foreach (glob(__DIR__.'/../database/document-migrations/*.php') as $path) {
            self::assertSame('documents', (require $path)->getConnection());
        }
    }

    public function test_suite_connection_default_installs_the_complete_graph_on_the_same_connection_as_models(): void
    {
        config(['nvl-core.connection' => 'documents']);
        foreach (glob(__DIR__.'/../database/document-migrations/*.php') as $path) {
            $migration = require $path;
            self::assertSame('documents', $migration->getConnection());
            $migration->up();
        }
        self::assertTrue(Schema::connection('documents')->hasTable('nvl_templates_templates'));
        self::assertFalse(Schema::connection('sqlite')->hasTable('nvl_templates_templates'));
    }

    public function test_inherited_resources_keep_native_parent_keys_and_scoped_tuple_keys(): void
    {
        foreach (glob(__DIR__.'/../database/document-migrations/*.php') as $path) {
            (require $path)->up();
        }
        foreach ([['group_revisions', 'group_id', 'groups'], ['drafts', 'template_id', 'templates'], ['revisions', 'template_id', 'templates'], ['resource_revisions', 'resource_id', 'resources'], ['renders', 'template_revision_id', 'revisions'], ['family_changes', 'template_id', 'templates']] as [$table, $key, $parent]) {
            $foreignKeys = Schema::getForeignKeys('nvl_templates_'.$table);
            self::assertNotEmpty(array_filter($foreignKeys, static fn (array $foreign): bool => $foreign['columns'] === [$key] && $foreign['foreign_table'] === 'nvl_templates_'.$parent && $foreign['foreign_columns'] === ['id']), $table.' native parent');
            self::assertNotEmpty(array_filter($foreignKeys, static fn (array $foreign): bool => $foreign['columns'] === ['scope_id', $key] && $foreign['foreign_table'] === 'nvl_templates_'.$parent), $table.' scoped parent');
        }
    }

    public function test_render_rollback_does_not_write_to_the_default_connection_when_inheriting_the_suite_source(): void
    {
        config(['nvl-core.connection' => 'documents']);
        $paths = glob(__DIR__.'/../database/document-migrations/*.php');
        foreach ($paths as $path) {
            (require $path)->up();
        }
        Schema::connection('sqlite')->create('nvl_templates_renders', static function (Blueprint $table): void {
            $table->integer('id')->primary();
            $table->text('snapshot')->nullable();
        });
        DB::connection('sqlite')->table('nvl_templates_renders')->insert(['id' => 7, 'snapshot' => null]);
        (require $paths[2])->down();
        self::assertNull(DB::connection('sqlite')->table('nvl_templates_renders')->where('id', 7)->value('snapshot'));
        self::assertFalse(Schema::connection('documents')->hasColumn('nvl_templates_renders', 'generation'));
    }

    public function test_default_constraint_names_fit_all_supported_database_identifier_limits(): void
    {
        foreach (glob(__DIR__.'/../database/document-migrations/*.php') as $path) {
            (require $path)->up();
        }
        foreach (config('nvl-templates.tables') as $table) {
            foreach ([...Schema::getIndexes($table), ...Schema::getForeignKeys($table)] as $constraint) {
                if (is_string($constraint['name'])) {
                    self::assertLessThanOrEqual(63, strlen($constraint['name']), $constraint['name']);
                }
            }
        }
    }

    public function test_complete_document_graph_rolls_back_on_its_source_connection(): void
    {
        config(['nvl-core.connection' => 'documents']);
        $paths = glob(__DIR__.'/../database/document-migrations/*.php');
        foreach ($paths as $path) {
            (require $path)->up();
        }
        foreach (array_reverse($paths) as $path) {
            (require $path)->down();
        }
        foreach (config('nvl-templates.tables') as $table) {
            self::assertFalse(Schema::connection('documents')->hasTable($table));
        }
    }

    public function test_legacy_collision_is_detected_before_any_document_table_is_created(): void
    {
        Schema::create('nvl_templates_templates', static function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('renderer');
        });
        $connection = $this->app['db']->connection();
        $connection->table('nvl_templates_templates')->insert(['id' => 'preserved', 'renderer' => 'blade']);
        try {
            (require glob(__DIR__.'/../database/document-migrations/*.php')[0])->up();
            self::fail('An existing legacy schema must require explicit reviewed adoption.');
        } catch (\LogicException $exception) {
            self::assertStringContainsString('legacy', $exception->getMessage());
        }
        self::assertFalse(Schema::hasTable('nvl_templates_groups'));
        self::assertSame('blade', $connection->table('nvl_templates_templates')->value('renderer'));
    }
}
