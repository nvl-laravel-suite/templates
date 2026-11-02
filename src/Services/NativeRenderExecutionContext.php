<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Ownership\Contracts\OwnershipContext;
use Nvl\Support\Ownership\Contracts\OwnershipQueueContext;
use Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope;
use Nvl\Templates\Contracts\RenderExecutionContext;
use Nvl\Templates\Support\Scope;

/**
 * Captures native scalar authority and re-admits it without touching Auth guards.
 *
 * @internal
 */
final class NativeRenderExecutionContext implements RenderExecutionContext
{
    public function __construct(
        private readonly TemplateOperation $operation,
        private readonly OwnershipContext $ownership,
        private readonly OwnershipQueueContext $queueContext,
    ) {}

    /** @return array{scope: string, actor: array{kind: string, type: string, id: string}, ownership: array<array-key,mixed>} */
    public function capture(): array
    {
        $actor = $this->operation->actor();
        if ($actor instanceof SystemActor) {
            $identity = ['kind' => 'system', 'type' => SystemActor::class, 'id' => $actor->name];
        } elseif ($actor instanceof Model) {
            $id = $actor->getKey();
            if (! is_string($id) && ! is_int($id)) {
                throw new AuthorizationException('Queued rendering requires a scalar persisted actor key.');
            }
            $identity = ['kind' => 'actor', 'type' => $actor::class, 'id' => (string) $id];
        } else {
            throw new AuthorizationException('Queued rendering requires a persisted native actor or a host RenderExecutionContext adapter.');
        }

        return ['scope' => Scope::current(), 'actor' => $identity, 'ownership' => OwnershipJobEnvelope::capture($this->ownership)->toArray()];
    }

    /** @template T
     * @param  array<array-key,mixed>  $context
     * @param  Closure(): T  $operation
     * @return T
     */
    public function run(array $context, Closure $operation): mixed
    {
        if (array_diff(array_keys($context), ['scope', 'actor', 'ownership']) || ! is_array($context['ownership'] ?? null) || ! is_array($context['actor'] ?? null)) {
            throw new AuthorizationException('Invalid accepted render execution context.');
        }

        return $this->queueContext->run(OwnershipJobEnvelope::fromArray($context['ownership']), function () use ($context, $operation) {
            if (($context['scope'] ?? null) !== Scope::current()) {
                throw new AuthorizationException('The accepted template scope was not restored.');
            }
            $identity = $context['actor'];
            $actor = null;
            if (($identity['kind'] ?? null) === 'system' && ($identity['type'] ?? null) === SystemActor::class && ($identity['id'] ?? null) === SystemActor::Background->name) {
                $actor = SystemActor::Background;
            } elseif (($identity['kind'] ?? null) === 'actor' && is_string($identity['type'] ?? null) && is_string($identity['id'] ?? null)) {
                $class = $identity['type'];
                if (is_subclass_of($class, Model::class) && is_subclass_of($class, Authenticatable::class)) {
                    $actor = (new $class)->newQuery()->useWritePdo()->whereKey($identity['id'])->first();
                }
            }
            if (! $actor instanceof Authenticatable && ! $actor instanceof SystemActor) {
                throw new AuthorizationException('The accepted render actor is unavailable.');
            }

            return $this->operation->run($actor, $operation);
        });
    }
}
