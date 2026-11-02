<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests;

use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Nvl\Media\Contracts\MediaAuthorization;
use Nvl\Media\Providers\MediaServiceProvider;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Tests\Fixtures\AllowMediaAuthorization;
use Nvl\Templates\Tests\Support\GateTemplateAuthorization;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;

/** Native service harness for the original document engine's canonical regressions. */
abstract class CanonicalTestCase extends TestCase
{
    protected function getPackageProviders($app): array
    {
        return [LocaleServiceProvider::class, TranslatableServiceProvider::class, MediaServiceProvider::class, TemplatesServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app->bind(MediaAuthorization::class, AllowMediaAuthorization::class);
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite.database', ':memory:');
        $app['config']->set('app.key', 'base64:'.base64_encode(str_repeat('x', 32)));
        $app['config']->set('nvl-templates.integrations.content', false);
        $app['config']->set('nvl-templates.media.disk', 'local');
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->app->instance(TemplateAuthorization::class, new GateTemplateAuthorization);
        $this->app->instance(MediaAuthorization::class, new AllowMediaAuthorization);
        foreach (['manage', 'read', 'render', 'copy'] as $ability) {
            Gate::define('templates.'.$ability, fn ($user = null) => true);
        }
        Storage::fake('local');
    }

    protected function actor(): SystemActor
    {
        return SystemActor::Background;
    }
}
