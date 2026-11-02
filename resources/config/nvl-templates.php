<?php

declare(strict_types=1);

use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Services\ConfiguredTemplateAuthorization;

/** Common host overrides; advanced defaults remain in the installed package. */
return [
    'connection' => null,
    'scope' => 'app',
    'models' => ['template' => Template::class],
    'tables' => [
        'groups' => TemplatesTables::Groups,
        'group_revisions' => TemplatesTables::GroupRevisions,
        'templates' => TemplatesTables::Templates,
        'drafts' => TemplatesTables::Drafts,
        'revisions' => TemplatesTables::Revisions,
        'resources' => TemplatesTables::Resources,
        'resource_revisions' => TemplatesTables::ResourceRevisions,
        'assets' => TemplatesTables::Assets,
        'renders' => TemplatesTables::Renders,
        'family_changes' => TemplatesTables::FamilyChanges,
    ],
    'migrations' => ['enabled' => true],
    'authorization' => ['class' => ConfiguredTemplateAuthorization::class],
    'context_provider' => null,
    'render_context' => null,
    'media' => ['disk' => null],
    // Exact destination directory for the publishable React source.
    'frontend' => ['path' => resource_path('js/components/template-maker')],
    'compiler' => ['driver' => null, 'command' => [], 'identity' => null],
    'rendering' => ['queue' => ['enabled' => false, 'connection' => null, 'name' => 'templates']],
    'pdf' => ['driver' => null, 'url' => null],
];
