<?php

declare(strict_types=1);
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Ownership\Services\OwnershipWriter;
use Nvl\Ownership\ValueObjects\OwnershipAssignment;
use Nvl\Templates\Actions\AssignTemplateAction;
use Nvl\Templates\Data\Mutations\AssignTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Tests\Fixtures\DottedTemplateOwnershipTestCase;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateHost;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplateScenario;

uses(DottedTemplateOwnershipTestCase::class);
it('assigns a host whose registered alias contains a literal dot', function (): void {
    $alias = 'sales.order';
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function () use ($alias): void {
        $version = OwnershipTemplateScenario::version();
        $host = app(OwnershipWriter::class)->create(OwnershipTemplateHost::class, static function (OwnershipAssignment $a): OwnershipTemplateHost {
            $host = new OwnershipTemplateHost;
            $host->forceFill([...$a->attributes(), 'name' => 'Dotted host'])->save();

            return $host;
        });
        $assignment = app(AssignTemplateAction::class)->execute($version->template, AssignTemplateData::from(['ownerType' => $alias, 'ownerId' => $host->id, 'profile' => 'default', 'settings' => [], 'versionId' => $version->id, 'expectedRevision' => 0]), TemplateActorData::system());
        expect($assignment->owner_type)->toBe($alias)->and($assignment->owner_id)->toBe($host->id);
    });
});
