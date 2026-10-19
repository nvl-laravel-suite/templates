<?php

declare(strict_types=1);
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Nvl\Content\Contracts\ExportContentSnapshotForCopyContract;
use Nvl\Content\Data\ContentSnapshotCopyData;
use Nvl\Filterable\Data\FilterSet;
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Ownership\Services\OwnershipWriter;
use Nvl\Ownership\ValueObjects\OwnershipAssignment;
use Nvl\Support\Ownership\Contracts\OwnershipQueuedJob;
use Nvl\Support\Ownership\Exceptions\OwnershipViolation;
use Nvl\Templates\Actions\AssignTemplateAction;
use Nvl\Templates\Actions\ImportPlatformTemplateAction;
use Nvl\Templates\Actions\ListTemplatesAction;
use Nvl\Templates\Actions\ProcessTemplateRenderAction;
use Nvl\Templates\Actions\QueueTemplateRenderAction;
use Nvl\Templates\Contracts\TemplateCatalogAccess;
use Nvl\Templates\Data\Mutations\AssignTemplateData;
use Nvl\Templates\Data\Mutations\ImportPlatformTemplateData;
use Nvl\Templates\Data\Mutations\RenderTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateOwnerGrant;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Ownership\TemplateOwnerCatalog;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateHost;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateScenario;
use Nvl\Templates\Tests\OwnershipTestCase;
use Nvl\Translatable\Services\TranslationWriter;

uses(OwnershipTestCase::class);
it('publishes a native snapshot and processes an isolated durable render', function (): void {
    Queue::fake();
    config(['nvl-templates.rendering.output.persist' => false]);
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        $version = OwnershipTemplateScenario::version();
        expect($version->content_snapshot?->formatVersion)->toBe(3);
        $render = app(QueueTemplateRenderAction::class)->execute($version->template, new RenderTemplateData('en', ['name' => 'Ada'], idempotencyKey: 'one'), TemplateActorData::system());
        $job = null;
        Queue::assertPushed(RenderTemplateJob::class, function (RenderTemplateJob $item) use (&$job): bool {
            $job = $item;

            return true;
        });
        expect($job)->toBeInstanceOf(OwnershipQueuedJob::class);
        expect(app(ProcessTemplateRenderAction::class)->execute($render)->status->value)->toBe('completed');
        expect(fn () => $render->refresh()->forceFill(['template_version_id' => (string) Str::uuid()])->saveQuietly())->toThrow(OwnershipViolation::class);
    });
});
it('filters roots and locale pagination before rows leave the database', function (): void {
    $runner = app(OwnershipRunner::class);
    $actor = OwnershipActor::firstOrFail();
    $a = $runner->run(OwnershipCompany::findOrFail(7), $actor, fn () => OwnershipTemplateScenario::version());
    $runner->run(OwnershipCompany::findOrFail(8), $actor, function () use ($a): void {
        OwnershipTemplateScenario::version();
        expect(TemplateModelRegistry::query()->paginate(1)->total())->toBe(1)->and(TemplateModelRegistry::query()->find($a->template_id))->toBeNull();
        expect(fn () => $a->forceFill(['metadata' => ['forged' => true]])->saveQuietly())->toThrow(OwnershipViolation::class);
    });
});
it('rejects raw assignment hosts outside the current primary owner', function (): void {
    $runner = app(OwnershipRunner::class);
    $actor = OwnershipActor::firstOrFail();
    $host = $runner->run(OwnershipCompany::findOrFail(8), $actor, fn () => app(OwnershipWriter::class)->create(OwnershipTemplateHost::class, static function (OwnershipAssignment $a): OwnershipTemplateHost {
        $host = new OwnershipTemplateHost;
        $host->forceFill([...$a->attributes(), 'name' => 'Foreign'])->save();

        return $host;
    }));
    $runner->run(OwnershipCompany::findOrFail(7), $actor, function () use ($host): void {
        $version = OwnershipTemplateScenario::version();
        $row = ['id' => (string) Str::uuid(), 'template_id' => $version->template_id, 'template_version_id' => $version->id, 'owner_type' => 'member', 'owner_id' => $host->id, 'profile' => 'default', 'revision' => 1, 'owner_scope_key' => $version->getAttribute('owner_scope_key')];
        $model = new TemplateAssignment;
        expect(fn () => $model->getConnection()->transaction(fn () => $model->getConnection()->table($model->getTable())->insert($row)))->toThrow(QueryException::class);
    });
});
it('rejects a different template version within the same owner at the native layer', function (): void {
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        $version = OwnershipTemplateScenario::version();
        $other = app(Nvl\Support\Ownership\Contracts\OwnershipWriter::class)->create(TemplateModelRegistry::modelClass(), function (array $a) {
            $other = TemplateModelRegistry::newInstance();
            $other->forceFill([...$a, 'key' => 'other', 'renderer' => 'test', 'schema' => []])->save();

            return $other;
        });
        $model = new TemplateAssignment;
        $row = ['id' => (string) Str::uuid(), 'template_id' => $other->id, 'template_version_id' => $version->id, 'owner_type' => 'member', 'owner_id' => (string) Str::uuid(), 'profile' => 'default', 'revision' => 1, 'owner_scope_key' => $version->getAttribute('owner_scope_key')];
        expect(fn () => $model->getConnection()->transaction(fn () => $model->getConnection()->table($model->getTable())->insert($row)))->toThrow(QueryException::class);
    });
});
it('copies only an exact granted central version and denies revoked grants while retaining independent copies', function (): void {
    $runner = app(OwnershipRunner::class);
    $actor = OwnershipActor::firstOrFail();
    $source = $runner->central('templates-maintain', $actor, fn () => OwnershipTemplateScenario::version());
    $runner->run(OwnershipCompany::findOrFail(7), $actor, function () use ($source): void {
        $catalog = app(TemplateOwnerCatalog::class);
        expect(fn () => $catalog->grant($source->id, $source->revision))->toThrow(OwnershipViolation::class);
        app()->bind(TemplateCatalogAccess::class, fn () => new class implements TemplateCatalogAccess
        {
            public function assertCanGrant(string $id, int $revision): void {}

            public function assertCanRevoke(string $id): void {}
        });
        $catalog = app(TemplateOwnerCatalog::class);
        $grant = $catalog->grant($source->id, $source->revision);
        expect(TemplateOwnerGrant::factory()->forVersion($source)->make())->toBeInstanceOf(TemplateOwnerGrant::class);
        $request = new ImportPlatformTemplateData($grant->id, $grant->revision, $source->revision, 'welcome', 'owned-copy', []);
        $copy = app(ImportPlatformTemplateAction::class)->execute($request, TemplateActorData::system());
        expect($copy->id)->not->toBe($source->id)->and($copy->content_snapshot?->formatVersion)->toBe(3)->and($copy->content_snapshot?->ownerId)->toBe($copy->id);
        expect(app(ImportPlatformTemplateAction::class)->execute($request, TemplateActorData::system())->id)->toBe($copy->id);
        $catalog->revoke($grant->id, $grant->revision);
        expect(fn () => app(ImportPlatformTemplateAction::class)->execute($request, TemplateActorData::system()))->toThrow(OwnershipViolation::class);
        expect(TemplateVersion::query()->findOrFail($copy->id)->content_hash)->toBe($copy->content_hash);
    });
});
it('protects published snapshots against raw writes and permits terminal payload erasure', function (): void {
    Queue::fake();
    config(['nvl-templates.rendering.output.persist' => false, 'nvl-templates.rendering.store_payload' => false]);
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        $version = OwnershipTemplateScenario::version();
        $c = $version->getConnection();
        expect(fn () => $c->transaction(fn () => $c->table($version->getTable())->where('id', $version->id)->update(['content_hash' => str_repeat('0', 64)])))->toThrow(QueryException::class);
        $render = app(QueueTemplateRenderAction::class)->execute($version->template, new RenderTemplateData('en', ['name' => 'Ada'], idempotencyKey: 'erase'), TemplateActorData::system());
        expect(app(ProcessTemplateRenderAction::class)->execute($render)->payload)->toBeNull();
    });
});
it('reassigns an owner profile without changing the authority of an existing durable render', function (): void {
    Queue::fake();
    config(['nvl-templates.rendering.output.persist' => false]);
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        $first = OwnershipTemplateScenario::version();
        $other = OwnershipTemplateScenario::version('other');
        $host = app(OwnershipWriter::class)->create(OwnershipTemplateHost::class, static function (OwnershipAssignment $a): OwnershipTemplateHost {
            $host = new OwnershipTemplateHost;
            $host->forceFill([...$a->attributes(), 'name' => 'Host'])->save();

            return $host;
        });
        $actor = TemplateActorData::system();
        $assign = app(AssignTemplateAction::class);
        $row = $assign->execute($first->template, AssignTemplateData::from(['ownerType' => 'member', 'ownerId' => $host->id, 'profile' => 'default', 'settings' => [], 'versionId' => $first->id, 'expectedRevision' => 0]), $actor);
        $render = app(QueueTemplateRenderAction::class)->execute($first->template, new RenderTemplateData('en', ['name' => 'Ada'], ownerType: 'member', ownerId: $host->id), $actor);
        $replacement = $assign->execute($other->template, AssignTemplateData::from(['ownerType' => 'member', 'ownerId' => $host->id, 'profile' => 'default', 'settings' => [], 'versionId' => $other->id, 'expectedRevision' => $row->revision]), $actor);
        expect($replacement->template_id)->toBe($other->template_id)->and(app(ProcessTemplateRenderAction::class)->execute($render)->template_version_id)->toBe($first->id);
    });
});

it('keeps native paginated Template reads bounded for one and twenty five roots', function (): void {
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        for ($i = 0; $i < 25; $i++) {
            $template = TemplateModelRegistry::create(['key' => 'bounded-'.$i, 'renderer' => 'test', 'status' => 'active', 'schema' => []]);
            app(TranslationWriter::class)->replace($template, ['en' => ['title' => 'Title '.$i]]);
        }
        $measure = function (int $size): int {
            DB::enableQueryLog();
            DB::flushQueryLog();
            $page = app(ListTemplatesAction::class)->execute(new FilterSet, TemplateActorData::system(), $size);
            $log = DB::getQueryLog();
            $count = count($log);
            DB::disableQueryLog();
            expect($page->items())->toHaveCount($size)->and($page->total())->toBe(25);

            return $count;
        };
        $one = $measure(1);
        expect($measure(25))->toBeLessThanOrEqual($one + 2);
    });
});
it('rechecks the locked code definition after catalog content is staged', function (): void {
    $runner = app(OwnershipRunner::class);
    $actor = OwnershipActor::firstOrFail();
    $source = $runner->central('templates-maintain', $actor, fn () => OwnershipTemplateScenario::version());
    app()->bind(TemplateCatalogAccess::class, fn () => new class implements TemplateCatalogAccess
    {
        public function assertCanGrant(string $id, int $revision): void {}

        public function assertCanRevoke(string $id): void {}
    });
    $runner->run(OwnershipCompany::findOrFail(7), $actor, function () use ($source, $runner, $actor): void {
        $grant = app(TemplateOwnerCatalog::class)->grant($source->id, $source->revision);
        $real = app(ExportContentSnapshotForCopyContract::class);
        app()->instance(ExportContentSnapshotForCopyContract::class, new class($real, $runner, $actor, $source->template_id) implements ExportContentSnapshotForCopyContract
        {
            private bool $changed = false;

            public function __construct(private ExportContentSnapshotForCopyContract $real, private OwnershipRunner $runner, private OwnershipActor $actor, private string $id) {}

            public function execute(string $ownerAlias, string $ownerId, string $group, string $grantId): ContentSnapshotCopyData
            {
                $copy = $this->real->execute($ownerAlias, $ownerId, $group, $grantId);
                if (! $this->changed) {
                    $this->changed = true;
                    $this->runner->central('templates-maintain', $this->actor, fn () => TemplateModelRegistry::query()->findOrFail($this->id)->forceFill(['renderer' => 'changed'])->save());
                }

                return $copy;
            }
        });
        expect(fn () => app(ImportPlatformTemplateAction::class)->execute(new ImportPlatformTemplateData($grant->id, $grant->revision, $source->revision, 'welcome', 'stale-definition', []), TemplateActorData::system()))->toThrow(OwnershipViolation::class);
        expect(TemplateModelRegistry::query()->count())->toBe(0);
    });
});
