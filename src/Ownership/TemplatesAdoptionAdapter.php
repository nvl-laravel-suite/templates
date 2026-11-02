<?php

declare(strict_types=1);

namespace Nvl\Templates\Ownership;

use Nvl\Ownership\Services\FreshHostOwnershipAdoptionAdapter;

/**
 * Installs the fresh native document graph through real Ownership adoption.
 *
 * The native helper refuses populated resources in every phase; legacy Blade
 * or Content graphs require a separately reviewed migration and are not converted.
 *
 * @internal
 */
final class TemplatesAdoptionAdapter extends FreshHostOwnershipAdoptionAdapter
{
    /** @return list<string> Canonical roots before their inherited children. */
    public function resources(): array
    {
        return [
            'templates.templates',
            'templates.groups',
            'templates.resources',
            'templates.assets',
            'templates.drafts',
            'templates.revisions',
            'templates.family-changes',
            'templates.group-revisions',
            'templates.resource-revisions',
            'templates.renders',
        ];
    }
}
