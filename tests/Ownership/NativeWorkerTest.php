<?php

declare(strict_types=1);
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Templates\Actions\QueueTemplateRenderAction;
use Nvl\Templates\Data\Mutations\RenderTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateScenario;
use Nvl\Templates\Tests\OwnershipTestCase;
use Symfony\Component\Process\Process;

uses(OwnershipTestCase::class);
it('runs captured Template workers with private Media outputs and races version allocation on PostgreSQL', function (): void {
    if (getenv('NVL_OWNERSHIP_TEST_DRIVER') !== 'pgsql') {
        $this->markTestSkipped('Requires the explicitly isolated native PostgreSQL databases.');
    }
    Storage::fake('local');
    $schema = DB::getSchemaBuilder();
    $schema->create('jobs', static function (Blueprint $t): void {
        $t->bigIncrements('id');
        $t->string('queue');
        $t->longText('payload');
        $t->unsignedTinyInteger('attempts');
        $t->unsignedInteger('reserved_at')->nullable();
        $t->unsignedInteger('available_at');
        $t->unsignedInteger('created_at');
    });
    $schema->create('failed_jobs', static function (Blueprint $t): void {
        $t->bigIncrements('id');
        $t->string('uuid')->unique();
        $t->text('connection');
        $t->text('queue');
        $t->longText('payload');
        $t->longText('exception');
        $t->timestamp('failed_at')->useCurrent();
    });
    $schema->create('cache', static function (Blueprint $t): void {
        $t->string('key')->primary();
        $t->mediumText('value');
        $t->integer('expiration');
    });
    $schema->create('cache_locks', static function (Blueprint $t): void {
        $t->string('key')->primary();
        $t->string('owner');
        $t->integer('expiration');
    });
    config(['app.key' => 'base64:'.base64_encode(str_repeat('k', 32)), 'nvl-templates.rendering.connection' => 'database', 'queue.default' => 'database', 'queue.connections.database.connection' => 'sqlite', 'queue.failed' => ['driver' => 'database-uuids', 'database' => 'sqlite', 'table' => 'failed_jobs'], 'cache.default' => 'database', 'cache.stores.database.connection' => 'sqlite', 'cache.stores.database.lock_connection' => 'sqlite', 'cache.stores.database.table' => 'cache', 'cache.stores.database.lock_table' => 'cache_locks']);
    app()->forgetInstance('encrypter');
    $runner = app(OwnershipRunner::class);
    $actor = OwnershipActor::firstOrFail();
    $renders = [];
    $versions = [];
    foreach ([7, 8] as $company) {
        $runner->run(OwnershipCompany::findOrFail($company), $actor, function () use ($company, &$renders, &$versions): void {
            $version = OwnershipTemplateScenario::version();
            $versions[$company] = $version;
            $renders[$company] = app(QueueTemplateRenderAction::class)->execute($version->template, new RenderTemplateData('en', ['name' => 'Owner '.$company], idempotencyKey: 'same-key'), TemplateActorData::system())->id;
        });
    }
    $source = json_encode(config('database.connections.sqlite'), JSON_THROW_ON_ERROR);
    $root = Storage::disk('local')->path('');
    $worker = new Process([PHP_BINARY, __DIR__.'/../Fixtures/ownership-worker.php', $source, json_encode(['root' => $root], JSON_THROW_ON_ERROR)], env: ['XDEBUG_MODE' => 'off'], timeout: 60);
    $worker->mustRun();
    expect($worker->getOutput())->toBe('unresolved')->and(DB::table('jobs')->count())->toBe(0)->and(DB::table('failed_jobs')->pluck('exception')->all())->toBe([]);
    foreach ([7, 8] as $company) {
        $runner->run(OwnershipCompany::findOrFail($company), $actor, function () use ($company, $renders): void {
            $render = TemplateRender::query()->findOrFail($renders[$company]);
            expect($render->status->value)->toBe('completed');
            $output = $render->media()->firstOrFail();
            expect($output->getAttribute('owner_scope_key'))->toBe($render->getAttribute('owner_scope_key'));
            expect(Storage::disk('local')->get($output->storage_path))->toContain('Owner '.$company);
        });
    }
    $gate = tempnam(sys_get_temp_dir(), 'nvl-template-gate-');
    $ready = [tempnam(sys_get_temp_dir(), 'nvl-template-a-'), tempnam(sys_get_temp_dir(), 'nvl-template-b-')];
    $processes = [];
    try {
        foreach ($ready as $file) {
            $options = ['root' => $root, 'mode' => 'version', 'template' => $versions[7]->template_id, 'gate' => $gate, 'ready' => $file];
            $processes[] = $p = new Process([PHP_BINARY, __DIR__.'/../Fixtures/ownership-worker.php', $source, json_encode($options, JSON_THROW_ON_ERROR)], env: ['XDEBUG_MODE' => 'off'], timeout: 40);
            $p->start();
        }
        $deadline = microtime(true) + 15;
        while ((file_get_contents($ready[0]) !== 'ready' || file_get_contents($ready[1]) !== 'ready') && microtime(true) < $deadline) {
            usleep(10000);
        }
        expect(file_get_contents($ready[0]))->toBe('ready')->and(file_get_contents($ready[1]))->toBe('ready');
        file_put_contents($gate, 'go');
        $numbers = [];
        foreach ($processes as $p) {
            $p->wait();
            expect($p->isSuccessful())->toBeTrue($p->getErrorOutput().$p->getOutput());
            $numbers[] = $p->getOutput();
        }sort($numbers);
        expect($numbers)->toBe(['2', '3']);
        $runner->run(OwnershipCompany::findOrFail(7), $actor, fn () => expect(TemplateVersion::query()->where('template_id', $versions[7]->template_id)->count())->toBe(3));
    } finally {
        foreach ($processes as $p) {
            $p->stop();
        }foreach ([$gate, ...$ready] as $file) {
            if (is_string($file)) {
                unlink($file);
            }
        }
    }
});
