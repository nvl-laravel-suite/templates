<?php

declare(strict_types=1);
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Templates\Actions\CreateTemplateAction;
use Nvl\Templates\Actions\SyncTemplateDefinitionsAction;
use Nvl\Templates\Data\Mutations\CreateTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Services\TemplatesDoctor;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\Fixtures\OwnershipTemplate;
use Nvl\Templates\Tests\OwnershipTestCase;

uses(OwnershipTestCase::class);
it('creates and resolves the exact configured Template root without NVL Auth or Tenancy', function (): void {
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        $template = app(CreateTemplateAction::class)->execute(CreateTemplateData::from(['key' => 'welcome', 'translations' => ['en' => ['title' => 'Welcome']]]), TemplateActorData::system());
        expect($template::class)->toBe(OwnershipTemplate::class)->and(TemplateModelRegistry::query()->count())->toBe(1);
    });
});
it('uses the configured root when synchronizing code definitions and resolving factories', function (): void {
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        app(SyncTemplateDefinitionsAction::class)->execute(false);
        expect(TemplateModelRegistry::query()->firstOrFail()::class)->toBe(OwnershipTemplate::class)->and(Template::factory()->make()::class)->toBe(OwnershipTemplate::class);
    });
});
it('diagnoses the actual adopted Template schema and scoped identities', function (): void {
    app(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), function (): void {
        app(SyncTemplateDefinitionsAction::class)->execute();
        $checks = app(TemplatesDoctor::class)->inspect('database');
        expect($checks['schema.ownership'] ?? null)->toBeTrue()->and($checks['indexes.templates.canonical'])->toBeTrue()->and($checks['indexes.template_assignments.canonical'])->toBeTrue()->and($checks['indexes.template_renders.canonical'])->toBeTrue();
    });
});
