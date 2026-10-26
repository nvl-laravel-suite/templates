<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;

abstract class BladeOnlyTestCase extends TestCase
{
    protected function getPackageProviders($app): array
    {
        return [LocaleServiceProvider::class, TranslatableServiceProvider::class, TemplatesServiceProvider::class];
    }
}
