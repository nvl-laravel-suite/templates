<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class DependencyLifecycleTest extends TestCase
{
    use RefreshDatabase;

    #[DataProvider('retainedStatuses')]
    public function test_retirement_hides_new_selections_without_revoking_published_snapshots(string $status): void
    {
        $api = app(Templates::class);
        $resource = $api->createResource('copy', 'Copy', 'content');
        $api->publishResource($resource->id, ['value' => 'Retained copy'], 0);
        $template = $api->createTemplate('retained', 'Retained');
        $document = Documents::standalone();
        $document['content']['headline'] = ['kind' => 'content', 'id' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $api->saveDraft($template->id, $document, 0);
        $release = $api->publish($template->id, 1);
        $resource->update(['status' => $status]);

        self::assertCount(0, $api->resourcesFor($template->id));
        self::assertStringContainsString('Retained copy', $api->render($release->id, facts: ['code' => 'ABC'])->html);
        $resource->update(['status' => 'revoked']);
        $this->expectException(ValidationException::class);
        $api->render($release->id, facts: ['code' => 'ABC']);
    }

    public static function retainedStatuses(): iterable
    {
        yield 'retired' => ['retired'];
        yield 'hidden' => ['hidden'];
    }

    public function test_readable_pinned_resources_still_require_current_render_permission(): void
    {
        $api = app(Templates::class);
        $resource = $api->createResource('restricted', 'Restricted', 'content');
        $api->publishResource($resource->id, ['value' => 'Pinned'], 0);
        $template = $api->createTemplate('restricted', 'Restricted');
        $document = Documents::standalone();
        $document['content']['headline'] = ['kind' => 'content', 'id' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $api->saveDraft($template->id, $document, 0);
        $revision = $api->publish($template->id, 1);
        $request = $api->renders()->accept($revision->id, facts: ['code' => 'ABC']);
        Gate::define('templates.render', fn ($user = null, $subject = null) => ! $subject instanceof TemplateResource);
        self::assertTrue(Gate::allows('templates.render', $revision));
        self::assertTrue(Gate::allows('templates.read', $resource));
        self::assertSame('failed', $api->renders()->process($request->id)->status);
        $this->expectException(AuthorizationException::class);
        $api->render($revision->id, facts: ['code' => 'ABC']);
    }
}
