<?php

declare(strict_types=1);
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Ownership\Services\OwnershipWriter;
use Nvl\Ownership\ValueObjects\OwnershipAssignment;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Ownership\Contracts\OwnershipQueuedJob;
use Nvl\Support\Ownership\Exceptions\OwnershipViolation;
use Nvl\Templates\Contracts\TemplateCatalogAccess;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateOwnerGrant;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Ownership\TemplateOwnerCatalog;
use Nvl\Templates\Services\TemplateAssignments;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateHost;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateScenario;
use Nvl\Templates\Tests\OwnershipTestCase;
use Nvl\Translatable\Services\RelatedTranslationStore;

uses(OwnershipTestCase::class);
it('publishes a native snapshot and processes an isolated durable render', function (): void {
    Queue::fake();
    config(['nvl-templates.rendering.output.persist' => false]);
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        $version = OwnershipTemplateScenario::version();
        expect($version->content_snapshot['formatVersion'])->toBe(3);
        $render = app(TemplateRenderer::class)->queue($version->template, ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotencyKey' => 'one', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']], SystemActor::Background);
        $job = null;
        Queue::assertPushed(RenderTemplateJob::class, function (RenderTemplateJob $item) use (&$job): bool {
            $job = $item;

            return true;
        });
        expect($job)->toBeInstanceOf(OwnershipQueuedJob::class);
        expect(app(TemplateRenderer::class)->process($render)->status->value)->toBe('completed');
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
        $request = ['grantId' => $grant->id, 'expectedGrantRevision' => $grant->revision, 'expectedSourceRevision' => $source->revision, 'targetKey' => 'welcome', 'idempotencyKey' => 'owned-copy', 'mediaGrantIds' => []];
        $copy = app(TemplateOwnerCatalog::class)->import($request, SystemActor::Background);
        expect($copy->id)->not->toBe($source->id)->and($copy->content_snapshot['formatVersion'])->toBe(3)->and($copy->content_snapshot['ownerId'])->toBe($copy->id);
        expect(app(TemplateOwnerCatalog::class)->import($request, SystemActor::Background)->id)->toBe($copy->id);
        $catalog->revoke($grant->id, $grant->revision);
        expect(fn () => app(TemplateOwnerCatalog::class)->import($request, SystemActor::Background))->toThrow(OwnershipViolation::class);
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
        $render = app(TemplateRenderer::class)->queue($version->template, ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotencyKey' => 'erase', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']], SystemActor::Background);
        expect(app(TemplateRenderer::class)->process($render)->payload)->toBeNull();
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
        $actor = SystemActor::Background;
        $assign = app(TemplateAssignments::class);
        $row = $assign->assign($first->template, ['ownerType' => 'member', 'ownerId' => $host->id, 'profile' => 'default', 'settings' => [], 'versionId' => $first->id, 'expectedRevision' => 0], $actor);
        $render = app(TemplateRenderer::class)->queue($first->template, ['ownerType' => 'member', 'ownerId' => $host->id, 'profile' => 'default', 'versionId' => null, 'idempotencyKey' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']], $actor);
        $replacement = $assign->assign($other->template, ['ownerType' => 'member', 'ownerId' => $host->id, 'profile' => 'default', 'settings' => [], 'versionId' => $other->id, 'expectedRevision' => $row->revision], $actor);
        expect($replacement->template_id)->toBe($other->template_id)->and(app(TemplateRenderer::class)->process($render)->template_version_id)->toBe($first->id);
    });
});

it('keeps native paginated Template reads bounded for one and twenty five roots', function (): void {
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        for ($i = 0; $i < 25; $i++) {
            $template = TemplateModelRegistry::create(['key' => 'bounded-'.$i, 'renderer' => 'test', 'status' => 'active', 'schema' => []]);
            $template->getConnection()->transaction(fn () => app(RelatedTranslationStore::class)->upsert($template, $template->translationDefinition(), 'en', ['title' => 'Title '.$i]));
        }
        $measure = function (int $size): int {
            DB::enableQueryLog();
            DB::flushQueryLog();
            $page = app(TemplateReader::class)->paginate([], SystemActor::Background, $size);
            $log = DB::getQueryLog();
            $count = count($log);
            expect($count)->toBeGreaterThan(0);
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
        $changed = false;
        $reads = 0;
        $table = TemplateModelRegistry::newInstance()->getTable();
        DB::listen(function ($query) use (&$changed, &$reads, $table, $runner, $actor, $source): void {
            if (! $changed && str_contains($query->sql, 'select') && str_contains($query->sql, 'from "'.$table.'"') && ++$reads === 2) {
                $changed = true;
                $runner->central('templates-maintain', $actor, fn () => TemplateModelRegistry::query()->findOrFail($source->template_id)->forceFill(['renderer' => 'changed'])->save());
            }
        });
        expect(fn () => app(TemplateOwnerCatalog::class)->import(['grantId' => $grant->id, 'expectedGrantRevision' => $grant->revision, 'expectedSourceRevision' => $source->revision, 'targetKey' => 'welcome', 'idempotencyKey' => 'stale-definition', 'mediaGrantIds' => []], SystemActor::Background))->toThrow(OwnershipViolation::class);
        expect(TemplateModelRegistry::query()->count())->toBe(0);
    });
});

it('never returns a published or retired version to draft through quiet or raw writes', function (string $status, string $path): void {
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function () use ($status, $path): void {
        $version = OwnershipTemplateScenario::version();
        if ($status === 'retired') {
            $version->forceFill(['status' => 'retired'])->saveQuietly();
        }
        if ($path === 'quiet') {
            expect(fn () => $version->forceFill(['status' => 'draft'])->saveQuietly())->toThrow(OwnershipViolation::class);
        } else {
            $connection = $version->getConnection();
            expect(fn () => $connection->transaction(fn () => $connection->table($version->getTable())->where('id', $version->id)->update(['status' => 'draft'])))->toThrow(QueryException::class);
        }
        expect($version->refresh()->status->value)->toBe($status);
    });
})->with(['published', 'retired'])->with(['quiet', 'raw']);
