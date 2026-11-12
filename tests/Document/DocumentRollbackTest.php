<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use LogicException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Services\RenderRequests;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Services\TemplateCatalog;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\Tests\CanonicalTestCase;
use Nvl\Templates\Tests\Support\DocumentClient;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class DocumentRollbackTest extends CanonicalTestCase
{
    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $app['config']->set([
            'nvl-media.disk' => 'local', 'nvl-media.private_disk' => 'local',
            'nvl-media.allowed_disks' => ['local'],
            'nvl-media.delivery.disks.local' => ['public' => false, 'private' => ['mode' => 'application', 'allowed' => ['application']]],
        ]);
        $driver = getenv('NVL_C1_TEST_DRIVER');
        if (is_string($driver) && $driver !== '') {
            $database = (string) getenv('DB_DATABASE');
            self::validateNativeDatabase($driver, $database);
            $app['config']->set([
                'database.default' => $driver,
                'database.connections.'.$driver.'.url' => null,
                'database.connections.'.$driver.'.database' => $database,
                'nvl-core.connection' => $driver,
            ]);

            return;
        }
        $database = getenv('NVL_TEMPLATES_PG_TEST_DATABASE');
        if ($database === false || $database === '') {
            return;
        }
        if (! is_string($database) || ! preg_match('/\Anvl_own_test_templates_[a-z0-9]+\z/D', $database)) {
            throw new \RuntimeException('A dedicated temporary Templates test database is required.');
        }
        $app['config']->set([
            'database.default' => 'pgsql',
            'database.connections.pgsql' => ['driver' => 'pgsql', 'host' => '/tmp', 'port' => 5432, 'database' => $database, 'username' => get_current_user(), 'password' => '', 'charset' => 'utf8', 'prefix' => '', 'search_path' => 'public', 'sslmode' => 'prefer'],
            'nvl-core.connection' => 'pgsql',
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        if (getenv('NVL_C1_TEST_DRIVER')) {
            $connection = DB::connection();
            self::validateNativeDatabase($connection->getDriverName(), $connection->getDatabaseName());
            $connection->getSchemaBuilder()->dropAllTables();
        }
    }

    private static function validateNativeDatabase(string $driver, string $database): void
    {
        if (! in_array($driver, ['pgsql', 'mysql', 'mariadb'], true)
            || preg_match('/\Anvl_templates_test_[a-f0-9]{8}_ci\z/D', $database) !== 1) {
            throw new InvalidArgumentException('Native Templates checks require the runner-owned disposable database.');
        }
    }

    public function test_native_publication_and_full_document_rollback_with_live_revision_pointers(): void
    {
        $driver = getenv('NVL_C1_TEST_DRIVER') ?: (getenv('NVL_TEMPLATES_PG_TEST_DATABASE') ? 'pgsql' : 'sqlite');
        self::assertSame($driver, DB::connection()->getDriverName());
        $paths = glob(__DIR__.'/../../database/document-migrations/*.php');
        foreach ($paths as $path) {
            (require $path)->up();
        }
        $api = app(DocumentClient::class);
        $family = $api->createGroup('pg-family', 'PostgreSQL family');
        $base = $api->publishGroup($family->id, Documents::standalone('Family'), 0);
        $template = $api->createTemplate('pg-template', 'PostgreSQL template');
        $draft = $api->saveDraft($template->id, Documents::standalone('Template'), 0);
        $revision = $api->publish($template->id, $draft->version);
        self::assertNotNull($base->id);
        self::assertNotNull($revision->id);
        foreach (array_reverse($paths) as $path) {
            (require $path)->down();
        }
        foreach (config('nvl-templates.tables') as $table) {
            self::assertFalse(Schema::hasTable($table));
        }
    }

    public function test_family_publication_personalization_and_outer_rollback_use_the_selected_database(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $api = app(DocumentClient::class);
        $family = $api->createGroup('native-family', 'Native family');
        $api->publishGroup($family->id, Documents::standalone('Family'), 0);
        $template = $api->createTemplate('native-variant', 'Native variant', $family->id);
        $draft = $api->saveDraft($template->id, Documents::variant($family->id, 1, 'Published'), 0);
        $revision = $api->publish($template->id, $draft->version);
        $output = $api->render($revision->id, ['code' => 'SQL-1'], [], ['message' => 'For <Nicolas>']);
        self::assertStringContainsString('Published', $output->html);
        self::assertStringContainsString('For &lt;Nicolas&gt;', $output->html);

        $connection = DB::connection();
        $connection->beginTransaction();
        try {
            $next = $api->saveDraft($template->id, Documents::variant($family->id, 1, 'Uncommitted'), 1);
            $candidate = $api->publish($template->id, $next->version);
            self::assertNotSame($revision->id, $candidate->id);
        } finally {
            $connection->rollBack();
        }
        self::assertSame($revision->id, $api->getTemplate($template->id)->current_revision_id);
        self::assertFalse(TemplateRevision::query()->whereKey($candidate->id)->exists());
        self::assertStringContainsString('Published', $api->render($revision->id, ['code' => 'SQL-2'])->html);
    }

    public function test_retained_media_and_rollback_remain_atomic_on_the_selected_database(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $assets = app(TemplateAssets::class);
        $connection = DB::connection();
        $connection->beginTransaction();
        try {
            $asset = $assets->upload(UploadedFile::fake()->image('rollback.png', 2, 2), SystemActor::Background);
            self::assertTrue(TemplateAsset::query()->whereKey($asset->id)->exists());
        } finally {
            $connection->rollBack();
        }
        self::assertSame(0, TemplateAsset::query()->count());
        self::assertSame([], Storage::disk('local')->allFiles());
        $asset = $assets->upload(UploadedFile::fake()->image('retained.png', 2, 2), SystemActor::Background);
        [$stored, $bytes] = $assets->contents($asset->id, SystemActor::Background);
        self::assertSame($asset->id, $stored->id);
        self::assertSame($asset->checksum, hash('sha256', $bytes));
    }

    public function test_malformed_identities_are_not_found_on_the_selected_database(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $actor = SystemActor::Background;
        foreach ([
            'template' => fn () => app(TemplateReader::class)->get('not-a-uuid', $actor),
            'revision' => fn () => app(TemplateRenderer::class)->render('not-a-uuid', [], $actor),
            'asset' => fn () => app(TemplateAssets::class)->contents('not-a-uuid', $actor),
            'render' => fn () => app(RenderRequests::class)->get('not-a-uuid', $actor),
            'family' => fn () => app(TemplateCatalog::class)->groupRevision('not-a-uuid', 1, $actor),
        ] as $kind => $lookup) {
            try {
                $lookup();
                self::fail('A malformed '.$kind.' identity was found.');
            } catch (ModelNotFoundException) {
                self::addToAssertionCount(1);
            }
        }

        // A stored draft that references a malformed resource must stay readable for repair.
        $api = app(DocumentClient::class);
        $template = $api->createTemplate('malformed-reference', 'Malformed reference');
        $document = Documents::standalone();
        $document['dependencies'] = [['resourceId' => 'not-a-uuid', 'revision' => 1]];
        $api->saveDraft($template->id, $document, 0);
        $issues = app(TemplateReader::class)->load($template->id, $actor)['issues'];
        self::assertSame(['resources'], array_column($issues, 'path'));
    }

    public function test_the_asset_catalog_lists_retained_images_on_the_selected_database(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $asset = app(TemplateAssets::class)->upload(UploadedFile::fake()->image('listed.png', 2, 2), SystemActor::Background);
        $page = app(TemplateCatalog::class)->assets([], SystemActor::Background);
        self::assertSame([$asset->id], $page->getCollection()->pluck('id')->all());
    }

    public function test_native_cleanup_refuses_host_and_other_package_database_names(): void
    {
        foreach (['production', 'nvl_media_test_12345678_ci', 'nvl_templates_test_ci'] as $database) {
            try {
                self::validateNativeDatabase('pgsql', $database);
                self::fail('A non-disposable Templates database was accepted.');
            } catch (InvalidArgumentException $error) {
                self::assertStringContainsString('runner-owned disposable', $error->getMessage());
            }
        }
    }

    public function test_placeholder_upgrade_preserves_documents_and_can_be_retried(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $this->addLegacyOwnershipPlaceholders();
        $template = app(DocumentClient::class)->createTemplate('prior-document', 'Prior document');
        $schema = DB::connection()->getSchemaBuilder();
        $schema->table(TemplatesTables::Groups, static fn (Blueprint $table) => $table->dropColumn('owner_reference'));

        $migration = require __DIR__.'/../../database/document-migrations/2026_11_12_000001_nvl_templates_remove_unscoped_ownership_columns.php';
        $migration->up();
        $migration->up();
        foreach (config('nvl-templates.tables') as $table) {
            self::assertFalse($schema->hasColumn($table, 'owner_scope_key'));
            self::assertFalse($schema->hasColumn($table, 'owner_reference'));
        }
        self::assertSame($template->id, app(DocumentClient::class)->getTemplate($template->id)->id);
        $this->artisan('nvl:templates:doctor', ['--strict' => true, '--scope' => 'database'])->assertSuccessful();
    }

    #[DataProvider('protectedPlaceholders')]
    public function test_placeholder_upgrade_checks_all_tables_before_removing_columns(string $protection): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $this->addLegacyOwnershipPlaceholders();
        if ($protection === 'value') {
            $template = app(DocumentClient::class)->createTemplate('prior-document', 'Prior document');
            DB::table(TemplatesTables::FamilyChanges)->insert([
                'id' => '3202bd1f-5079-497b-943e-846c80599adb', 'scope_id' => 'app', 'template_id' => $template->id,
                'operation' => 'detach', 'expected_version' => 0, 'source_checksum' => hash('sha256', '{}'),
                'inputs' => '{}', 'result' => '{}', 'owner_reference' => '{}',
            ]);
        } else {
            Schema::table(TemplatesTables::FamilyChanges, static fn (Blueprint $table) => $table->index('owner_scope_key', 'host_owner_index'));
        }

        $migration = require __DIR__.'/../../database/document-migrations/2026_11_12_000001_nvl_templates_remove_unscoped_ownership_columns.php';
        try {
            $migration->up();
            self::fail('The migration must refuse in-use ownership columns.');
        } catch (LogicException $exception) {
            self::assertStringContainsString(TemplatesTables::FamilyChanges, $exception->getMessage());
        }
        foreach (config('nvl-templates.tables') as $table) {
            self::assertTrue(Schema::hasColumns($table, ['owner_scope_key', 'owner_reference']));
        }
    }

    /** @return iterable<string, array{string}> */
    public static function protectedPlaceholders(): iterable
    {
        yield 'non-null ownership value' => ['value'];
        yield 'ownership index' => ['index'];
    }

    private function addLegacyOwnershipPlaceholders(): void
    {
        foreach (config('nvl-templates.tables') as $table) {
            Schema::table($table, static function (Blueprint $blueprint): void {
                $blueprint->string('owner_scope_key', 191)->nullable();
                $blueprint->text('owner_reference')->nullable();
            });
        }
    }

    public function test_recovers_the_empty_templates_7_0_2_mysql_failure_before_retrying_migration(): void
    {
        $this->createInterruptedDocumentGraph();
        Schema::create('host_upgrade_seed', static fn (Blueprint $table) => $table->string('value'));
        DB::table('host_upgrade_seed')->insert(['value' => 'retained']);

        $this->artisan('nvl:templates:schema:recover')->expectsOutputToContain('Dry run')->assertSuccessful();
        self::assertTrue(Schema::hasTable(TemplatesTables::Resources));
        $this->artisan('nvl:templates:schema:recover', ['--apply' => true])->assertSuccessful();
        self::assertFalse(Schema::hasTable(TemplatesTables::Resources));
        self::assertFalse(Schema::hasTable(TemplatesTables::Templates));
        self::assertFalse(Schema::hasTable(TemplatesTables::Groups));

        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        self::assertTrue(Schema::hasIndex(TemplatesTables::Resources, ['scope_id', 'kind', 'owner_key', 'key'], 'unique'));
        self::assertSame('retained', DB::table('host_upgrade_seed')->value('value'));
        $this->artisan('nvl:templates:schema:recover', ['--apply' => true])->assertSuccessful();
        self::assertTrue(Schema::hasTable(TemplatesTables::Resources));
    }

    public function test_recovery_cannot_drop_tables_after_losing_its_mysql_lock_session(): void
    {
        $this->createInterruptedDocumentGraph();
        $source = DB::connection();
        $session = $source->scalar('select connection_id()', [], false);
        self::assertIsInt($session);
        config(['database.connections.templates_recovery_peer' => $source->getConfig()]);
        $peer = DB::connection('templates_recovery_peer');
        $interrupted = false;
        $source->listen(static function (QueryExecuted $query) use ($source, $peer, $session, &$interrupted): void {
            if ($interrupted || $query->connection !== $source || ! str_starts_with($query->sql, 'select exists(')
                || ! str_contains($query->sql, '`nvl_templates_resources`')) {
                return;
            }
            $interrupted = true;
            $peer->unprepared('KILL CONNECTION '.$session);
            $peer->table(TemplatesTables::Groups)->insert([
                'id' => 'a59ec01d-e44b-4921-89d1-baf0022170a9', 'scope_id' => 'app', 'key' => 'late', 'name' => 'Late insert',
            ]);
        });

        $this->artisan('nvl:templates:schema:recover', ['--apply' => true])->assertFailed();
        self::assertTrue($interrupted);
        self::assertSame('Late insert', $peer->table(TemplatesTables::Groups)->value('name'));
        self::assertTrue($peer->getSchemaBuilder()->hasTable(TemplatesTables::Resources));
    }

    #[DataProvider('unsafeRecoveryFootprints')]
    public function test_refuses_to_recover_an_unverified_document_footprint(string $change): void
    {
        $this->createInterruptedDocumentGraph();
        match ($change) {
            'row' => DB::table(TemplatesTables::Groups)->insert([
                'id' => '109e65ee-29cb-4ecb-8a5c-afad31e38bc4', 'scope_id' => 'app', 'key' => 'retain', 'name' => 'Retain',
            ]),
            'index' => Schema::table(TemplatesTables::Resources, static fn (Blueprint $table) => $table->index('name')),
            'trigger' => DB::unprepared('create trigger host_retained_group before insert on nvl_templates_groups for each row set NEW.name = NEW.name'),
            'dependent table' => Schema::create('host_group_reference', static function (Blueprint $table): void {
                $table->uuid('group_id');
                $table->foreign('group_id')->references('id')->on(TemplatesTables::Groups);
            }),
        };

        $this->artisan('nvl:templates:schema:recover', ['--apply' => true])->assertFailed();
        self::assertTrue(Schema::hasTable(TemplatesTables::Resources));
        self::assertTrue(Schema::hasTable(TemplatesTables::Templates));
        self::assertTrue(Schema::hasTable(TemplatesTables::Groups));
        if ($change === 'row') {
            self::assertSame('Retain', DB::table(TemplatesTables::Groups)->value('name'));
        }
    }

    /** @return iterable<string, array{string}> */
    public static function unsafeRecoveryFootprints(): iterable
    {
        foreach (['row', 'index', 'trigger', 'dependent table'] as $change) {
            yield $change => [$change];
        }
    }

    private function createInterruptedDocumentGraph(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            self::markTestSkipped('Templates 7.0.2 recovery requires a native MySQL database.');
        }
        $this->artisan('migrate:install')->assertSuccessful();

        try {
            foreach (['groups', 'templates', 'resources'] as $key) {
                Schema::create(TemplatesTables::get($key), static function (Blueprint $table) use ($key): void {
                    $table->charset('utf8mb4');
                    $table->engine('InnoDB');
                    $table->uuid('id')->primary();
                    $table->string('scope_id', 128);
                    $table->string('owner_scope_key', 191)->nullable();
                    $table->text('owner_reference')->nullable();
                    $table->timestamps();
                    $table->unique(['scope_id', 'id']);
                    $table->string('key', 255);
                    $table->string('name', 255);
                    $table->string('status', 255)->default('active');
                    $table->unsignedInteger('version')->default(0);
                    $table->uuid('current_revision_id')->nullable();
                    if ($key === 'resources') {
                        $table->string('kind', 255);
                        $table->string('scope', 255);
                        $table->string('owner_key', 255);
                        $table->uuid('group_id')->nullable();
                        $table->uuid('template_id')->nullable();
                        $table->unique(['scope_id', 'kind', 'owner_key', 'key'], 'tpl_resource_key');
                    } else {
                        if ($key === 'templates') {
                            $table->uuid('group_id')->nullable();
                            $table->foreign(['scope_id', 'group_id'])->references(['scope_id', 'id'])->on(TemplatesTables::Groups)->restrictOnDelete();
                        }
                        $table->unique(['scope_id', 'key']);
                    }
                });
            }
            self::fail('Expected the published Templates index to exceed the InnoDB limit.');
        } catch (QueryException $exception) {
            self::assertSame(1071, $exception->errorInfo[1]);
            self::assertStringContainsString('tpl_resource_key', $exception->getSql());
        }
    }
}
