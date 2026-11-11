<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Auth\CanonicalActorResolver;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Ownership\Contracts\OwnershipContext;

/**
 * Operation-local actor admission; restores nested and reused-worker state.
 *
 * @internal
 */
final class TemplateOperation
{
    private Authenticatable|SystemActor|null $current = null;

    public function __construct(private readonly CanonicalActorResolver $actors, private readonly OwnershipContext $ownership) {}

    /** @template T
     * @param  Closure(): T  $operation
     * @return T
     */
    public function run(Authenticatable|SystemActor $actor, Closure $operation): mixed
    {
        $canonical = $this->admitActor($actor);
        $previous = $this->current;
        $this->current = $canonical;
        try {
            return $operation();
        } finally {
            $this->current = $previous;
        }
    }

    /** Require the actor admitted for this operation. */
    public function actor(): Authenticatable|SystemActor
    {
        $actor = $this->current ?? throw new AuthorizationException('An explicit template operation actor is required.');

        return $this->admitActor($actor);
    }

    /** Keep canonical identity aligned with the currently admitted native context. */
    private function admitActor(Authenticatable|SystemActor $actor): Authenticatable|SystemActor
    {
        $canonical = $actor instanceof SystemActor ? $actor : $this->actors->resolve($actor);
        $identifier = $canonical instanceof SystemActor ? null : $canonical->getAuthIdentifier();
        if (! $canonical instanceof SystemActor && ! is_string($identifier) && ! is_int($identifier)) {
            throw new AuthorizationException('The template actor identity must be a scalar key.');
        }
        $principal = $this->ownership->snapshot()->principal;
        if ($principal !== null) {
            $matches = $canonical instanceof SystemActor
                ? ($principal['kind'] === 'system')
                : ($principal['kind'] === 'actor' && $principal['type'] === $canonical::class && $principal['id'] === (string) $identifier);
            if (! $matches) {
                throw new AuthorizationException('The explicit template actor does not match the admitted ownership principal.');
            }
        }

        return $canonical;
    }
}
