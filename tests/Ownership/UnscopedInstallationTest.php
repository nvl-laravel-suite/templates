<?php

declare(strict_types=1);
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\Fixtures\UnscopedTemplatesOwnershipTestCase;

uses(UnscopedTemplatesOwnershipTestCase::class);
it('admits an unrelated owned host with default unscoped Templates installed', function (): void {
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        expect(Template::query()->count())->toBe(0);
    });
});
