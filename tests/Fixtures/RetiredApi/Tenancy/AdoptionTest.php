<?php

declare(strict_types=1);

use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Tenancy\TemplatesAdoptionAdapter;
use Nvl\Tenancy\Providers\TenancyServiceProvider;
use Nvl\Tenancy\Services\TenantAdoptionRegistry;

beforeEach(function (): void {
    app()->register(TenancyServiceProvider::class);
    app()->register(TemplatesServiceProvider::class, true);
});

it('registers the template graph adopter', function (): void {
    expect(app(TenantAdoptionRegistry::class)->all()['templates'] ?? null)->toBe(TemplatesAdoptionAdapter::class);
});
