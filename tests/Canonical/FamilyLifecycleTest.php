<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Drivers\Compiler\LocalNodeCompiler;
use Nvl\Templates\Exceptions\DraftConflict;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Models\TemplateResourceRevision;
use Nvl\Templates\Services\FamilyLifecycle;
use Nvl\Templates\Services\TemplateReader as EditorPayload;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class FamilyLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function setupVariant(): array
    {
        $api = app(Templates::class);
        $g = $api->createGroup('family', 'Family');
        $api->publishGroup($g->id, Documents::standalone(), 0);
        $t = $api->createTemplate('variant', 'Variant', $g->id);
        $s = Documents::variant($g->id, 1, 'Local');
        $api->saveDraft($t->id, $s, 0);

        return [$api, $g, $t, $s];
    }

    public function test_upgrade_candidate_is_read_only_and_applies_to_draft_only(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $release = $api->publish($t->id, 1);
        $base = Documents::standalone();
        $base['inputDefaults']['message'] = 'Updated';
        $api->publishGroup($g->id, $base, 1);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'upgrade', ['groupId' => $g->id, 'revision' => 2], 1, CanonicalJson::hash($s), $this->actor());
        self::assertSame('pending', $c['status']);
        self::assertSame(1, TemplateDraft::query()->where('template_id', $t->id)->first()->version);
        self::assertSame(2, $c['source']['source']['group']['revision']);
        $r = $l->apply($t->id, $c['id'], [], 1, CanonicalJson::hash($s), $this->actor());
        self::assertSame(2, $r['version']);
        self::assertSame($release->id, $t->fresh()->current_revision_id);
        self::assertSame('Local', $api->publish($t->id, 2)->document['content']['headline']);
    }

    public function test_concurrent_source_edit_rejects_candidate_without_changing_draft(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'detach', null, 1, CanonicalJson::hash($s), $this->actor());
        $s['source']['overrides']['content']['headline'] = 'New';
        $api->saveDraft($t->id, $s, 1);
        $this->expectException(DraftConflict::class);
        $l->apply($t->id, $c['id'], [], 1, $c['sourceChecksum'], $this->actor());
    }

    public static function publishedFamilyChanges(): array
    {
        return ['upgrade' => ['upgrade'], 'regroup' => ['regroup'], 'detach' => ['detach']];
    }

    #[DataProvider('publishedFamilyChanges')]
    public function test_publication_clears_the_proposed_basis_without_changing_draft_authority(string $operation): void
    {
        [$api, $group, $template, $source] = $this->setupVariant();
        $oldRelease = $api->publish($template->id, 1);
        $target = null;
        $resource = null;
        $expectedGroup = null;
        if ($operation !== 'detach') {
            $targetGroup = $operation === 'regroup' ? $api->createGroup('target', 'Target') : $group;
            $resource = $api->createResource('target-copy', 'Target copy', 'content', 'group', $targetGroup->id);
            $api->publishResource($resource->id, ['value' => 'Target resource'], 0);
            $document = Documents::standalone();
            $document['dependencies'] = [['resourceId' => $resource->id, 'revision' => 1]];
            $family = $api->publishGroup($targetGroup->id, $document, $operation === 'upgrade' ? 1 : 0);
            $target = ['groupId' => $targetGroup->id, 'revision' => $family->revision];
            $expectedGroup = $targetGroup->id;
        }
        $life = app(FamilyLifecycle::class);
        $checksum = CanonicalJson::hash($source);
        $candidate = $life->prepare($template->id, $operation, $target, 1, $checksum, $this->actor());
        $life->apply($template->id, $candidate['id'], array_fill_keys(array_column($candidate['conflicts'], 'id'), 'family'), 1, $checksum, $this->actor());
        $payload = app(EditorPayload::class)->load($template->id, $this->actor());
        self::assertTrue($payload['hasProposedBasis']);
        self::assertSame($expectedGroup, $payload['proposedGroupId']);
        self::assertSame($group->id, $template->fresh()->group_id);
        self::assertSame($oldRelease->id, $template->fresh()->current_revision_id);
        $draft = TemplateDraft::query()->where('template_id', $template->id)->firstOrFail();
        $appliedSource = $draft->document;

        $release = $api->publish($template->id, 2);

        $payload = app(EditorPayload::class)->load($template->id, $this->actor());
        self::assertFalse($payload['hasProposedBasis']);
        self::assertNull($payload['proposedGroupId']);
        self::assertSame([], $payload['issues']);
        self::assertNull($draft->fresh()->proposed_basis);
        self::assertSame(2, $draft->fresh()->version);
        self::assertSame($appliedSource, $draft->fresh()->document);
        self::assertSame($appliedSource, $release->source);
        self::assertSame($expectedGroup, $template->fresh()->group_id);
        self::assertSame($release->id, $template->fresh()->current_revision_id);
        self::assertSame($expectedGroup, $api->authoringTemplate($template->fresh())->group_id);
        self::assertSame('applied', $life->get($template->id, $candidate['id'], $this->actor())['status']);
        if ($target !== null) {
            self::assertSame($target, ['groupId' => $draft->fresh()->document['source']['group']['id'], 'revision' => $draft->fresh()->document['source']['group']['revision']]);
            self::assertContains($resource->id, $api->resourcesFor($template->id)->pluck('id')->all());
        } else {
            self::assertSame('standalone', $draft->fresh()->document['source']['mode']);
        }
        if ($operation === 'detach') {
            $appliedSource['content']['headline'] = 'Edited after publication';
        } else {
            $appliedSource['source']['overrides']['content']['headline'] = 'Edited after publication';
        }
        self::assertSame(3, $api->saveDraft($template->id, $appliedSource, 2)->version);
        $nextRelease = $api->publish($template->id, 3);
        self::assertSame('Edited after publication', $nextRelease->document['content']['headline']);
        self::assertSame($expectedGroup, $nextRelease->group_id);
        self::assertFalse(app(EditorPayload::class)->load($template->id, $this->actor())['hasProposedBasis']);
    }

    public function test_failed_publication_retains_the_proposed_basis_and_published_release(): void
    {
        [$api, $group, $template, $source] = $this->setupVariant();
        $release = $api->publish($template->id, 1);
        $api->publishGroup($group->id, Documents::standalone(), 1);
        $life = app(FamilyLifecycle::class);
        $checksum = CanonicalJson::hash($source);
        $candidate = $life->prepare($template->id, 'upgrade', ['groupId' => $group->id, 'revision' => 2], 1, $checksum, $this->actor());
        $life->apply($template->id, $candidate['id'], [], 1, $checksum, $this->actor());
        $draft = TemplateDraft::query()->where('template_id', $template->id)->firstOrFail();
        $proposed = $draft->proposed_basis;
        $invalid = $draft->document;
        $invalid['source']['overrides']['content']['headline'] = false;
        $api->saveDraft($template->id, $invalid, 2);

        try {
            $api->publish($template->id, 3);
            self::fail('Expected invalid content to block publication');
        } catch (ValidationException) {
        }

        self::assertSame($proposed, $draft->fresh()->proposed_basis);
        self::assertSame(3, $draft->fresh()->version);
        self::assertSame($invalid, $draft->fresh()->document);
        self::assertSame($group->id, $template->fresh()->group_id);
        self::assertSame($release->id, $template->fresh()->current_revision_id);
        self::assertTrue(app(EditorPayload::class)->load($template->id, $this->actor())['hasProposedBasis']);
    }

    public function test_detach_clones_transitive_group_closure_and_defers_membership_until_publish(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $tenant = $api->createResource('tenant', 'Tenant', 'content');
        $api->publishResource($tenant->id, ['value' => 'Shared'], 0);
        $child = $api->createResource('child', 'Child', 'content', 'group', $g->id);
        $api->publishResource($child->id, ['value' => 'Copied'], 0);
        $parent = $api->createResource('parent', 'Parent', 'theme', 'group', $g->id);
        $api->publishResource($parent->id, ['dependencies' => [['resourceId' => $child->id, 'revision' => 1], ['resourceId' => $tenant->id, 'revision' => 1]]], 0);
        $base = Documents::standalone();
        $base['dependencies'] = [['resourceId' => $parent->id, 'revision' => 1]];
        $api->publishGroup($g->id, $base, 1);
        $s['source']['group']['revision'] = 2;
        $api->saveDraft($t->id, $s, 1);
        $old = $api->publish($t->id, 2);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'detach', null, 2, CanonicalJson::hash($s), $this->actor());
        self::assertSame(3, TemplateResource::query()->count());
        $result = $l->apply($t->id, $c['id'], [], 2, CanonicalJson::hash($s), $this->actor());
        self::assertSame($g->id, $t->fresh()->group_id);
        self::assertSame('standalone', $result['source']['source']['mode']);
        $copies = TemplateResource::query()->where('template_id', $t->id)->get();
        self::assertCount(2, $copies);
        $visible = $api->resourcesFor($t->id)->pluck('id')->all();
        self::assertNotContains($parent->id, $visible);
        self::assertNotContains($child->id, $visible);
        foreach ($copies as $copy) {
            self::assertContains($copy->id, $visible);
        }
        foreach ($copies as $copy) {
            $rev = TemplateResourceRevision::query()->where('resource_id', $copy->id)->first();
            self::assertNotNull($rev->provenance['revisionId']);
        }
        $new = $api->publish($t->id, 3);
        self::assertNull($t->fresh()->group_id);
        self::assertNull($new->group_id);
        self::assertSame($g->id, $old->fresh()->group_id);
        self::assertStringContainsString('Local', $api->render($old->id, facts: ['code' => 'ABC'])->html);
        self::assertContains($tenant->id, array_column($new->dependencies, 'resourceId'));
    }

    public function test_copy_denial_leaves_no_partial_resources_or_draft(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $r = $api->createResource('x', 'X', 'content', 'group', $g->id);
        $api->publishResource($r->id, ['value' => 'x'], 0);
        $base = Documents::standalone();
        $base['dependencies'] = [['resourceId' => $r->id, 'revision' => 1]];
        $api->publishGroup($g->id, $base, 1);
        $s['source']['group']['revision'] = 2;
        $api->saveDraft($t->id, $s, 1);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'detach', null, 2, CanonicalJson::hash($s), $this->actor());
        Gate::define('templates.copy', fn () => false);
        try {
            $l->apply($t->id, $c['id'], [], 2, CanonicalJson::hash($s), $this->actor());
            self::fail('Expected copy denial');
        } catch (AuthorizationException) {
        }
        self::assertSame(1, TemplateResource::query()->count());
        self::assertSame(2, TemplateDraft::query()->where('template_id', $t->id)->first()->version);
    }

    public function test_regroup_reports_unrepresentable_theme_and_requires_explicit_adoption(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $other = $api->createGroup('other', 'Other');
        $base = Documents::standalone();
        $base['theme'] = ['custom' => 'different'];
        $api->publishGroup($other->id, $base, 0);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'regroup', ['groupId' => $other->id, 'revision' => 1], 1, CanonicalJson::hash($s), $this->actor());
        self::assertNotEmpty($c['conflicts']);
        $choices = [];
        foreach ($c['conflicts'] as $conflict) {
            $choices[$conflict['id']] = 'family';
        }
        $l->apply($t->id, $c['id'], $choices, 1, CanonicalJson::hash($s), $this->actor());
        self::assertSame($g->id, $t->fresh()->group_id);
        $release = $api->publish($t->id, 2);
        self::assertSame($other->id, $release->group_id);
        self::assertSame($other->id, $t->fresh()->group_id);
    }

    public function test_rebase_conflict_requires_choice_and_keeps_local_only_when_valid(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $base = Documents::standalone('Changed family copy');
        $api->publishGroup($g->id, $base, 1);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'rebase', ['groupId' => $g->id, 'revision' => 2], 1, CanonicalJson::hash($s), $this->actor());
        self::assertSame('content.headline', $c['conflicts'][0]['id']);
        try {
            $l->apply($t->id, $c['id'], [], 1, CanonicalJson::hash($s), $this->actor());
            self::fail('Expected unresolved conflicts');
        } catch (ValidationException) {
        }
        self::assertSame(1, TemplateDraft::query()->where('template_id', $t->id)->first()->version);
        $l->apply($t->id, $c['id'], ['content.headline' => 'family'], 1, CanonicalJson::hash($s), $this->actor());
        self::assertSame('Changed family copy', $api->publish($t->id, 2)->document['content']['headline']);
    }

    public function test_later_family_publication_does_not_move_a_reviewed_target_pin(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $api->publishGroup($g->id, Documents::standalone(), 1);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'upgrade', ['groupId' => $g->id, 'revision' => 2], 1, CanonicalJson::hash($s), $this->actor());
        $api->publishGroup($g->id, Documents::standalone('Latest'), 2);
        $l->apply($t->id, $c['id'], [], 1, CanonicalJson::hash($s), $this->actor());
        self::assertSame(2, $api->publish($t->id, 2)->source['source']['group']['revision']);
    }

    public function test_clone_write_failure_rolls_back_previous_copies_and_candidate_state(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $base = Documents::standalone();
        foreach (['a', 'b'] as $key) {
            $r = $api->createResource($key, $key, 'content', 'group', $g->id);
            $api->publishResource($r->id, ['value' => $key], 0);
            $base['dependencies'][] = ['resourceId' => $r->id, 'revision' => 1];
        }
        $api->publishGroup($g->id, $base, 1);
        $s['source']['group']['revision'] = 2;
        $api->saveDraft($t->id, $s, 1);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'detach', null, 2, CanonicalJson::hash($s), $this->actor());
        $writes = 0;
        Event::listen('eloquent.creating: '.TemplateResourceRevision::class, function ($r) use (&$writes) {
            if ($r->provenance !== null && ++$writes === 2) {
                throw new \RuntimeException('Simulated storage failure');
            }
        });
        try {
            $l->apply($t->id, $c['id'], [], 2, CanonicalJson::hash($s), $this->actor());
            self::fail('Expected write failure');
        } catch (\RuntimeException $e) {
            self::assertSame('Simulated storage failure', $e->getMessage());
        }
        self::assertSame(2, TemplateResource::query()->count());
        self::assertSame(2, TemplateDraft::query()->where('template_id', $t->id)->first()->version);
        self::assertSame('pending', $l->get($t->id, $c['id'], $this->actor())['status']);
    }

    public function test_raw_save_cannot_bypass_candidate_authority_to_change_membership(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $this->expectException(ValidationException::class);
        $api->saveDraft($t->id, Documents::standalone(), 1);
    }

    public function test_structural_draft_needs_fresh_compilation_before_publication(): void
    {
        $api = app(Templates::class);
        $g = $api->createGroup('structural', 'Structural');
        $base = Documents::standalone();
        $base['variationPoints'] = [['id' => 'heading-name', 'label' => 'Heading name', 'kind' => 'node-property', 'nodeId' => 'heading', 'property' => 'name', 'schema' => ['type' => 'string']]];
        $api->publishGroup($g->id, $base, 0);
        $t = $api->createTemplate('structured', 'Structured', $g->id);
        $s = Documents::variant($g->id, 1, 'Local');
        $s['source']['overrides']['variations'] = ['heading-name' => ['kind' => 'node-property', 'value' => 'Local heading']];
        $api->saveDraft($t->id, $s, 0);
        try {
            $api->publish($t->id, 1);
            self::fail('Expected missing compilation');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('compiled', $e->errors());
        }
        $s['compiled'] = ['sourceKey' => json_encode($s, JSON_THROW_ON_ERROR), 'artifacts' => $base['artifacts']];
        $api->saveDraft($t->id, $s, 1);
        try {
            $api->publish($t->id, 2);
            self::fail('Browser compilation cannot replace a trusted server compiler.');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('compiled', $e->errors());
        }
        config()->set('nvl-templates.compiler.driver', LocalNodeCompiler::class);
        config()->set('nvl-templates.compiler.command', ['node', dirname(__DIR__, 2).'/resources/runtime/renderer.mjs']);
        $r = $api->publish($t->id, 2);
        self::assertSame('Local heading', $r->document['source']['definition']['nodes']['heading']['name']);
        self::assertSame('shared', $r->document['artifacts']['engine']);
        $s['source']['overrides']['variations']['heading-name']['value'] = 'Changed again';
        $this->expectException(ValidationException::class);
        $api->saveDraft($t->id, $s, 2);
    }

    public function test_narrowed_content_schema_forbids_keeping_an_invalid_local_value(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $base = Documents::standalone('Base');
        $base['dataSchema']['properties']['content']['properties']['headline']['maxLength'] = 4;
        $api->publishGroup($g->id, $base, 1);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'rebase', ['groupId' => $g->id, 'revision' => 2], 1, CanonicalJson::hash($s), $this->actor());
        $conflict = array_values(array_filter($c['conflicts'], fn ($c) => $c['id'] === 'content.headline'))[0];
        self::assertFalse($conflict['localAllowed']);
        $this->expectException(ValidationException::class);
        $l->apply($t->id, $c['id'], ['content.headline' => 'local'], 1, CanonicalJson::hash($s), $this->actor());
    }

    public function test_regroup_uses_proposed_resource_scope_and_cannot_reapply_an_old_candidate(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $other = $api->createGroup('resource-family', 'Resource family');
        $base = Documents::standalone();
        $api->publishGroup($other->id, $base, 0);
        $oldResource = $api->createResource('old', 'Old', 'partial', 'group', $g->id);
        $newResource = $api->createResource('new', 'New', 'partial', 'group', $other->id);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'regroup', ['groupId' => $other->id, 'revision' => 1], 1, CanonicalJson::hash($s), $this->actor());
        $choices = [];
        foreach ($c['conflicts'] as $conflict) {
            $choices[$conflict['id']] = 'family';
        }
        $l->apply($t->id, $c['id'], $choices, 1, CanonicalJson::hash($s), $this->actor());
        $visible = $api->resourcesFor($t->id)->pluck('id')->all();
        self::assertContains($newResource->id, $visible);
        self::assertNotContains($oldResource->id, $visible);
        self::assertSame($g->id, $t->fresh()->group_id);
        $draft = TemplateDraft::query()->where('template_id', $t->id)->first();
        $api->saveDraft($t->id, $draft->document, 2);
        self::assertSame(3, $draft->fresh()->version);
        $this->expectException(DraftConflict::class);
        $l->apply($t->id, $c['id'], $choices, 1, CanonicalJson::hash($s), $this->actor());
    }

    public function test_grouped_source_rejects_an_independently_editable_graph(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $s['source']['definition'] = Documents::standalone()['source']['definition'];
        $this->expectException(ValidationException::class);
        $api->saveDraft($t->id, $s, 1);
    }

    public function test_changed_family_children_order_conflicts_with_an_existing_region_override(): void
    {
        $api = app(Templates::class);
        $g = $api->createGroup('ordered', 'Ordered');
        $base = Documents::standalone();
        $node = $base['source']['definition']['nodes']['heading'];
        foreach (['a', 'b'] as $id) {
            $node['id'] = $id;
            $base['source']['definition']['nodes'][$id] = $node;
        }
        $base['source']['definition']['nodes']['container'] = ['id' => 'container', 'name' => 'Container', 'kind' => 'element', 'tag' => 'div', 'attributes' => [], 'attributeBindings' => [], 'style' => [], 'classes' => [], 'children' => ['heading', 'a', 'b'], 'permissions' => ['content' => false, 'style' => false]];
        $base['source']['definition']['roots'] = ['container'];
        $base['variationPoints'] = [['id' => 'region', 'label' => 'Order', 'kind' => 'children', 'target' => ['kind' => 'children', 'nodeId' => 'container'], 'minItems' => 0, 'maxItems' => 3, 'allowedKinds' => ['text']]];
        $api->publishGroup($g->id, $base, 0);
        $t = $api->createTemplate('ordered-variant', 'Variant', $g->id);
        $s = Documents::variant($g->id, 1, 'Local');
        $s['source']['overrides']['variations'] = ['region' => ['kind' => 'children', 'order' => ['b', 'heading', 'a']]];
        $api->saveDraft($t->id, $s, 0);
        $base['source']['definition']['nodes']['container']['children'] = ['a', 'heading', 'b'];
        $api->publishGroup($g->id, $base, 1);
        $c = app(FamilyLifecycle::class)->prepare($t->id, 'rebase', ['groupId' => $g->id, 'revision' => 2], 1, CanonicalJson::hash($s), $this->actor());
        self::assertContains('variations.region', array_column($c['conflicts'], 'id'));
    }

    public function test_regroup_preserves_representable_differences_when_target_declares_extra_points(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $other = $api->createGroup('more-points', 'More points');
        $base = Documents::standalone();
        $base['variationPoints'] = [['id' => 'name', 'label' => 'Heading name', 'kind' => 'node-property', 'nodeId' => 'heading', 'property' => 'name', 'schema' => ['type' => 'string']]];
        $api->publishGroup($other->id, $base, 0);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'regroup', ['groupId' => $other->id, 'revision' => 1], 1, CanonicalJson::hash($s), $this->actor());
        self::assertSame([], $c['conflicts']);
        $l->apply($t->id, $c['id'], [], 1, CanonicalJson::hash($s), $this->actor());
        self::assertSame('Local', $api->publish($t->id, 2)->document['content']['headline']);
    }

    public function test_regroup_cannot_keep_content_outside_the_target_schema(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $other = $api->createGroup('strict-regroup', 'Strict');
        $base = Documents::standalone('Base');
        $base['dataSchema']['properties']['content']['properties']['headline']['maxLength'] = 4;
        $api->publishGroup($other->id, $base, 0);
        $c = app(FamilyLifecycle::class)->prepare($t->id, 'regroup', ['groupId' => $other->id, 'revision' => 1], 1, CanonicalJson::hash($s), $this->actor());
        self::assertNotEmpty($c['conflicts']);
        self::assertFalse($c['conflicts'][0]['localAllowed']);
    }

    public function test_detach_preview_resolves_content_but_retains_editable_source_references(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $r = $api->createResource('footer-copy', 'Footer', 'content', 'group', $g->id);
        $api->publishResource($r->id, ['value' => 'Resolved footer'], 0);
        $base = Documents::standalone();
        $base['dataSchema']['properties']['content']['properties']['footer'] = ['type' => 'string'];
        $base['content']['footer'] = ['kind' => 'content', 'resourceId' => $r->id, 'revision' => 1, 'path' => 'value'];
        $api->publishGroup($g->id, $base, 1);
        $s['source']['group']['revision'] = 2;
        $api->saveDraft($t->id, $s, 1);
        $c = app(FamilyLifecycle::class)->prepare($t->id, 'detach', null, 2, CanonicalJson::hash($s), $this->actor());
        self::assertSame('Resolved footer', $c['document']['content']->footer);
        self::assertSame($r->id, $c['source']['content']->footer['resourceId']);
    }

    public function test_candidate_retrieval_rechecks_resource_read_permission(): void
    {
        [$api,$g,$t,$s] = $this->setupVariant();
        $r = $api->createResource('review-private', 'Private', 'content', 'group', $g->id);
        $api->publishResource($r->id, ['value' => 'Secret'], 0);
        $base = Documents::standalone();
        $base['dependencies'] = [['resourceId' => $r->id, 'revision' => 1]];
        $api->publishGroup($g->id, $base, 1);
        $s['source']['group']['revision'] = 2;
        $api->saveDraft($t->id, $s, 1);
        $l = app(FamilyLifecycle::class);
        $c = $l->prepare($t->id, 'detach', null, 2, CanonicalJson::hash($s), $this->actor());
        Gate::define('templates.read', fn (?Authenticatable $user, $record = null) => ! ($record instanceof TemplateResource && $record->id === $r->id));
        self::assertSame([], $l->listing($t->id, $this->actor()));
        $this->expectException(AuthorizationException::class);
        $l->get($t->id, $c['id'], $this->actor());
    }
}
