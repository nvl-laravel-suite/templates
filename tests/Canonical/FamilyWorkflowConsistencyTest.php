<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Nvl\Templates\Models\FamilyChange;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Services\FamilyLifecycle;
use Nvl\Templates\Services\TemplateReader as EditorPayload;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;

final class FamilyWorkflowConsistencyTest extends TestCase
{
    use RefreshDatabase;

    private function resourceBackedVariant(bool $override = true): array
    {
        $api = app(Templates::class);
        $group = $api->createGroup('family', 'Family');
        $resource = $api->createResource('copy', 'Copy', 'content', 'group', $group->id);
        $api->publishResource($resource->id, ['value' => 'Inherited resource copy'], 0);
        $base = Documents::standalone();
        $base['content']['headline'] = ['kind' => 'content', 'resourceId' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $api->publishGroup($group->id, $base, 0);
        $template = $api->createTemplate('variant', 'Variant', $group->id);
        $source = Documents::variant($group->id, 1, 'Local override');
        if (! $override) {
            $source['source']['overrides'] = [];
        }
        $api->saveDraft($template->id, $source, 0);

        return [$api, $group, $template, $source, $resource];
    }

    public function test_replaced_inherited_content_is_not_retained_as_a_release_dependency(): void
    {
        [$api, , $template] = $this->resourceBackedVariant();
        $release = $api->publish($template->id, 1);

        self::assertSame([], $release->dependencies);
        self::assertSame('Local override', $release->document['content']['headline']);
    }

    public function test_revoking_a_replaced_inherited_reference_does_not_block_publication(): void
    {
        [$api, , $template, , $resource] = $this->resourceBackedVariant();
        $resource->update(['status' => 'revoked']);

        self::assertSame('Local override', $api->publish($template->id, 1)->document['content']['headline']);
    }

    public function test_applied_detach_candidate_returns_the_rewritten_source_it_actually_saved(): void
    {
        [, , $template, $source, $resource] = $this->resourceBackedVariant(override: false);
        $lifecycle = app(FamilyLifecycle::class);
        $checksum = CanonicalJson::hash($source);
        $candidate = $lifecycle->prepare($template->id, 'detach', null, 1, $checksum, $this->actor());
        $applied = $lifecycle->apply($template->id, $candidate['id'], [], 1, $checksum, $this->actor());
        $stored = FamilyChange::query()->findOrFail($candidate['id']);
        $draft = TemplateDraft::query()->where('template_id', $template->id)->firstOrFail();
        $copiedId = $draft->document['content']['headline']['resourceId'];

        self::assertNotSame($resource->id, $copiedId);
        self::assertSame($copiedId, $stored->result['source']['content']['headline']['resourceId']);
        self::assertSame($copiedId, $applied['candidate']['source']['content']->headline['resourceId']);
        self::assertSame($copiedId, $lifecycle->get($template->id, $candidate['id'], $this->actor())['source']['content']->headline['resourceId']);
    }

    public function test_concurrent_variant_save_does_not_abort_the_family_publication(): void
    {
        $api = app(Templates::class);
        $group = $api->createGroup('family', 'Family');
        $api->publishGroup($group->id, Documents::standalone(), 0);
        $template = $api->createTemplate('variant', 'Variant', $group->id);
        $api->saveDraft($template->id, Documents::variant($group->id, 1, 'Local'), 0);
        $reads = 0;
        // Interleave the optimistic draft change between the automatic scan and preparation.
        Event::listen('eloquent.retrieved: '.TemplateDraft::class, function (TemplateDraft $draft) use (&$reads): void {
            if (++$reads === 1) {
                TemplateDraft::query()->where('id', $draft->id)->update(['version' => 2]);
            }
        });

        $release = $api->publishGroup($group->id, Documents::standalone('Updated'), 1);

        self::assertSame(2, $release->revision);
        self::assertSame($release->id, $group->fresh()->current_revision_id);
        self::assertSame(0, FamilyChange::query()->where('template_id', $template->id)->count());
    }

    public function test_family_publication_includes_variants_with_proposed_membership(): void
    {
        $api = app(Templates::class);
        $old = $api->createGroup('old', 'Old');
        $api->publishGroup($old->id, Documents::standalone(), 0);
        $target = $api->createGroup('target', 'Target');
        $api->publishGroup($target->id, Documents::standalone(), 0);
        $template = $api->createTemplate('variant', 'Variant', $old->id);
        $source = Documents::variant($old->id, 1, 'Local');
        $api->saveDraft($template->id, $source, 0);
        $lifecycle = app(FamilyLifecycle::class);
        $candidate = $lifecycle->prepare($template->id, 'regroup', ['groupId' => $target->id, 'revision' => 1], 1, CanonicalJson::hash($source), $this->actor());
        self::assertSame([], $candidate['conflicts']);
        $lifecycle->apply($template->id, $candidate['id'], [], 1, CanonicalJson::hash($source), $this->actor());

        $api->publishGroup($target->id, Documents::standalone(), 1);

        $upgrade = FamilyChange::query()->where('template_id', $template->id)->where('operation', 'upgrade')->sole();
        self::assertSame(2, $upgrade->result['targetRevision']);
        self::assertSame(2, $upgrade->expected_version);
        self::assertSame($old->id, $template->fresh()->group_id);
    }

    public function test_inaccessible_local_reference_can_be_discarded_without_exposing_its_body(): void
    {
        [$api, $group, $template, $source, $resource] = $this->resourceBackedVariant(override: false);
        $source['source']['overrides']['content']['headline'] = ['kind' => 'content', 'resourceId' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $api->saveDraft($template->id, $source, 1);
        $api->publishGroup($group->id, Documents::standalone('Authorized family copy'), 1);
        Gate::define('templates.read', fn (?Authenticatable $user, $record = null) => ! ($record instanceof TemplateResource && $record->id === $resource->id));
        $lifecycle = app(FamilyLifecycle::class);
        $checksum = CanonicalJson::hash($source);

        $candidate = $lifecycle->prepare($template->id, 'upgrade', ['groupId' => $group->id, 'revision' => 2], 2, $checksum, $this->actor());

        $conflicts = array_column($candidate['conflicts'], null, 'id');
        self::assertFalse($conflicts['content.headline']['localAllowed']);
        self::assertStringNotContainsString('Inherited resource copy', json_encode($candidate, JSON_THROW_ON_ERROR));
        $choices = array_fill_keys(array_keys($conflicts), 'family');
        $lifecycle->apply($template->id, $candidate['id'], $choices, 2, $checksum, $this->actor());
        self::assertSame('Authorized family copy', $api->publish($template->id, 3)->document['content']['headline']);
    }

    public function test_editor_exposes_raw_family_authority_separately_from_its_resolved_document(): void
    {
        [, , $template, , $resource] = $this->resourceBackedVariant(override: false);
        $payload = app(EditorPayload::class)->load($template->id, $this->actor());

        self::assertSame($resource->id, $payload['family']['source']['content']->headline['resourceId']);
        self::assertSame('Inherited resource copy', $payload['family']['document']['content']->headline);
        self::assertSame('Inherited resource copy', $payload['document']['content']->headline);
    }

    public function test_editor_does_not_expose_an_inaccessible_family_snapshot_replaced_by_a_local_value(): void
    {
        [, , $template, , $resource] = $this->resourceBackedVariant();
        Gate::define('templates.read', fn (?Authenticatable $user, $record = null) => ! ($record instanceof TemplateResource && $record->id === $resource->id));

        $payload = app(EditorPayload::class)->load($template->id, $this->actor());

        self::assertSame('Local override', $payload['document']['content']->headline);
        self::assertSame($resource->id, $payload['family']['source']['content']->headline['resourceId']);
        self::assertStringNotContainsString('Inherited resource copy', json_encode($payload, JSON_THROW_ON_ERROR));
    }

    public function test_regroup_resource_conflict_preview_keeps_the_variant_identity(): void
    {
        [$api, , $template, $source] = $this->resourceBackedVariant(override: false);
        $target = $api->createGroup('target', 'Target');
        $api->publishGroup($target->id, Documents::standalone(), 0);
        $lifecycle = app(FamilyLifecycle::class);
        $checksum = CanonicalJson::hash($source);

        $candidate = $lifecycle->prepare($template->id, 'regroup', ['groupId' => $target->id, 'revision' => 1], 1, $checksum, $this->actor());

        self::assertContains('resources', array_column($candidate['conflicts'], 'id'));
        self::assertSame('t_'.str_replace('-', '', $template->id), $candidate['document']['source']['definition']->id);
        self::assertSame('Variant', $candidate['document']['source']['definition']->name);
        $review = $lifecycle->review($template->id, $candidate['id'], ['resources' => 'family'], 1, $checksum, $this->actor());
        self::assertSame($candidate['document']['source']['definition']->id, $review['document']['source']['definition']->id);
    }

    private function blockFamily(): array
    {
        $fixture = json_decode(file_get_contents(__DIR__.'/../Support/Contracts/family-structure.v1.json'), true, 64, JSON_THROW_ON_ERROR)['base'];
        $base = Documents::standalone();
        $base['source']['definition'] = $fixture['source']['definition'];
        $base['variationPoints'] = array_values(array_filter($fixture['variationPoints'], fn (array $point) => in_array($point['id'], ['caption', 'body'], true)));

        return $base;
    }

    private function blockChange(array $base, array $target, array $variations): array
    {
        $api = app(Templates::class);
        $group = $api->createGroup('block-family', 'Block family');
        $api->publishGroup($group->id, $base, 0);
        $template = $api->createTemplate('block-variant', 'Block variant', $group->id);
        $source = Documents::variant($group->id, 1, 'Local');
        $source['source']['overrides']['variations'] = $variations;
        $api->saveDraft($template->id, $source, 0);
        $api->publishGroup($group->id, $target, 1);
        $lifecycle = app(FamilyLifecycle::class);
        $candidate = $lifecycle->prepare($template->id, 'rebase', ['groupId' => $group->id, 'revision' => 2], 1, CanonicalJson::hash($source), $this->actor());

        return [$lifecycle, $template, $source, $candidate];
    }

    public function test_changed_inherited_block_property_default_requires_review_under_a_local_binding(): void
    {
        $base = $this->blockFamily();
        unset($base['source']['definition']['nodes']['card']['props']['caption']);
        $base['source']['definition']['blocks'][0]['propertyMetadata'] = ['caption' => ['label' => 'Caption', 'description' => '', 'defaultValue' => 'Old default']];
        $target = $base;
        $target['source']['definition']['blocks'][0]['propertyMetadata']['caption']['defaultValue'] = 'New default';
        [$lifecycle, $template, $source, $candidate] = $this->blockChange($base, $target, ['caption' => ['kind' => 'block-property', 'value' => ['source' => 'literal', 'value' => 'Local caption']]]);

        $conflicts = array_column($candidate['conflicts'], null, 'id');
        self::assertArrayHasKey('variations.caption', $conflicts);
        self::assertTrue($conflicts['variations.caption']['localAllowed']);
        $local = $lifecycle->review($template->id, $candidate['id'], ['variations.caption' => 'local'], 1, CanonicalJson::hash($source), $this->actor());
        self::assertSame('Local caption', $local['document']['source']['definition']->nodes->card->props->caption->value);
        $inherited = $lifecycle->review($template->id, $candidate['id'], ['variations.caption' => 'family'], 1, CanonicalJson::hash($source), $this->actor());
        self::assertObjectNotHasProperty('caption', $inherited['document']['source']['definition']->nodes->card->props);
        self::assertSame('New default', $inherited['document']['source']['definition']->blocks[0]->propertyMetadata->caption->defaultValue);
    }

    public function test_changed_registered_block_identity_requires_review_under_a_local_property_binding(): void
    {
        $base = $this->blockFamily();
        $target = $base;
        $target['source']['definition']['blocks'][0]['version'] = 2;
        $target['source']['definition']['nodes']['card']['version'] = 2;
        [, , , $candidate] = $this->blockChange($base, $target, ['caption' => ['kind' => 'block-property', 'value' => ['source' => 'literal', 'value' => 'Local caption']]]);

        self::assertContains('variations.caption', array_column($candidate['conflicts'], 'id'));
    }

    public function test_unused_property_default_changes_do_not_conflict_with_an_inherited_literal_binding(): void
    {
        $base = $this->blockFamily();
        $base['source']['definition']['blocks'][0]['propertyMetadata'] = ['caption' => ['label' => 'Caption', 'description' => '', 'defaultValue' => 'Old default']];
        $target = $base;
        $target['source']['definition']['blocks'][0]['propertyMetadata']['caption']['defaultValue'] = 'New default';
        [, , , $candidate] = $this->blockChange($base, $target, ['caption' => ['kind' => 'block-property', 'value' => ['source' => 'literal', 'value' => 'Local caption']]]);

        self::assertSame([], $candidate['conflicts']);
    }

    public function test_changed_inherited_block_slot_fallback_requires_review_under_an_empty_local_assignment(): void
    {
        $base = $this->blockFamily();
        $fallback = $base['source']['definition']['blocks'][0]['nodes']['block-title'];
        $fallback['id'] = 'fallback';
        $fallback['parts'][0]['value'] = ['source' => 'literal', 'value' => 'Old fallback'];
        $base['source']['definition']['blocks'][0]['nodes']['fallback'] = $fallback;
        $base['source']['definition']['blocks'][0]['nodes']['slot']['children'] = ['fallback'];
        $target = $base;
        $target['source']['definition']['blocks'][0]['nodes']['fallback']['parts'][0]['value']['value'] = 'New fallback';
        [$lifecycle, $template, $source, $candidate] = $this->blockChange($base, $target, ['body' => ['kind' => 'children', 'order' => []]]);

        self::assertContains('variations.body', array_column($candidate['conflicts'], 'id'));
        $local = $lifecycle->review($template->id, $candidate['id'], ['variations.body' => 'local'], 1, CanonicalJson::hash($source), $this->actor());
        self::assertSame([], $local['document']['source']['definition']->nodes->card->slots->body);
        $inherited = $lifecycle->review($template->id, $candidate['id'], ['variations.body' => 'family'], 1, CanonicalJson::hash($source), $this->actor());
        self::assertObjectNotHasProperty('body', $inherited['document']['source']['definition']->nodes->card->slots);
    }

    public function test_inherited_slot_omission_and_explicit_empty_assignment_are_distinct_review_bases(): void
    {
        $base = $this->blockFamily();
        $target = $base;
        $target['source']['definition']['nodes']['card']['slots']['body'] = [];
        [, , , $candidate] = $this->blockChange($base, $target, ['body' => ['kind' => 'children', 'order' => []]]);

        self::assertContains('variations.body', array_column($candidate['conflicts'], 'id'));
    }

    public function test_unused_block_slot_fallback_changes_do_not_conflict_with_an_inherited_explicit_assignment(): void
    {
        $base = $this->blockFamily();
        $base['source']['definition']['nodes']['card']['slots']['body'] = [];
        $fallback = $base['source']['definition']['blocks'][0]['nodes']['block-title'];
        $fallback['id'] = 'fallback';
        $fallback['parts'][0]['value'] = ['source' => 'literal', 'value' => 'Old fallback'];
        $base['source']['definition']['blocks'][0]['nodes']['fallback'] = $fallback;
        $base['source']['definition']['blocks'][0]['nodes']['slot']['children'] = ['fallback'];
        $target = $base;
        $target['source']['definition']['blocks'][0]['nodes']['fallback']['parts'][0]['value']['value'] = 'New fallback';
        [, , , $candidate] = $this->blockChange($base, $target, ['body' => ['kind' => 'children', 'order' => []]]);

        self::assertSame([], $candidate['conflicts']);
    }
}
