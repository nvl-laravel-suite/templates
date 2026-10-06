<?php

declare(strict_types=1);

use Illuminate\Config\Repository;
use Nvl\Support\Contracts\LocaleCatalog;
use Nvl\Support\Facades\Locales;
use Nvl\Support\Locales\ApplicationLocaleCatalog;
use Nvl\Templates\Html\TemplateContext;

it('uses the content catalog for template defaults independently of UI locale', function (): void {
    app()->setLocale('en');
    app()->instance(LocaleCatalog::class, new ApplicationLocaleCatalog(new Repository([
        'app' => ['locale' => 'fr', 'fallback_locale' => 'de'],
    ])));
    Locales::clearResolvedInstance(LocaleCatalog::class);

    $context = new TemplateContext;

    expect($context->language)->toBe('fr')
        ->and($context->fallbackLanguage)->toBe('de')
        ->and(app()->getLocale())->toBe('en');
});
