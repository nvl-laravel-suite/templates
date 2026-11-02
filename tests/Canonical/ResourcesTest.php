<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;

final class ResourcesTest extends TestCase
{
    use RefreshDatabase;

    public function test_partial_catalog_is_scoped_and_duplicate_names_do_not_shadow(): void
    {
        $api = app(Templates::class);
        self::assertTrue(method_exists($api, 'createResource'));
        $group = $api->createGroup('experiences', 'Experiences');
        $a = $api->createTemplate('classic', 'Classic', $group->id);
        $b = $api->createTemplate('standalone', 'Standalone');
        $library = $api->createResource('footer', 'Shared footer', 'partial');
        $family = $api->createResource('footer', 'Family footer', 'partial', 'group', $group->id);
        $local = $api->createResource('footer', 'Local footer', 'partial', 'template', $a->id);
        $api->createResource('private', 'Private', 'partial', 'template', $b->id);
        self::assertEqualsCanonicalizing([$library->id, $family->id, $local->id], $api->resourcesFor($a->id)->pluck('id')->all());
        self::assertCount(2, $api->resourcesFor($b->id));
    }

    public function test_published_content_reference_captures_exact_bytes_and_revision(): void
    {
        $api = app(Templates::class);
        self::assertTrue(method_exists($api, 'createResource'));
        $resource = $api->createResource('heading', 'Heading', 'content');
        $copy = $api->publishResource($resource->id, ['value' => 'Original copy'], 0);
        $t = $api->createTemplate('email', 'Email');
        $doc = Documents::standalone();
        $doc['content']['headline'] = ['kind' => 'content', 'id' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $draft = $api->saveDraft($t->id, $doc, 0);
        $release = $api->publish($t->id, $draft->version);
        $api->publishResource($resource->id, ['value' => 'Changed copy'], 1);
        self::assertSame('Original copy', $release->document['content']['headline']);
        self::assertSame($copy->id, $release->dependencies[0]['revisionId']);
        self::assertStringContainsString('Original copy', $api->render($release->id, facts: ['code' => 'ABC'])->html);
    }

    public function test_forged_reference_to_another_templates_partial_or_content_fails(): void
    {
        $api = app(Templates::class);
        self::assertTrue(method_exists($api, 'createResource'));
        $a = $api->createTemplate('a', 'A');
        $b = $api->createTemplate('b', 'B');
        $r = $api->createResource('private', 'Private', 'content', 'template', $a->id);
        $api->publishResource($r->id, ['value' => 'Secret'], 0);
        $doc = Documents::standalone();
        $doc['content']['headline'] = ['kind' => 'content', 'id' => $r->id, 'revision' => 1, 'path' => 'value'];
        $draft = $api->saveDraft($b->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($b->id, $draft->version);
    }

    public function test_group_publication_pins_its_shared_content_before_variants_are_created(): void
    {
        $api = app(Templates::class);
        $group = $api->createGroup('experiences', 'Experiences');
        $resource = $api->createResource('heading', 'Heading', 'content', 'group', $group->id);
        $copy = $api->publishResource($resource->id, ['value' => 'Family copy'], 0);
        $doc = Documents::standalone();
        $doc['content']['headline'] = ['kind' => 'content', 'id' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $family = $api->publishGroup($group->id, $doc, 0);
        $api->publishResource($resource->id, ['value' => 'Next copy'], 1);
        $t = $api->createTemplate('classic', 'Classic', $group->id);
        $variant = Documents::variant($group->id, 1, 'unused');
        $variant['source']['overrides'] = [];
        $d = $api->saveDraft($t->id, $variant, 0);
        $release = $api->publish($t->id, $d->version);
        self::assertSame('Family copy', $release->document['content']['headline']);
        self::assertSame($copy->id, $release->dependencies[0]['revisionId']);
        self::assertSame($doc, $family->source);
    }
}
