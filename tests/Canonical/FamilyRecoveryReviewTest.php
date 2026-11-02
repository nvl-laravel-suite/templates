<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Nvl\Templates\Models\FamilyChange;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Services\FamilyLifecycle;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;

final class FamilyRecoveryReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_replacement_family_can_recover_a_variant_whose_old_resource_was_revoked(): void
    {
        $api = app(Templates::class);
        $life = app(FamilyLifecycle::class);
        $g = $api->createGroup('family', 'Family');
        $resource = $api->createResource('copy', 'Copy', 'content', 'group', $g->id);
        $api->publishResource($resource->id, ['value' => 'Original'], 0);
        $doc = Documents::standalone();
        $doc['content']['headline'] = ['kind' => 'content', 'id' => $resource->id, 'revision' => 1, 'path' => 'value'];
        $api->publishGroup($g->id, $doc, 0);
        $t = $api->createTemplate('variant', 'Variant', $g->id);
        $source = Documents::variant($g->id, 1, 'Local');
        unset($source['source']['overrides']['content']);
        $api->saveDraft($t->id, $source, 0);
        $api->publish($t->id, 1);
        $resource->update(['status' => 'revoked']);
        $api->publishGroup($g->id, Documents::standalone('Replacement'), 1);
        $candidates = $life->listing($t->id, $this->actor());
        self::assertCount(1, $candidates);
        $candidate = $life->prepare($t->id, 'rebase', ['groupId' => $g->id, 'revision' => 2], 1, CanonicalJson::hash($source), $this->actor());
        $life->apply($t->id, $candidate['id'], array_fill_keys(array_column($candidate['conflicts'], 'id'), 'family'), 1, CanonicalJson::hash($source), $this->actor());
        self::assertSame(2, $api->getTemplate($t->id)->current_revision_id ? TemplateDraft::query()->where('template_id', $t->id)->firstOrFail()->document['source']['group']['revision'] : null);
    }

    public function test_review_projects_the_selected_resolution_without_writing_the_draft(): void
    {
        $api = app(Templates::class);
        $life = app(FamilyLifecycle::class);
        $g = $api->createGroup('family', 'Family');
        $api->publishGroup($g->id, Documents::standalone('Original'), 0);
        $t = $api->createTemplate('variant', 'Variant', $g->id);
        $source = Documents::variant($g->id, 1, 'Local');
        $api->saveDraft($t->id, $source, 0);
        $api->publishGroup($g->id, Documents::standalone('Replacement'), 1);
        $candidate = $life->prepare($t->id, 'rebase', ['groupId' => $g->id, 'revision' => 2], 1, CanonicalJson::hash($source), $this->actor());
        $review = $life->review($t->id, $candidate['id'], ['content.headline' => 'family'], 1, CanonicalJson::hash($source), $this->actor());
        self::assertSame('Replacement', $review['document']['content']->headline);
        self::assertSame('Local', TemplateDraft::query()->where('template_id', $t->id)->firstOrFail()->document['source']['overrides']['content']['headline']);
        self::assertSame('pending', FamilyChange::query()->findOrFail($candidate['id'])->status);
    }
}
