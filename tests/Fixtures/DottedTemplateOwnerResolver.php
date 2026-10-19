<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Illuminate\Database\Eloquent\Model;
use Nvl\Templates\Contracts\TemplateOwnerResolver;

/** Resolves a native host under a valid literal dotted capability alias. */
final class DottedTemplateOwnerResolver implements TemplateOwnerResolver
{
    public function alias(): string
    {
        return 'sales.order';
    }

    public function resolve(string $identifier): ?Model
    {
        return OwnershipTemplateHost::query()->find($identifier);
    }
}
