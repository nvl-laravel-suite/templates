<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Support;

use Illuminate\Auth\GenericUser;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Facades\Gate;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;

/** Test-only bridge preserving the original tests' Gate policy decisions.
 * Every service receives an explicit actor; Gate never resolves an ambient Auth guard.
 * A fixed external identity represents the admitted system actor only for these callbacks.
 */
final class GateTemplateAuthorization implements TemplateAuthorization
{
    public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void
    {
        $identity = $actor instanceof SystemActor ? new GenericUser(['id' => 'canonical-system-'.$actor->name]) : $actor;
        Gate::forUser($identity)->authorize('templates.'.$ability->value, [$context['resource'] ?? null]);
    }
}
