<?php

declare(strict_types=1);
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\Fixtures\TemplatesPrefixedOwnershipTestCase;

uses(TemplatesPrefixedOwnershipTestCase::class);
it('prepares backfills and activates prefixed templates storage without duplicating constraints', function (): void {
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        expect(OwnershipCompany::findOrFail(7)->getConnection()->getTablePrefix())->toBe('review_');
    });
});
