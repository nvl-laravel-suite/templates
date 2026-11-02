<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Nvl\Templates\Exceptions\DraftConflict;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;

final class CatalogTest extends TestCase
{
    use RefreshDatabase;

    private function templates(): Templates
    {
        self::assertTrue(class_exists(Templates::class), 'The module application service must exist.');

        return app(Templates::class);
    }

    public function test_standalone_drafts_publish_as_immutable_snapshots(): void
    {
        $api = $this->templates();
        $template = $api->createTemplate('booking', 'Booking');
        self::assertNull($template->group_id);
        $draft = $api->saveDraft($template->id, Documents::standalone(), 0);
        self::assertSame(1, $draft->version);
        $release = $api->publish($template->id, $draft->version);
        self::assertSame(1, $release->revision);
        self::assertSame('An experience for you', $release->document['content']['headline']);
        $api->saveDraft($template->id, Documents::standalone('New title'), 1);
        self::assertSame('An experience for you', $release->fresh()->document['content']['headline']);
    }

    public function test_stale_save_cannot_overwrite_a_draft(): void
    {
        $api = $this->templates();
        $template = $api->createTemplate('booking', 'Booking');
        $api->saveDraft($template->id, Documents::standalone('First'), 0);
        $this->expectException(DraftConflict::class);
        $api->saveDraft($template->id, Documents::standalone('Stale'), 0);
    }

    public function test_variants_pin_family_revisions_and_keep_their_own_differences(): void
    {
        $api = $this->templates();
        $family = $api->createGroup('experiences', 'Experience vouchers');
        $base = $api->publishGroup($family->id, Documents::standalone('Shared'), 0);
        $classic = $api->createTemplate('classic', 'Classic', $family->id);
        $celebration = $api->createTemplate('celebration', 'Celebration', $family->id);
        $a = $api->saveDraft($classic->id, Documents::variant($family->id, 1, 'Classic'), 0);
        $b = $api->saveDraft($celebration->id, Documents::variant($family->id, 1, 'Celebrate'), 0);
        $releaseA = $api->publish($classic->id, $a->version);
        $releaseB = $api->publish($celebration->id, $b->version);
        $api->publishGroup($family->id, Documents::standalone('Updated base'), 1);
        self::assertSame($base->id, $releaseA->group_revision_id);
        self::assertSame('Classic', $releaseA->fresh()->document['content']['headline']);
        self::assertSame('Celebrate', $releaseB->document['content']['headline']);
        self::assertSame(16, $releaseB->document['settingsDefaults']['fontSize']);
    }

    public function test_other_application_scopes_cannot_read_a_template(): void
    {
        $api = $this->templates();
        $template = $api->createTemplate('private', 'Private');
        config()->set('nvl-templates.scope', 'another-app');
        $this->expectException(ModelNotFoundException::class);
        $api->getTemplate($template->id);
    }

    public function test_published_revisions_reject_model_mutations(): void
    {
        $api = $this->templates();
        $t = $api->createTemplate('booking', 'Booking');
        $draft = $api->saveDraft($t->id, Documents::standalone(), 0);
        $release = $api->publish($t->id, $draft->version);
        $this->expectException(\LogicException::class);
        $release->update(['document' => Documents::standalone('Tampered')]);
    }
}
