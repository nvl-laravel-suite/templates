<?php

declare(strict_types=1);
use Nvl\Content\Services\ContentSnapshotIntegrity;
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\OwnershipAdoptionTestCase;

uses(OwnershipAdoptionTestCase::class);
it('rebinds only reviewed legacy version snapshots before native activation', function (): void {
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        $version = TemplateVersion::query()->findOrFail($this->legacyVersionId);
        expect($version->content_snapshot?->formatVersion)->toBe(3)->and($version->content_snapshot?->ownershipContext['owner']['key'])->toBe('7')->and($version->content_hash)->toBe($version->content_snapshot?->version);
        app(ContentSnapshotIntegrity::class)->assertValid($version->content_snapshot);
    });
});
