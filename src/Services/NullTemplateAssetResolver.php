<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAssetResolver;

/**
 * Safe default that requires applications to opt into alias-based asset resolution.
 *
 * @internal
 */
final class NullTemplateAssetResolver implements TemplateAssetResolver
{
    public function resolve(string $key, Authenticatable|SystemActor $actor): ?string
    {
        return null;
    }

    /**
     * @return array<string, string>
     */
    public function scope(string $scope, Authenticatable|SystemActor $actor, ?string $type = null): array
    {
        return [];
    }
}
