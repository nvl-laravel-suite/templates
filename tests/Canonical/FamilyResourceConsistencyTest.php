<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\GenericUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Services\FamilyLifecycle;
use Nvl\Templates\Services\ResourceManager;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\ClonerClient as ResourceCloner;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;

final class FamilyResourceConsistencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_detach_does_not_reuse_a_copy_whose_current_restrictions_were_changed(): void
    {
        $api = app(Templates::class);
        $group = $api->createGroup('g', 'Group');
        $template = $api->createTemplate('t', 'Template', $group->id);
        $resource = $api->createResource('copy', 'Copy', 'content', 'group', $group->id);
        $resource->update(['restrictions' => ['channels' => ['email']]]);
        $api->publishResource($resource->id, ['value' => 'Restricted copy'], 0);
        $source = Documents::standalone();
        $source['content']['headline'] = ['kind' => 'content', 'id' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $cloner = app(ResourceCloner::class);
        [, $first] = $cloner->copy($template, $source);
        $firstId = $first[$resource->id.'@1']['resourceId'];
        TemplateResource::query()->findOrFail($firstId)->update(['restrictions' => []]);
        [, $second] = $cloner->copy($template, $source);
        $secondId = $second[$resource->id.'@1']['resourceId'];
        self::assertNotSame($firstId, $secondId);
        self::assertSame(['channels' => ['email']], TemplateResource::query()->findOrFail($secondId)->restrictions);
    }

    private function proposedScope(): array
    {
        $api = app(Templates::class);
        $old = $api->createGroup('old', 'Old');
        $target = $api->createGroup('new', 'New');
        $api->publishGroup($old->id, Documents::standalone(), 0);
        $api->publishGroup($target->id, Documents::standalone(), 0);
        $template = $api->createTemplate('t', 'Template', $old->id);
        $source = Documents::variant($old->id, 1, 'Local');
        $api->saveDraft($template->id, $source, 0);
        $life = app(FamilyLifecycle::class);
        $candidate = $life->prepare($template->id, 'regroup', ['groupId' => $target->id, 'revision' => 1], 1, CanonicalJson::hash($source), $this->actor());
        $life->apply($template->id, $candidate['id'], array_fill_keys(array_column($candidate['conflicts'], 'id'), 'family'), 1, CanonicalJson::hash($source), $this->actor());
        $resource = $api->createResource('new-copy', 'New copy', 'content', 'group', $target->id);
        $api->publishResource($resource->id, ['value' => 'New'], 0);
        $this->actingAs(new GenericUser(['id' => 'staff']));
        Gate::define('templates.read', fn ($user, $record = null) => ! ($record instanceof Template && $record->group_id === $old->id));

        return [$template, $resource];
    }

    public function test_proposed_catalog_authorizes_the_actual_template_before_projecting_its_scope(): void
    {
        [$template] = $this->proposedScope();
        $this->expectException(AuthorizationException::class);
        app(ResourceManager::class)->catalog($template->id, null, $this->actor());
    }

    public function test_proposed_exact_revision_read_authorizes_the_actual_template(): void
    {
        [$template, $resource] = $this->proposedScope();
        $this->expectException(AuthorizationException::class);
        app(ResourceManager::class)->revisionFor($template->id, $resource->id, 1, $this->actor());
    }

    public function test_detaching_a_regrouped_draft_authorizes_the_actual_template_and_uses_the_proposed_resource_scope(): void
    {
        $api = app(Templates::class);
        $old = $api->createGroup('old-family', 'Old family');
        $target = $api->createGroup('target-family', 'Target family');
        $api->publishGroup($old->id, Documents::standalone(), 0);
        $api->publishGroup($target->id, Documents::standalone(), 0);
        $template = $api->createTemplate('variant', 'Variant', $old->id);
        $source = Documents::variant($old->id, 1, 'Local');
        $api->saveDraft($template->id, $source, 0);
        $lifecycle = app(FamilyLifecycle::class);
        $regroup = $lifecycle->prepare($template->id, 'regroup', ['groupId' => $target->id, 'revision' => 1], 1, CanonicalJson::hash($source), $this->actor());
        $lifecycle->apply($template->id, $regroup['id'], [], 1, CanonicalJson::hash($source), $this->actor());
        $resource = $api->createResource('target-copy', 'Target copy', 'content', 'group', $target->id);
        $api->publishResource($resource->id, ['value' => 'Target scoped copy'], 0);
        $source = TemplateDraft::query()->where('template_id', $template->id)->firstOrFail()->document;
        $source['source']['overrides']['content']['headline'] = ['kind' => 'content', 'id' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $api->saveDraft($template->id, $source, 2);
        $this->actingAs(new GenericUser(['id' => 'staff']));
        Gate::define('templates.manage', fn ($user, $record = null) => ! ($record instanceof Template && $record->group_id === $target->id));
        $checksum = CanonicalJson::hash($source);
        $detach = $lifecycle->prepare($template->id, 'detach', null, 3, $checksum, $this->actor());

        $applied = $lifecycle->apply($template->id, $detach['id'], [], 3, $checksum, $this->actor());

        $draft = TemplateDraft::query()->where('template_id', $template->id)->firstOrFail();
        $copy = TemplateResource::query()->findOrFail($draft->document['content']['headline']['id']);
        self::assertSame(4, $applied['version']);
        self::assertSame('standalone', $draft->document['source']['mode']);
        self::assertSame($template->id, $copy->template_id);
        self::assertSame($old->id, $template->fresh()->group_id);
    }
}
