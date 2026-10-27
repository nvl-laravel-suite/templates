<?php

declare(strict_types=1);

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\GenericUser;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
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
