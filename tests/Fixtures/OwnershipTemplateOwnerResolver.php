<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Illuminate\Database\Eloquent\Model;
use Nvl\Templates\Contracts\TemplateOwnerResolver;

/** Resolves an actual native assignment host, retaining its ownership scope. */
final class OwnershipTemplateOwnerResolver implements TemplateOwnerResolver
{
    public function alias(): string
    {
        return 'member';
    }

    public function resolve(string $identifier): ?Model
    {
        return OwnershipTemplateHost::query()->find($identifier);
    }
}
