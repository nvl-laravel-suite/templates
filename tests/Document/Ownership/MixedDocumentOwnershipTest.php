<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Ownership;

use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Nvl\Media\Definitions\Tables\MediaTables;
use Nvl\Media\Models\Media;
use Nvl\Ownership\Providers\OwnershipServiceProvider;
use Nvl\Ownership\Services\OwnershipAdoptionCoordinator;
use Nvl\Ownership\ValueObjects\OwnershipOperation;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Ownership\Exceptions\OwnershipException;
use Nvl\Support\Ownership\Exceptions\OwnershipSchemaNotReady;
use Nvl\Support\Ownership\Services\OwnershipStorageTables;
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Services\TemplateCatalog;
use Nvl\Templates\Tests\CanonicalTestCase;

final class MixedDocumentOwnershipTest extends CanonicalTestCase
{
    private array $originalMorphMap = [];

    protected function getPackageProviders($app): array
    {
        return [HostProvider::class, OwnershipServiceProvider::class, ...parent::getPackageProviders($app)];
    }

    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $app['config']->set([
            'nvl-ownership.enabled' => true,
            'nvl-ownership.migrations.enabled' => true,
            'nvl-core.owners' => [TestCompany::class, TestActor::class],
            'nvl-media.models.media' => OwnedMedia::class,
            'auth.providers.users.model' => TestActor::class,
        ]);
    }

    protected function setUp(): void
    {
        $this->originalMorphMap = Relation::morphMap();
        parent::setUp();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        Relation::morphMap($this->originalMorphMap, false);
    }

    public function test_unscoped_templates_catalog_and_doctor_work_beside_adopted_media(): void
    {
        $this->adoptMedia();
        DB::table(TemplatesTables::Templates)->insert([
            'id' => 'b93d7c50-8b51-411e-874b-68f3c8f7b366', 'scope_id' => 'app', 'key' => 'retained', 'name' => 'Retained',
        ]);
        $catalog = app(TemplateCatalog::class)->templates([], SystemActor::Background);
        self::assertSame('retained', $catalog->getCollection()->sole()->key);
        $this->artisan('nvl:templates:doctor', ['--strict' => true, '--scope' => 'database'])->assertSuccessful();
    }

    public function test_unscoped_catalog_still_refuses_a_physically_partitioned_template_table(): void
    {
        $this->adoptMedia();
        DB::connection()->getSchemaBuilder()->table(TemplatesTables::Templates, static fn (Blueprint $table) => $table->string('owner_scope_key', 191)->nullable());
        $this->artisan('nvl:templates:doctor', ['--strict' => true, '--scope' => 'database'])->assertFailed();

        $this->expectException(OwnershipSchemaNotReady::class);
        app(TemplateCatalog::class)->templates([], SystemActor::Background);
    }

    public function test_unscoped_model_alias_still_refuses_the_adopted_media_table(): void
    {
        $this->adoptMedia();

        $this->expectException(OwnershipException::class);
        Media::query()->exists();
    }

    private function adoptMedia(): void
    {
        $schema = DB::connection()->getSchemaBuilder();
        $schema->create((new TestCompany)->getTable(), static fn (Blueprint $table) => $table->unsignedBigInteger('id')->primary());
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $schema->table(MediaTables::get(MediaTables::Media), static function (Blueprint $table): void {
            $table->unsignedBigInteger('company_id')->nullable();
            $table->foreign('company_id')->references('id')->on((new TestCompany)->getTable());
        });

        $operation = new OwnershipOperation('adopt-media-beside-templates', 'operator', '1');
        $coordinator = app(OwnershipAdoptionCoordinator::class);
        $plan = $coordinator->prepare(['media'], [], $operation);
        self::assertTrue($coordinator->backfill($plan, 100, $operation));
        $coordinator->activate($plan, $operation);
        self::assertTrue(DB::table(OwnershipStorageTables::Markers)->where('resource', 'media.assets')->exists());
    }
}
