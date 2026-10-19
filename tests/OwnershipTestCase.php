<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Foundation\MaintenanceMode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Nvl\Content\Actions\SyncContentDefinitionsAction;
use Nvl\Content\Data\ContentActorData;
use Nvl\Content\Models\ContentBlock;
use Nvl\Content\Providers\ContentServiceProvider;
use Nvl\Data\Providers\DataServiceProvider;
use Nvl\Media\Providers\MediaServiceProvider;
use Nvl\Ownership\Contracts\CentralAccess;
use Nvl\Ownership\Contracts\OwnerAccess;
use Nvl\Ownership\Contracts\OwnershipAdoptionAccess;
use Nvl\Ownership\Providers\OwnershipServiceProvider;
use Nvl\Ownership\Services\OwnershipAdoptionCoordinator;
use Nvl\Ownership\Services\OwnershipAdoptionRegistry;
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Ownership\ValueObjects\OwnershipMapping;
use Nvl\Ownership\ValueObjects\OwnershipOperation;
use Nvl\Support\Ownership\Services\OwnershipResourceRegistry;
use Nvl\Support\Ownership\Services\OwnershipStorageTables;
use Nvl\Support\Ownership\ValueObjects\OwnershipResourceDefinition;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Support\Providers\SupportServiceProvider;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\Fixtures\OwnershipContentBlock;
use Nvl\Templates\Tests\Fixtures\OwnershipMedia;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplate;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateHost;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateHostAdapter;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateOwnerResolver;
use Nvl\Templates\Tests\Fixtures\TestTemplateRenderer;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;

/** Exercises committed ownership and audit behavior without NVL Tenancy or Auth providers. */
abstract class OwnershipTestCase extends TestCase
{
    private array $originalMorphMap = [];

    protected function tearDown(): void
    {
        parent::tearDown();
        Relation::morphMap($this->originalMorphMap, false);
    }

    /** @return list<class-string> */
    protected function getPackageProviders($app): array
    {
        return [LocaleServiceProvider::class, SupportServiceProvider::class, TranslatableServiceProvider::class, DataServiceProvider::class, OwnershipServiceProvider::class, MediaServiceProvider::class, ContentServiceProvider::class, TemplatesServiceProvider::class];
    }

    /** @return class-string<ContentBlock> */
    protected function blockClass(): string
    {
        return OwnershipContentBlock::class;
    }

    /** Configure owned package roots before immutable resource registration. */
    protected function defineEnvironment($app): void
    {
        $app['config']->set([
            'database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'nvl-core.owners' => [OwnershipCompany::class, OwnershipActor::class],
            'nvl-ownership.enabled' => true, 'nvl-ownership.migrations.enabled' => false,
            'nvl-ownership.central_operations' => ['content-definitions', 'templates-maintain'],
            'nvl-tenancy.enabled' => false,
            'nvl-content.models.block' => $this->blockClass(),
            'nvl-content.ownership.owner_resources' => ['fixture.template-hosts', 'templates.versions'],
            'nvl-content.authorization.callback' => static fn (): bool => true,
            'nvl-content.locales.available' => ['en', 'bg'],
            'nvl-content.locales.required_on_publish' => ['en'],
            'nvl-content.owners' => ['subjects' => OwnershipTemplateHost::class],
            'nvl-content.definitions' => ['copy' => ['name' => 'Copy', 'version' => 1, 'allowed_regions' => ['main'], 'schema' => ['fields' => [['key' => 'text', 'type' => 'text', 'label' => 'Text', 'localized' => true]]]]],
            'nvl-templates.ownership.owner_resources' => ['member' => 'fixture.template-hosts'],
            'nvl-templates.models.template' => OwnershipTemplate::class,
            'nvl-templates.migrations.enabled' => false,
            'nvl-templates.authorization.callback' => static fn (): bool => true,
            'nvl-templates.owners' => ['member' => OwnershipTemplateOwnerResolver::class],
            'nvl-templates.renderers' => ['test' => TestTemplateRenderer::class],
            'nvl-templates.definitions' => ['welcome' => ['renderer' => 'test', 'view' => 'template-tests::core', 'profiles' => ['default'], 'schema' => ['name' => ['type' => 'string']], 'required_regions' => ['main'], 'allowed_content_definitions' => ['copy']]],
            'nvl-media.models.media' => OwnershipMedia::class,
            'nvl-media.migrations.enabled' => false,
            'nvl-translatable.locales' => ['en', 'bg'],
            'nvl-comments.moderation.new_status' => 'approved',
            'nvl-comments.mutation_lock.enabled' => false,
            'nvl-content.migrations.enabled' => false,
            'nvl-media.deduplication_lock.store' => 'array',
            'nvl-media.routes.api_enabled' => false,
            'auth.providers.users.model' => OwnershipActor::class,
        ]);
        $app['config']->set('nvl-templates.definitions.other', $app['config']->get('nvl-templates.definitions.welcome'));
        if (getenv('NVL_OWNERSHIP_TEST_DRIVER') === 'pgsql') {
            $database = getenv('NVL_OWNERSHIP_TEST_DATABASE');
            if (! is_string($database) || preg_match('/^nvl_own_test_[a-z0-9_]+$/D', $database) !== 1) {
                throw new \RuntimeException('Native integration tests require a dedicated nvl_own_test_ database.');
            }
            $app['config']->set('database.connections.sqlite', ['driver' => 'pgsql', 'url' => null, 'host' => '/tmp', 'port' => '5432', 'database' => $database, 'username' => get_current_user(), 'password' => '', 'charset' => 'utf8', 'prefix' => '', 'search_path' => 'public', 'sslmode' => 'prefer']);
        }
    }

    /** Install real package storage and activate through the reviewed coordinator. */
    protected function setUp(): void
    {
        $this->originalMorphMap = Relation::morphMap();
        parent::setUp();
        $this->app['view']->addNamespace('template-tests', __DIR__.'/Fixtures/views');
        $connection = TemplateModelRegistry::newInstance()->getConnection();
        $schema = $connection->getSchemaBuilder();
        $actorSchema = DB::getSchemaBuilder();
        if (getenv('NVL_OWNERSHIP_TEST_DRIVER') === 'pgsql') {
            if (DB::connection()->getDatabaseName() !== getenv('NVL_OWNERSHIP_TEST_DATABASE')) {
                throw new \RuntimeException('The actual coordinator differs from the dedicated test database.');
            }
            $actorSchema->dropAllTables();
            if ($connection !== DB::connection()) {
                if ($connection->getDatabaseName() !== getenv('NVL_OWNERSHIP_TEST_REMOTE_DATABASE')) {
                    throw new \RuntimeException('The actual source differs from the dedicated remote test database.');
                }
                $schema->dropAllTables();
            }
        }
        $schema->create('templates_owned_companies', static fn (Blueprint $table) => $table->unsignedBigInteger('id')->primary());
        $actorSchema->create('templates_owned_actors', static function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('password')->nullable();
        });
        OwnershipCompany::query()->insert([['id' => 7], ['id' => 8]]);
        OwnershipActor::query()->create(['id' => 1, 'name' => 'Operator', 'email' => 'operator@example.test', 'password' => 'private hash']);
        $schema->create('templates_owned_subjects', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('company_id');
            $table->string('name');
            $table->foreign('company_id')->references('id')->on('templates_owned_companies');
        });
        $this->app->make(OwnershipResourceRegistry::class)->register(new OwnershipResourceDefinition('fixture.template-hosts', 'fixture', OwnershipTemplateHost::class, OwnershipTemplateHost::ownershipDefinition()));
        $this->app->make(OwnershipAdoptionRegistry::class)->register('fixture', OwnershipTemplateHostAdapter::class);
        foreach (glob(__DIR__.'/../../media/database/migrations/*.php') ?: [] as $path) {
            (require $path)->up();
        }
        foreach (glob(__DIR__.'/../../content/database/migrations/*.php') ?: [] as $path) {
            (require $path)->up();
        }
        foreach (glob(__DIR__.'/../database/migrations/*.php') ?: [] as $path) {
            (require $path)->up();
        }
        $definitionTable = (new ($this->blockClass()))->getTable();
        $schema->table($definitionTable, static function (Blueprint $table): void {
            $table->unsignedBigInteger('company_id')->nullable();
            $table->foreign('company_id')->references('id')->on('templates_owned_companies');
        });
        $schema->table((new OwnershipMedia)->getTable(), static function (Blueprint $table): void {
            $table->unsignedBigInteger('company_id')->nullable();
            $table->foreign('company_id')->references('id')->on('templates_owned_companies');
        });
        $schema->table(TemplateModelRegistry::newInstance()->getTable(), static function (Blueprint $table): void {
            $table->unsignedBigInteger('company_id')->nullable();
            $table->foreign('company_id')->references('id')->on('templates_owned_companies');
        });
        (require __DIR__.'/../../ownership/database/migrations/ownership/2026_10_18_000001_nvl_ownership_create_adoption_tables.php')->up();
        if ($connection !== DB::connection() && ! $schema->hasTable(OwnershipStorageTables::Stores)) {
            $configured = config('nvl-ownership.connection');
            try {
                config(['nvl-ownership.connection' => $connection->getName()]);
                (require __DIR__.'/../../ownership/database/migrations/ownership/2026_10_18_000001_nvl_ownership_create_adoption_tables.php')->up();
            } finally {
                config(['nvl-ownership.connection' => $configured]);
            }
        }

        $this->app->bind(OwnerAccess::class, static fn () => new class implements OwnerAccess
        {
            public function assertCanEnter(Authenticatable $actor, Model $owner): void {}
        });
        $this->app->bind(CentralAccess::class, static fn () => new class implements CentralAccess
        {
            public function assertCanRun(string $operation, Authenticatable $actor): void {}
        });
        $this->app->bind(OwnershipAdoptionAccess::class, static fn () => new class implements OwnershipAdoptionAccess
        {
            public function authorize(OwnershipOperation $operation): void {}
        });
        $this->app->instance(MaintenanceMode::class, new class implements MaintenanceMode
        {
            public function activate(array $payload): void {}

            public function deactivate(): void {}

            public function active(): bool
            {
                return true;
            }

            public function data(): array
            {
                return [];
            }
        });
        $this->adoptOwnership();
        $this->app->make(OwnershipRunner::class)->central('content-definitions', OwnershipActor::firstOrFail(), fn () => $this->app->make(SyncContentDefinitionsAction::class)->execute(ContentActorData::system()));
    }

    /** Activate this fixture graph after its source tables and host policies exist. */
    protected function adoptOwnership(): void
    {
        $operation = new OwnershipOperation('adopt-templates', 'operator', '1');
        $coordinator = $this->app->make(OwnershipAdoptionCoordinator::class);
        $plan = $coordinator->prepare(['media', 'content', 'templates', 'fixture'], $this->reviewedMappings(), $operation);
        $coordinator->backfill($plan, 100, $operation);
        $coordinator->activate($plan, $operation);
    }

    /** @return list<OwnershipMapping> */
    protected function reviewedMappings(): array
    {
        return [];
    }
}
