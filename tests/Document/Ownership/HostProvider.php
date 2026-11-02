<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Ownership;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Foundation\MaintenanceMode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\ServiceProvider;
use Nvl\Media\Contracts\MediaAuthorization;
use Nvl\Media\Enums\MediaAbility;
use Nvl\Media\Models\Media;
use Nvl\Ownership\Contracts\OwnerAccess;
use Nvl\Ownership\Contracts\OwnershipAdoptionAccess;
use Nvl\Ownership\ValueObjects\OwnershipOperation;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;

/** Bind actual host policy contracts before native Media services are constructed. */
final class HostProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(MediaAuthorization::class, fn () => new class implements MediaAuthorization
        {
            public function allows(Authenticatable|SystemActor $actor, MediaAbility $ability, ?Media $media = null, ?Model $owner = null): bool
            {
                HostPolicy::assertActor($actor);

                return true;
            }
        });
        $this->app->bind(TemplateAuthorization::class, fn () => new class implements TemplateAuthorization
        {
            public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void
            {
                HostPolicy::assertActor($actor);
            }
        });
        $this->app->bind(OwnerAccess::class, fn () => new class implements OwnerAccess
        {
            public function assertCanEnter(Authenticatable $actor, Model $owner): void
            {
                if (! $actor instanceof TestActor || ! $owner instanceof TestCompany || $actor->company_id !== $owner->getKey()) {
                    throw new AuthorizationException('Company membership is required.');
                }
            }
        });
        $this->app->bind(OwnershipAdoptionAccess::class, fn () => new class implements OwnershipAdoptionAccess
        {
            public function authorize(OwnershipOperation $operation): void
            {
                if ($operation->actorId !== '1') {
                    throw new AuthorizationException('Only the reviewed installer can adopt.');
                }
            }
        });
        $this->app->singleton(MaintenanceMode::class, fn () => new class implements MaintenanceMode
        {
            public function activate(array $payload): void {}

            public function deactivate(): void {}

            public function active(): bool
            {
                return true;
            }

            public function data(): array
            {
                return [];
            }
        });
    }
}
