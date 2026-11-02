<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Migrations\Migrator;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use LogicException;
use Nvl\Support\Schema\SchemaIdentities;
use Nvl\Support\Schema\SchemaMigrationPaths;
use Nvl\Support\Schema\SchemaPreflight;
use Nvl\Support\Schema\SchemaShape;
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Tests\CanonicalTestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/** @phpstan-import-type PackageIdentity from SchemaIdentities */
final class SchemaIdentityTest extends CanonicalTestCase
{
    private const array TABLES = [
        'groups', 'group_revisions', 'templates', 'drafts', 'revisions',
        'resources', 'resource_revisions', 'assets', 'renders', 'family_changes',
    ];

    private const array MIGRATIONS = [
        '2026_11_02_000001_nvl_templates_create_document_graph',
        '2026_11_02_000002_nvl_templates_add_family_workflows',
        '2026_11_02_000003_nvl_templates_add_render_execution',
    ];

    public function test_manifest_describes_every_real_document_column_key_and_foreign_key(): void
    {
        self::assertSame(0, Artisan::call('migrate', ['--force' => true]));
        $manifest = $this->identity();
        self::assertSame(self::TABLES, array_keys($manifest['tables']));
        $schema = DB::connection()->getSchemaBuilder();
        foreach ($manifest['tables'] as $key => $identity) {
            $table = TemplatesTables::get($key);
            self::assertSame($identity['default'], $identity['legacy'], 'Document ownership must not claim historical Blade storage.');
            self::assertSame(array_keys($identity['columns']), $schema->getColumnListing($table));
            self::assertCount(count($schema->getIndexes($table)), $identity['keys'], $key.' keys must be complete.');
            self::assertCount(count($schema->getForeignKeys($table)), $identity['foreign_keys'], $key.' foreign keys must be complete.');
            SchemaShape::assertCompatible($schema, $table, $identity['columns'], $identity['keys'], $identity['foreign_keys']);
        }
    }

    public function test_native_identity_recognizes_only_the_three_executable_document_migrations(): void
    {
        $manifest = $this->identity();
        self::assertSame(self::MIGRATIONS, array_keys($manifest['migrations']));
        $paths = new SchemaMigrationPaths;
        foreach ($manifest['migrations'] as $name => $migration) {
            $path = $this->packageRoot().'/'.$migration['path'];
            self::assertSame($name, $migration['name']);
            self::assertSame(hash_file('sha256', $path), $migration['legacy_checksum']);
            self::assertNull($migration['previous_checksum']);
            self::assertSame([
                'package' => 'templates', 'name' => $name, 'legacy' => $name,
                'path' => realpath($path), 'canonical' => realpath($path),
                'published' => false, 'current' => true, 'recorded' => null,
            ], $paths->identity($path));
        }
        $migrator = app('migrator');
        self::assertInstanceOf(Migrator::class, $migrator);
        $loaded = $migrator->paths();
        self::assertContains($this->packageRoot().'/database/document-migrations', $loaded);
        self::assertNotContains($this->packageRoot().'/database/migrations', $loaded);
        self::assertNotContains($this->packageRoot().'/database/tenancy-migrations', $loaded);
        foreach (glob($this->packageRoot().'/database/migrations/*.php') ?: [] as $path) {
            self::assertNull($paths->identity($path), 'Archived engine creators are not new document ownership proof.');
        }
    }

    public function test_native_preflight_checks_the_entire_batch_before_any_document_table_is_created(): void
    {
        Schema::create(TemplatesTables::FamilyChanges, function (Blueprint $table): void {
            $table->id();
            $table->string('host_payload');
        });
        try {
            app(SchemaPreflight::class)->validate($this->migrationPaths());
            self::fail('An existing late target must reject the complete native migration batch.');
        } catch (LogicException $error) {
            self::assertStringContainsString(TemplatesTables::FamilyChanges, $error->getMessage());
        }
        self::assertFalse(Schema::hasTable(TemplatesTables::Groups));
        self::assertFalse(Schema::hasTable(TemplatesTables::Templates));
        self::assertSame(['id', 'host_payload'], Schema::getColumnListing(TemplatesTables::FamilyChanges));
    }

    public function test_configured_targets_use_the_same_native_preflight_boundary(): void
    {
        config()->set('nvl-templates.tables.renders', 'host_retained_renders');
        Schema::create(TemplatesTables::get('renders'), fn (Blueprint $table) => $table->id());
        foreach (['renders', 'Renders', TemplatesTables::Renders, 'host_retained_renders'] as $identity) {
            self::assertSame('host_retained_renders', TemplatesTables::get($identity));
        }
        try {
            app(SchemaPreflight::class)->validate($this->migrationPaths());
            self::fail('Configured storage collisions must be detected before graph creation.');
        } catch (LogicException $error) {
            self::assertStringContainsString('host_retained_renders', $error->getMessage());
        }
        self::assertFalse(Schema::hasTable(TemplatesTables::Groups));
        self::assertFalse(Schema::hasTable(TemplatesTables::Templates));
    }

    public function test_recorded_blade_creators_cannot_authorize_document_storage_or_silent_conversion(): void
    {
        Schema::create('migrations', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('migration');
            $table->integer('batch');
        });
        DB::table('migrations')->insert([
            'migration' => '2026_07_27_100001_nvl_templates_create_templates_table', 'batch' => 1,
        ]);
        Schema::create(TemplatesTables::Templates, function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('renderer')->default('blade');
            $table->text('source');
        });
        DB::table(TemplatesTables::Templates)->insert(['id' => 'legacy', 'source' => '<p>{{ $title }}</p>']);
        try {
            app(SchemaPreflight::class)->validate($this->migrationPaths());
            self::fail('Old creator history cannot prove ownership of the new document graph.');
        } catch (LogicException $error) {
            self::assertStringContainsString(TemplatesTables::Templates, $error->getMessage());
        }
        self::assertFalse(Schema::hasTable(TemplatesTables::Groups));
        self::assertFalse(Schema::hasTable(TemplatesTables::Drafts));
        self::assertSame('<p>{{ $title }}</p>', DB::table(TemplatesTables::Templates)->value('source'));
        $identity = $this->identity()['tables']['templates'];
        $this->expectException(LogicException::class);
        SchemaShape::assertCompatible(DB::connection()->getSchemaBuilder(), TemplatesTables::Templates, $identity['columns'], $identity['keys'], $identity['foreign_keys']);
    }

    #[DataProvider('incompatibleStorage')]
    public function test_native_shape_checks_reject_missing_columns_unique_keys_and_scope_foreign_keys(string $kind, string $key): void
    {
        self::assertSame(0, Artisan::call('migrate', ['--force' => true]));
        $table = TemplatesTables::get($key);
        Schema::table($table, function (Blueprint $blueprint) use ($kind): void {
            match ($kind) {
                'column' => $blueprint->dropColumn('owner_reference'),
                'unique' => $blueprint->dropUnique('tpl_resource_key'),
                'foreign' => $blueprint->dropForeign(['scope_id', 'group_id']),
                default => throw new LogicException('Unknown schema regression fixture.'),
            };
        });
        $identity = $this->identity()['tables'][$key];
        $this->expectException(LogicException::class);
        SchemaShape::assertCompatible(DB::connection()->getSchemaBuilder(), $table, $identity['columns'], $identity['keys'], $identity['foreign_keys']);
    }

    /** @return iterable<string,array{0:string,1:string}> */
    public static function incompatibleStorage(): iterable
    {
        yield 'missing owner column' => ['column', 'groups'];
        yield 'missing scoped resource uniqueness' => ['unique', 'resources'];
        yield 'missing composite family parent' => ['foreign', 'group_revisions'];
    }

    public function test_archived_engine_migrations_remain_byte_identical_and_do_not_claim_current_ownership(): void
    {
        $archived = [
            'database/migrations/2026_07_27_100000_nvl_templates_assert_template_schema_compatibility.php' => '575a33088c180e62a5e688dabdd09aa96489e88ead6b4bbffa5a4d5101fdd418',
            'database/migrations/2026_07_27_100001_nvl_templates_create_templates_table.php' => '281d5f1ea3989d2ed3df561497f9386c13ecb13188d7eee67bae3c1c91833b8d',
            'database/migrations/2026_07_27_100002_nvl_templates_create_templates_i18n_table.php' => '5d0509d174b2198d5870b00a268669f69c36fa3831d0627390cfd8ed0998b699',
            'database/migrations/2026_07_27_100003_nvl_templates_create_template_versions_table.php' => '56fc2fc58a23d8252f5342fc370b823c9117b588ab7758e2933ebb2c8a60cf04',
            'database/migrations/2026_07_27_100006_nvl_templates_create_template_assignments_table.php' => '1d142ea8090a4a12dd2cb5d0199676d1e774aa8cb841cb24b3d76d443e35e44b',
            'database/migrations/2026_07_27_100007_nvl_templates_create_template_renders_table.php' => '060c65a68ae3c063497b5b338f2fe8d262ba7812744f44fddb13a0bd48469c52',
            'database/tenancy-migrations/2026_09_16_180011_nvl_templates_add_templates_ownership.php' => 'e10bdf900d2478316f97f506f82cfe6ee62cbd7dc07929c6d489995d176d1e71',
            'database/tenancy-migrations/2026_09_16_180012_nvl_templates_create_template_tenant_grants.php' => 'ed8264b00ab7a3bb157401d15c134de7d2303b198669d8ba2239603a24d8c6a1',
        ];
        $paths = new SchemaMigrationPaths;
        foreach ($archived as $relative => $checksum) {
            $path = $this->packageRoot().'/'.$relative;
            self::assertSame($checksum, hash_file('sha256', $path));
            self::assertNull($paths->identity($path));
        }
    }

    public function test_creator_metadata_matches_the_tables_each_real_migration_actually_creates(): void
    {
        app(SchemaPreflight::class)->validate($this->migrationPaths());
        $schema = DB::connection()->getSchemaBuilder();
        $manifest = $this->identity();
        foreach ($manifest['migrations'] as $name => $identity) {
            $before = array_column($schema->getTables(), 'name');
            $migration = require $this->packageRoot().'/'.$identity['path'];
            self::assertInstanceOf(Migration::class, $migration);
            if (! method_exists($migration, 'up')) {
                self::fail('Each current document migration must declare its native up operation.');
            }
            $migration->up();
            $created = array_values(array_diff(array_column($schema->getTables(), 'name'), $before));
            $expected = array_map(static fn (string $key): string => TemplatesTables::get($key), $identity['creates']);
            sort($created);
            sort($expected);
            self::assertSame($expected, $created, $name.' must describe its actual creator set.');
            self::assertSame($created !== [], $identity['create']);
            foreach ($identity['creates'] as $key) {
                self::assertSame([$name], $manifest['tables'][$key]['create_migrations']);
            }
        }
    }

    public function test_preflight_and_current_migrations_inherit_the_native_core_connection(): void
    {
        config()->set('database.connections.document_store', ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]);
        config()->set('nvl-core.connection', 'document_store');
        config()->set('nvl-templates.connection', null);
        Schema::connection('document_store')->create(TemplatesTables::Groups, fn (Blueprint $table) => $table->id());
        foreach ($this->migrationPaths() as $path) {
            $migration = require $path;
            self::assertInstanceOf(Migration::class, $migration);
            self::assertSame('document_store', $migration->getConnection());
        }
        try {
            app(SchemaPreflight::class)->validate($this->migrationPaths());
            self::fail('Core-inherited document storage must be checked before default-connection DDL.');
        } catch (LogicException $error) {
            self::assertStringContainsString(TemplatesTables::Groups, $error->getMessage());
        }
        self::assertFalse(Schema::hasTable(TemplatesTables::Groups));
        self::assertFalse(Schema::hasTable(TemplatesTables::Templates));
        self::assertSame(['id'], Schema::connection('document_store')->getColumnListing(TemplatesTables::Groups));
    }

    /** @return PackageIdentity */
    private function identity(): array
    {
        $identity = SchemaIdentities::package('templates');
        if ($identity === []) {
            throw new LogicException('The native document schema identity must be registered.');
        }

        return $identity;
    }

    /** @return list<string> */
    private function migrationPaths(): array
    {
        return array_map(fn (string $name): string => $this->packageRoot().'/database/document-migrations/'.$name.'.php', self::MIGRATIONS);
    }

    private function packageRoot(): string
    {
        return dirname(__DIR__, 2);
    }
}
