<?php

declare(strict_types=1);

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\GenericUser;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Services\TemplateContentGuard;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Tests\Fixtures\AllowTemplateAuthorization;

it('passes fresh persisted actor attributes to native template policies and preserves live grants', function (): void {
    Schema::table('template_test_owners', static fn (Blueprint $table) => $table->boolean('can_manage')->default(false));
    $actor = templateTestActor();
    $actor->forceFill(['can_manage' => true]);
    $policy = new class implements TemplateAuthorization
    {
        public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void
        {
            if (! $actor instanceof Model || ! $actor->getAttribute('can_manage')) {
                throw new AuthorizationException;
            }
        }
    };
    app()->instance(TemplateAuthorization::class, $policy);
    expect(fn () => app(TemplateReader::class)->paginate([], $actor))->toThrow(AuthorizationException::class);
    $actor->newQuery()->whereKey($actor->getKey())->update(['can_manage' => true]);
    expect(app(TemplateReader::class)->paginate([], $actor)->total())->toBe(0);
    $actor->newQuery()->whereKey($actor->getKey())->update(['can_manage' => false]);
    expect(fn () => app(TemplateReader::class)->paginate([], $actor))->toThrow(AuthorizationException::class);
});

it('retains the persisted Eloquent actor requirement before template policies', function (): void {
    app()->instance(TemplateAuthorization::class, new AllowTemplateAuthorization);
    expect(fn () => app(TemplateReader::class)->paginate([], new GenericUser(['id' => 'directory-user'])))->toThrow(AuthorizationException::class);
});

it('rejects protected template attributes before creating a native record', function (): void {
    expect(fn () => app(TemplateLifecycle::class)->create([
        'key' => 'welcome',
        'owner_scope_key' => 'central',
    ], templateTestActor()))->toThrow(ValidationException::class)
        ->and(TemplateModelRegistry::query()->count())->toBe(0);
});

it('rejects unknown keys across native template input shapes', function (string $operation, array $data): void {
    expect(fn () => app(TemplateContentGuard::class)->{$operation}([
        ...$data,
        'unexpected' => 'must reject',
    ]))->toThrow(ValidationException::class);
})->with([
    'create template' => ['createTemplate', ['key' => 'welcome']],
    'update template' => ['updateTemplate', ['status' => 'active', 'expected_revision' => 1]],
    'create version' => ['createVersion', []],
    'update version' => ['updateVersion', ['expected_revision' => 1]],
    'assign' => ['assign', ['ownerType' => 'member', 'ownerId' => 'one']],
    'render' => ['render', ['locale' => 'en', 'payload' => []]],
]);

it('rejects unknown localized template fields before translation persistence', function (): void {
    expect(fn () => app(TemplateContentGuard::class)->createTemplate([
        'key' => 'welcome',
        'translations' => ['en' => ['title' => 'Welcome', 'owner_scope_key' => 'central']],
    ]))->toThrow(ValidationException::class);
});

it('preserves omitted template and draft metadata while allowing explicit empty replacements', function (): void {
    $actor = templateTestActor();
    $lifecycle = app(TemplateLifecycle::class);
    $template = $lifecycle->create([
        'key' => 'welcome',
        'metadata' => ['campaign' => 'welcome'],
        'translations' => ['en' => ['title' => 'Welcome', 'description' => 'Existing copy']],
    ], $actor);
    $version = $lifecycle->createVersion($template, ['metadata' => ['draft' => 'retained']], $actor);

    $template = $lifecycle->update($template, ['status' => TemplateStatus::Inactive, 'expected_revision' => $template->revision], $actor);
    $version = $lifecycle->updateVersion($version, ['expected_revision' => $version->revision], $actor);

    expect($template->metadata)->toBe(['campaign' => 'welcome'])
        ->and($template->translations->pluck('title', 'locale')->all())->toBe(['en' => 'Welcome'])
        ->and($template->translations->first()->description)->toBe('Existing copy')
        ->and($version->metadata)->toBe(['draft' => 'retained']);

    $template = $lifecycle->update($template, [
        'status' => TemplateStatus::Active,
        'expected_revision' => $template->revision,
        'metadata' => [],
        'translations' => [],
    ], $actor);
    $version = $lifecycle->updateVersion($version, ['expected_revision' => $version->revision, 'metadata' => []], $actor);

    expect($template->metadata)->toBe([])
        ->and($template->translations)->toBeEmpty()
        ->and($version->metadata)->toBe([]);
});
