<?php

declare(strict_types=1);
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Rendering\BladeTemplateRenderer;
use Nvl\Templates\Rendering\MpdfTemplateRenderer;
use Nvl\Templates\Services\ConfiguredTemplateAuthorization;

/** Common published defaults; advanced defaults remain in the package configuration. */
return [
    'ownership' => ['owner_resources' => []],
    'models' => ['template' => Template::class],
    'connection' => null,
    'tables' => ['owner_grants' => TemplatesTables::OwnerGrants, 'templates' => TemplatesTables::Templates, 'i18n' => TemplatesTables::I18n, 'versions' => TemplatesTables::Versions, 'assignments' => TemplatesTables::Assignments, 'renders' => TemplatesTables::Renders],
    'migrations' => ['enabled' => true],
    'authorization' => ['class' => ConfiguredTemplateAuthorization::class],
    /*
    |--------------------------------------------------------------------------
    | Source-controlled stored-template definitions
    |--------------------------------------------------------------------------
    |
    | These definitions drive the database implementation. The public
    | Nvl\Templates\Template class can also be rendered directly without rows.
    |
    */
    'definitions' => [],
    'owners' => [],
    /*
    |--------------------------------------------------------------------------
    | Template defaults and renderer implementations
    |--------------------------------------------------------------------------
    |
    | A Template may override these defaults through TemplateOptions. Custom
    | renderer aliases must implement the TemplateRenderer contract.
    |
    */
    'default_renderer' => 'blade',
    'default_locale' => null,
    'renderers' => ['blade' => BladeTemplateRenderer::class, 'pdf' => MpdfTemplateRenderer::class],
    /*
    |--------------------------------------------------------------------------
    | Bundled PDF renderer
    |--------------------------------------------------------------------------
    |
    | PDF definitions use the source-controlled `renderer_options` array.
    | Remote assets fail closed and require an exact host allowlist.
    |
    */
    'pdf' => ['remote_assets' => ['enabled' => false], 'data_images' => ['enabled' => true]],
    'queue' => ['connection' => null],
];
