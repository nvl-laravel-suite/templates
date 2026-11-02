<?php

declare(strict_types=1);

use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Services\ConfiguredTemplateAuthorization;

return [
    'connection' => null,
    'scope' => 'app',
    'models' => ['template' => Template::class],
    'media' => ['disk' => null],
    'authorization' => ['class' => ConfiguredTemplateAuthorization::class],
    'context_provider' => null,
    'render_context' => null,
    'migrations' => ['enabled' => true],
    // Exact destination directory for the publishable React source.
    'frontend' => ['path' => resource_path('js/components/template-maker')],
    'tables' => [
        'groups' => TemplatesTables::Groups, 'group_revisions' => TemplatesTables::GroupRevisions,
        'templates' => TemplatesTables::Templates, 'drafts' => TemplatesTables::Drafts, 'revisions' => TemplatesTables::Revisions,
        'resources' => TemplatesTables::Resources, 'resource_revisions' => TemplatesTables::ResourceRevisions,
        'assets' => TemplatesTables::Assets, 'renders' => TemplatesTables::Renders, 'family_changes' => TemplatesTables::FamilyChanges,
    ],
    'storage' => ['max_bytes' => 10485760],
    'imports' => ['sources' => [], 'allowed_hosts' => [], 'timeout' => 10],
    'limits' => ['document_bytes' => 2097152, 'output_bytes' => 10485760, 'preview_bytes' => 8388608, 'bindings' => 500, 'depth' => 32],
    'compiler' => ['driver' => null, 'command' => [], 'cwd' => null, 'timeout' => 30, 'identity' => null],
    'rendering' => ['queue' => ['enabled' => false, 'connection' => null, 'name' => 'templates'], 'attempts' => 3, 'backoff' => [10, 30, 90], 'lease_seconds' => 120, 'dispatch_timeout' => 600, 'retention_seconds' => 604800],
    'pdf' => ['driver' => null, 'url' => null, 'token' => null, 'api_key' => null, 'timeout' => 20, 'identity' => 'v1', 'input_bytes' => 2097152],
];
