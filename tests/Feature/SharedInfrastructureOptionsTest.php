<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Cache;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Support\TemplatesRouteConfiguration;

it('inherits Core queues when creating a render job', function (): void {
    config([
        'templates.queue' => ['connection' => null, 'name' => null],
        'templates.rendering.connection' => null,
        'templates.rendering.queue' => null,
        'nvl-core.queue' => ['connection' => 'shared-jobs', 'name' => 'shared-renders'],
    ]);
    $job = new RenderTemplateJob('render-id');
    expect($job->connection)->toBe('shared-jobs')->and($job->queue)->toBe('shared-renders');
});

it('inherits template middleware and guards while preserving explicit route guards', function (): void {
    config([
        'templates.routes.render.middleware' => null,
        'templates.routes.middleware' => null,
        'nvl-core.routes.middleware' => ['api', 'auth'],
        'nvl-core.authorization.guard' => 'admin',
    ]);
    expect(TemplatesRouteConfiguration::middleware('render'))->toBe(['api', 'auth:admin']);
    config(['templates.routes.render.middleware' => ['api', 'auth:token']]);
    expect(TemplatesRouteConfiguration::middleware('render'))->toBe(['api', 'auth:token']);
});

it('uses the shared store for render uniqueness and overlap locks', function (): void {
    config([
        'templates.locks.store' => null,
        'nvl-core.locks.store' => 'shared-template-locks',
        'cache.stores.shared-template-locks' => ['driver' => 'array'],
    ]);
    $repository = Cache::store('shared-template-locks');
    $job = new RenderTemplateJob('render-id');
    expect($job->uniqueVia())->toBe($repository);
    $middleware = $job->middleware()[0];
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
