<?php

declare(strict_types=1);
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Templates\Actions\CreateTemplateAction;
use Nvl\Templates\Data\Mutations\CreateTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\TemplateTranslation;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\OwnershipSourceTestCase;

uses(OwnershipSourceTestCase::class);
it('rolls back Template roots and locales together on their actual package source', function (): void {
    TemplateTranslation::creating(static function ($row): void {
        if ($row->locale === 'bg') {
            throw new RuntimeException('Rejected later locale');
        }
    });
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        expect(fn () => app(CreateTemplateAction::class)->execute(CreateTemplateData::from(['key' => 'welcome', 'translations' => ['en' => ['title' => 'First'], 'bg' => ['title' => 'Second']]]), TemplateActorData::system()))->toThrow(RuntimeException::class, 'Rejected later locale');
        expect(TemplateModelRegistry::query()->count())->toBe(0)->and(TemplateTranslation::query()->count())->toBe(0);
    });
});
