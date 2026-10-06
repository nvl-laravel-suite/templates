<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Cache;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Support\TemplatesRouteConfiguration;

it('inherits Core queues when creating a render job', function (): void {
    config([
        'nvl-templates.queue' => ['connection' => null, 'name' => null],
        'nvl-templates.rendering.connection' => null,
        'nvl-templates.rendering.queue' => null,
        'nvl-core.queue' => ['connection' => 'shared-jobs', 'name' => 'shared-renders'],
    ]);
    $job = new RenderTemplateJob('render-id');
    expect($job->connection)->toBe('shared-jobs')->and($job->queue)->toBe('shared-renders');
});

it('inherits template middleware and guards while preserving explicit route guards', function (): void {
    config([
        'nvl-templates.routes.render.middleware' => null,
        'nvl-templates.routes.middleware' => null,
        'nvl-core.routes.middleware' => ['api', 'auth'],
        'nvl-core.authorization.guard' => 'admin',
    ]);
    expect(TemplatesRouteConfiguration::middleware('render'))->toBe(['api', 'auth:admin']);
    config(['nvl-templates.routes.render.middleware' => ['api', 'auth:token']]);
    expect(TemplatesRouteConfiguration::middleware('render'))->toBe(['api', 'auth:token']);
});

it('uses the shared store for render uniqueness and overlap locks', function (): void {
    config([
        'nvl-templates.locks.store' => null,
        'nvl-core.locks.store' => 'shared-template-locks',
        'cache.stores.shared-template-locks' => ['driver' => 'array'],
    ]);
    $repository = Cache::store('shared-template-locks');
    $job = new RenderTemplateJob('render-id');
    expect($job->uniqueVia())->toBe($repository);
    $middleware = $job->middleware()[0];
    expect($middleware->getLockKey($job))->toStartWith('nvl:templates:render-overlap:');
    $lock = $repository->lock($middleware->getLockKey($job), 60);
    expect($lock->get())->toBeTrue();
    $ran = false;

    try {
        $middleware->handle($job, function () use (&$ran): void {
            $ran = true;
        });
        expect($ran)->toBeFalse();
    } finally {
        $lock->release();
    }
});

it('preserves native foreign overlap locks while processing an owned render lock', function (): void {
    $job = new RenderTemplateJob('render-id');
    $middleware = $job->middleware()[0];
    $foreignKey = 'laravel-queue-overlap:'.RenderTemplateJob::class.':nvl-templates-render:render-id';
    $foreignLock = $job->uniqueVia()->lock($foreignKey, 60);
    expect($foreignLock->get())->toBeTrue();
    $ran = false;

    try {
        $middleware->handle($job, function () use (&$ran, $foreignKey, $job): void {
            $ran = true;
            expect($job->uniqueVia()->lock($foreignKey, 60)->get())->toBeFalse();
        });
        expect($ran)->toBeTrue();
    } finally {
        $foreignLock->release();
    }
});
