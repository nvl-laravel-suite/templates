<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Container\Container;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Nvl\Support\OwnerRegistry;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Support\Ownership\Exceptions\OwnershipViolation;
use Nvl\Templates\Contracts\TemplateOwnerResolver;
use Nvl\Templates\Ownership\TemplatesOwnership;

/**
 * Allowlist for assignment owner aliases exposed to routes and imports.
 */
final class TemplateOwnerRegistry
{
    /** @var array<string, class-string<TemplateOwnerResolver>> */
    private array $resolvers = [];

    /** @var array<string, class-string<Model>> */
    private array $ownerModels = [];

    /** Create the package resolver registry with its identity and tenancy boundaries. */
    public function __construct(
        private readonly Container $container,
        private readonly OwnershipBoundary $boundary,
        private readonly OwnerRegistry $identities,
    ) {}

    /** Register one allowlisted resolver with an optional shared owner reference. */
    public function register(string $alias, string $resolver, ?string $owner = null): void
    {
        if (preg_match('/^[a-z][a-z0-9_.-]*$/', $alias) !== 1) {
            throw new InvalidArgumentException("Template owner alias [{$alias}] is invalid.");
        }

        if (isset($this->resolvers[$alias])) {
            throw new InvalidArgumentException("Template owner [{$alias}] is already registered.");
        }

        if (! is_a($resolver, TemplateOwnerResolver::class, true)) {
            throw new InvalidArgumentException(
                "Template owner resolver [{$resolver}] must implement TemplateOwnerResolver.",
            );
        }

        if ($owner !== null) {
            $this->ownerModels[$alias] = $this->identities->reference($owner, "nvl-templates.owners.{$alias}");
        }

        $this->resolvers[$alias] = $resolver;
        ksort($this->resolvers);
    }

    /** Resolve one package-visible identity through its declared resolver. */
    public function resolve(string $alias, string $identifier): Model
    {
        $class = $this->resolvers[$alias]
            ?? throw new InvalidArgumentException("Template owner [{$alias}] is not registered.");
        $resolver = $this->container->make($class);

        if (! $resolver instanceof TemplateOwnerResolver || $resolver->alias() !== $alias) {
            throw new InvalidArgumentException("Template owner resolver [{$class}] is invalid.");
        }

        $owner = $resolver->resolve($identifier)
            ?? throw new InvalidArgumentException(
                "Template owner [{$alias}:{$identifier}] does not exist.",
            );

        $expectedModel = $this->ownerModels[$alias] ?? null;

        if ($expectedModel !== null && $owner::class !== $expectedModel) {
            throw new InvalidArgumentException("Templates resolver [{$alias}] returned a different shared owner model.");
        }

        if (TemplatesOwnership::active()) {
            $this->boundary->assertRecord(
                $owner,
                TemplatesOwnership::resource($owner),
            );
        }

        if (TemplatesOwnership::declared()) {
            if (config('nvl-templates.ownership.owner_resources.'.$alias) !== TemplatesOwnership::resource($owner)) {
                throw new OwnershipViolation('Template assignment host has no canonical resource declaration.');
            }
            $key = $owner->getKey();
            if ((! is_string($key) && ! is_int($key)) || (string) $key !== $identifier) {
                throw new OwnershipViolation('Assignment hosts require exact canonical identifiers.');
            }
            $fresh = $owner->newQuery()->whereKey($key)->firstOrFail();
            $this->boundary->assertRecord($fresh, TemplatesOwnership::resource($fresh));

            return $fresh;
        }

        return $owner;
    }

    /** Determine whether a capability alias is registered. */
    public function has(string $alias): bool
    {
        return isset($this->resolvers[$alias]);
    }

    /**
     * Return registered aliases without exposing consumer model classes.
     *
     * @return list<string>
     */
    public function aliases(): array
    {
        return array_keys($this->resolvers);
    }
}
