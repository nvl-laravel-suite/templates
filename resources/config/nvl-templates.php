<?php

declare(strict_types=1);
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Rendering\BladeTemplateRenderer;
use Nvl\Templates\Rendering\MpdfTemplateRenderer;
use Nvl\Templates\Services\ConfiguredTemplateAuthorization;

return [
    'connection' => null,
    'tables' => ['templates' => TemplatesTables::Templates, 'templates_i18n' => TemplatesTables::I18n, 'template_versions' => TemplatesTables::Versions, 'template_assignments' => TemplatesTables::Assignments, 'template_renders' => TemplatesTables::Renders],
    'migrations' => ['enabled' => true],
    'authorization' => ['class' => ConfiguredTemplateAuthorization::class],
    'routes' => ['management' => ['enabled' => false, 'prefix' => 'nvl/api/v1/templates', 'name' => 'nvl.templates.management.', 'middleware' => ['api', 'auth', 'throttle:60,1']], 'render' => ['enabled' => false, 'prefix' => 'nvl/api/v1/templates/render', 'name' => 'nvl.templates.render.', 'middleware' => ['api', 'auth', 'throttle:60,1']]],
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
    'rendering' => ['connection' => null],
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
];
