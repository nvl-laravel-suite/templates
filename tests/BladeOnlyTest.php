<?php

declare(strict_types=1);

use Illuminate\Database\Eloquent\Model;
use Nvl\Content\Providers\ContentServiceProvider;
use Nvl\Media\Providers\MediaServiceProvider;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateTranslation;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateDefinitionRegistry;
use Nvl\Templates\Services\TemplateImporter;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\Template;
use Nvl\Templates\Tests\Fixtures\AllowTemplateAuthorization;
use Nvl\Templates\Tests\Fixtures\BladeOnlyTestCase;

uses(BladeOnlyTestCase::class);

it('renders Blade and loads its models without booting optional integrations', function (): void {
    expect(app()->providerIsLoaded(ContentServiceProvider::class))->toBeFalse()
        ->and(app()->providerIsLoaded(MediaServiceProvider::class))->toBeFalse()
        ->and(new TemplateRender)->toBeInstanceOf(Model::class)
        ->and(new TemplateVersion)->toBeInstanceOf(Model::class);
    app()->bind(TemplateAuthorization::class, AllowTemplateAuthorization::class);
    $result = app(TemplateRenderer::class)->render(new Template('standalone', data: ['content' => '<b>Private</b>']), [], [], SystemActor::Background);
    expect($result['mime_type'])->toBe('text/html; charset=UTF-8')->and($result['content'])->toContain('&lt;b&gt;Private&lt;/b&gt;')
        ->and($result['byte_size'])->toBe(strlen($result['content']))->and($result['checksum'])->toBe(hash('sha256', $result['content']));
});

it('persists template children and adopts template records without optional service providers', function (): void {
    app()->bind(TemplateAuthorization::class, AllowTemplateAuthorization::class);
    app(TemplateDefinitionRegistry::class)->register(['key' => 'standalone', 'renderer' => 'blade', 'view' => 'nvl-templates::html.document']);
    $template = app(TemplateLifecycle::class)->create(['key' => 'standalone', 'translations' => ['en' => ['title' => 'Standalone']]], SystemActor::Background);
    $version = app(TemplateLifecycle::class)->createVersion($template, [], SystemActor::Background);

    expect(TemplateTranslation::query()->where('template_id', $template->id)->firstOrFail()->title)->toBe('Standalone')
        ->and($version->fresh()->template_id)->toBe($template->id);
    $result = app(TemplateImporter::class)->adopt([
        'version' => 1, 'legacy_asset_count' => 0,
        'templates' => [['legacy_key' => 'old', 'key' => 'standalone', 'translations' => ['en' => ['title' => 'Adopted']]]],
    ], apply: true);
    expect($result['reconciliation']['templates']['matched'])->toBe(1)
        ->and($template->fresh()->translations->first()->title)->toBe('Adopted')
        ->and(app()->providerIsLoaded(ContentServiceProvider::class))->toBeFalse()
        ->and(app()->providerIsLoaded(MediaServiceProvider::class))->toBeFalse();
});
