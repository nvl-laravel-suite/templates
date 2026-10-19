<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests;

use Nvl\Content\Data\ContentCompositionSnapshotData;
use Nvl\Content\Services\ContentSnapshotIntegrity;
use Nvl\Ownership\Services\OwnerIdentityResolver;
use Nvl\Ownership\ValueObjects\OwnershipMapping;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;

/** Seeds a hash-valid released snapshot before any ownership activation. */
abstract class OwnershipAdoptionTestCase extends OwnershipTestCase
{
    public string $legacyVersionId = '10000000-0000-4000-8000-000000000002';

    protected function reviewedMappings(): array
    {
        $template = TemplateModelRegistry::newInstance();
        $c = $template->getConnection();
        $id = '10000000-0000-4000-8000-000000000001';
        $c->table($template->getTable())->insert(['id' => $id, 'key' => 'welcome', 'renderer' => 'test', 'status' => 'active', 'schema' => '{}', 'revision' => 1, 'company_id' => 7]);
        $snapshot = new ContentCompositionSnapshotData((new TemplateVersion)->getMorphClass(), $this->legacyVersionId, TemplateVersion::CONTENT_GROUP, [], 'pending');
        $hash = app(ContentSnapshotIntegrity::class)->digest($snapshot);
        $snapshot = new ContentCompositionSnapshotData($snapshot->ownerType, $snapshot->ownerId, $snapshot->group, [], $hash);
        $c->table((new TemplateVersion)->getTable())->insert(['id' => $this->legacyVersionId, 'template_id' => $id, 'version' => 1, 'status' => 'published', 'revision' => 1, 'content_snapshot' => json_encode($snapshot->toArray(), JSON_THROW_ON_ERROR), 'content_hash' => $hash]);
        $owner = app(OwnerIdentityResolver::class)->reference(OwnershipCompany::findOrFail(7));

        return [new OwnershipMapping('templates.templates', $id, $owner), new OwnershipMapping('templates.versions', $this->legacyVersionId, $owner)];
    }
}
