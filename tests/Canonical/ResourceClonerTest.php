<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Models\TemplateResourceRevision;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\ClonerClient as ResourceCloner;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;

final class ResourceClonerTest extends TestCase
{
    use RefreshDatabase;

    public function test_copied_revision_retains_a_restrictive_origin_foreign_key(): void
    {
        $api = app(Templates::class);
        $g = $api->createGroup('copy-origin', 'Origin');
        $t = $api->createTemplate('copy-target', 'Target', $g->id);
        $r = $api->createResource('copy-source', 'Source', 'content', 'group', $g->id);
        $origin = $api->publishResource($r->id, ['value' => 'Retained'], 0);
        [$source,$map] = app(ResourceCloner::class)->copy($t, ['content' => ['headline' => ['kind' => 'content', 'id' => $r->id, 'revision' => 1, 'path' => 'value']]]);
        $copy = TemplateResourceRevision::query()->findOrFail($map[$r->id.'@1']['revisionId']);
        self::assertSame($origin->id, $copy->origin_revision_id);
        $this->expectException(QueryException::class);
        TemplateResourceRevision::query()->whereKey($origin->id)->delete();
    }

    public function test_distinct_revisions_of_one_group_resource_get_distinct_pinned_copies(): void
    {
        $api = app(Templates::class);
        $g = $api->createGroup('copies', 'Copies');
        $t = $api->createTemplate('copies-target', 'Target', $g->id);
        $r = $api->createResource('source', 'Source', 'content', 'group', $g->id);
        $api->publishResource($r->id, ['value' => 'One'], 0);
        $api->publishResource($r->id, ['value' => 'Two'], 1);
        $raw = ['dependencies' => [['resourceId' => $r->id, 'revision' => 1], ['resourceId' => $r->id, 'revision' => 2]], 'managedAssets' => ['logo' => 'retained-byte-id']];
        [$source,$map] = app(ResourceCloner::class)->copy($t, $raw);
        self::assertNotSame($map[$r->id.'@1']['resourceId'], $map[$r->id.'@2']['resourceId']);
        self::assertSame($raw['managedAssets'], $source['managedAssets']);
        self::assertSame('One', TemplateResourceRevision::query()->findOrFail($map[$r->id.'@1']['revisionId'])->document['value']);
        [$again,$reuse] = app(ResourceCloner::class)->copy($t, $raw);
        self::assertSame($source, $again);
        self::assertSame($map, $reuse);
    }

    public function test_an_existing_copy_is_reused_when_the_database_returns_its_provenance_keys_in_another_order(): void
    {
        $api = app(Templates::class);
        $g = $api->createGroup('reordered', 'Reordered');
        $t = $api->createTemplate('reordered-target', 'Target', $g->id);
        $r = $api->createResource('reordered-source', 'Source', 'content', 'group', $g->id);
        $api->publishResource($r->id, ['value' => 'One'], 0);
        $raw = ['dependencies' => [['resourceId' => $r->id, 'revision' => 1]]];
        [, $map] = app(ResourceCloner::class)->copy($t, $raw);
        $copy = TemplateResourceRevision::query()->findOrFail($map[$r->id.'@1']['revisionId']);
        // MySQL's JSON type returns object keys in its own order; emulate that on every driver.
        DB::table($copy->getTable())->where('id', $copy->id)->update(['provenance' => json_encode(array_reverse($copy->provenance, true), JSON_THROW_ON_ERROR)]);

        [, $again] = app(ResourceCloner::class)->copy($t, $raw);

        self::assertSame($map, $again);
        self::assertSame(1, TemplateResourceRevision::query()->where('origin_revision_id', $copy->origin_revision_id)->count());
    }

    public function test_ordinary_content_objects_with_resource_shaped_fields_are_not_dependencies(): void
    {
        $api = app(Templates::class);
        $g = $api->createGroup('plain-family', 'Family');
        $t = $api->createTemplate('plain-target', 'Target', $g->id);
        $raw = ['content' => ['reference' => ['resourceId' => 'ordinary-external-id', 'revision' => 7], 'dependencies' => [['resourceId' => 'ordinary-data', 'revision' => 9]]]];
        [$copy,$map] = app(ResourceCloner::class)->copy($t, $raw);
        self::assertSame($raw, $copy);
        self::assertSame([], $map);
    }

    public function test_nonexportable_tenant_dependency_blocks_detach_even_though_it_would_be_retained(): void
    {
        $api = app(Templates::class);
        $g = $api->createGroup('restricted-family', 'Family');
        $t = $api->createTemplate('restricted-target', 'Target', $g->id);
        $r = $api->createResource('restricted', 'Restricted', 'theme');
        $api->publishResource($r->id, ['value' => 'Restricted'], 0);
        $r->update(['restrictions' => ['exportable' => false]]);
        $this->expectException(ValidationException::class);
        app(ResourceCloner::class)->copy($t, ['dependencies' => [['resourceId' => $r->id, 'revision' => 1]]]);
    }
}
