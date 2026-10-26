<?php

declare(strict_types=1);

use Illuminate\Database\Eloquent\Model;
use Nvl\Content\Providers\ContentServiceProvider;
use Nvl\Media\Providers\MediaServiceProvider;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateVersion;
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
