<?php

declare(strict_types=1);

namespace Nvl\Templates\Definitions\Tables;

use Nvl\Support\Config\PackageStorage;

/** Canonical table identities owned by the document engine. */
final class TemplatesTables
{
    public const string Groups = 'nvl_templates_groups';

    public const string GroupRevisions = 'nvl_templates_group_revisions';

    public const string Templates = 'nvl_templates_templates';

    public const string Drafts = 'nvl_templates_drafts';

    public const string Revisions = 'nvl_templates_revisions';

    public const string Resources = 'nvl_templates_resources';

    public const string ResourceRevisions = 'nvl_templates_resource_revisions';

    public const string Assets = 'nvl_templates_assets';

    public const string Renders = 'nvl_templates_renders';

    public const string FamilyChanges = 'nvl_templates_family_changes';

    /** Resolve a logical key, canonical constant or configured physical table. */
    public static function get(string $key): string
    {
        return PackageStorage::resolveTable('templates', $key);
    }

    private function __construct() {}
}
