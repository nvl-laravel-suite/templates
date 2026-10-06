<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Nvl\Content\Data\ContentCompositionSnapshotBlockData;
use Nvl\Content\Data\ContentCompositionSnapshotData;
use Nvl\Content\Data\ContentSchemaData;
use Nvl\Content\Enums\ContentVisibility;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateTranslation;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Tests\Fixtures\TestTemplateOwner;

function consumerTemplateSnapshot(): ContentCompositionSnapshotData
{
    return new ContentCompositionSnapshotData(TemplateVersion::CONTENT_OWNER_TYPE, (string) Str::uuid(), TemplateVersion::CONTENT_GROUP, [
        new ContentCompositionSnapshotBlockData((string) Str::uuid(), null, 'main', 'main', 0, (string) Str::uuid(), 'template-copy', new ContentSchemaData([]), null, ContentVisibility::Private, [], [], [], 1, 1),
    ], hash('sha256', 'explicit immutable fixture'));
}

it('persists declared parents on ordinary make while leaving the requested child unsaved', function (): void {
    $translation = TemplateTranslation::factory()->make();
    expect($translation->exists)->toBeFalse()->and(TemplateTranslation::query()->count())->toBe(0)
        ->and(Template::query()->count())->toBe(1)->and($translation->template->exists)->toBeTrue();
});

it('rejects unsaved dirty-key and wrong-connection parents before child persistence', function (): void {
    expect(fn () => TemplateVersion::factory()->forTemplate(new Template))->toThrow(InvalidArgumentException::class, 'persisted');
    $template = Template::factory()->create();
    $dirty = clone $template;
    $dirty->id = (string) Str::uuid();
    expect(fn () => TemplateVersion::factory()->forTemplate($dirty))->toThrow(InvalidArgumentException::class, 'unchanged');
    config()->set('database.connections.factory_other', ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]);
    $wrong = clone $template;
    $wrong->setConnection('factory_other');
    expect(fn () => TemplateVersion::factory()->forTemplate($wrong))->toThrow(InvalidArgumentException::class, 'same effective connection');
    expect(TemplateVersion::query()->count())->toBe(0);
});

it('requires a persisted owner and retains its native morph identity', function (): void {
    $owner = TestTemplateOwner::query()->create(['name' => 'Host']);
    $template = Template::factory()->create();
    expect(fn () => TemplateAssignment::factory()->forTemplate($template)->make())->toThrow(InvalidArgumentException::class, 'forOwner');
    expect(fn () => TemplateAssignment::factory()->forOwner(new TestTemplateOwner))->toThrow(InvalidArgumentException::class, 'persisted');
    $assignment = TemplateAssignment::factory()->forTemplate($template)->forOwner($owner)->create();
    expect($assignment->owner_type)->toBe($owner->getMorphClass())->and($assignment->owner_id)->toBe($owner->getKey());
});

it('persists a supplied published snapshot and an exact assignment render graph without rendering or dispatch', function (): void {
    Http::preventStrayRequests();
    Http::fake();
    Mail::fake();
    Bus::fake();
    Queue::fake();
    $snapshot = consumerTemplateSnapshot();
    $template = Template::factory()->create();
    $version = TemplateVersion::factory()->forTemplate($template)->published($snapshot)->create();
    $owner = TestTemplateOwner::query()->create(['name' => 'Host']);
    $assignment = TemplateAssignment::factory()->forVersion($version)->forOwner($owner)->create(['profile' => 'letter', 'settings' => ['tone' => 'formal']]);
    $render = TemplateRender::factory()->forAssignment($assignment)->create();
    $reloaded = $version->fresh();
    expect($reloaded->id)->toBe($snapshot->ownerId)->and($reloaded->content_hash)->toBe($snapshot->version)
        ->and($reloaded->content_snapshot->toArray())->toBe($snapshot->toArray())
        ->and($reloaded->published_at)->not->toBeNull()
        ->and($render->template_id)->toBe($template->id)->and($render->template_version_id)->toBe($version->id)
        ->and($render->template_assignment_id)->toBe($assignment->id)->and($render->profile)->toBe('letter')
        ->and($render->settings)->toBe(['tone' => 'formal'])->and($render->status->value)->toBe('pending');
    Http::assertNothingSent();
    Mail::assertNothingSent();
    Bus::assertNothingDispatched();
    Queue::assertNothingPushed();
});

it('rejects empty or foreign publication snapshots and overridden version identity or hash', function (): void {
    $snapshot = consumerTemplateSnapshot();
    $empty = new ContentCompositionSnapshotData($snapshot->ownerType, $snapshot->ownerId, $snapshot->group, [], $snapshot->version);
    $foreign = new ContentCompositionSnapshotData('foreign-owner', $snapshot->ownerId, $snapshot->group, $snapshot->blocks, $snapshot->version);
    expect(fn () => TemplateVersion::factory()->published($empty))->toThrow(InvalidArgumentException::class);
    expect(fn () => TemplateVersion::factory()->published($foreign))->toThrow(InvalidArgumentException::class);
    $template = Template::factory()->create();
    expect(fn () => TemplateVersion::factory()->forTemplate($template)->published($snapshot)->make(['id' => (string) Str::uuid()]))->toThrow(InvalidArgumentException::class);
    expect(fn () => TemplateVersion::factory()->forTemplate($template)->published($snapshot)->make(['content_hash' => 'wrong']))->toThrow(InvalidArgumentException::class);
    expect(TemplateVersion::query()->count())->toBe(0);
});

it('uses configured package tables and connection for real parent expansion', function (): void {
    $default = (new Template)->getConnection();
    $defaultTable = (new Template)->getTable();
    config()->set('database.connections.factory_custom', ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]);
    config()->set('nvl-templates.connection', 'factory_custom');
    config()->set('nvl-templates.tables.templates', 'host_templates');
    config()->set('nvl-templates.tables.templates_i18n', 'host_template_translations');
    foreach (['2026_07_27_100001_nvl_templates_create_templates_table.php', '2026_07_27_100002_nvl_templates_create_templates_i18n_table.php'] as $migration) {
        (require dirname(__DIR__, 2).'/database/migrations/'.$migration)->up();
    }
    $translation = TemplateTranslation::factory()->create();
    expect($translation->getConnection())->toBe(DB::connection('factory_custom'))
        ->and($translation->getTable())->toBe('host_template_translations')
        ->and($translation->template->getTable())->toBe('host_templates')
        ->and(DB::connection('factory_custom')->table('host_templates')->count())->toBe(1)
        ->and($default->table($defaultTable)->count())->toBe(0);
});
