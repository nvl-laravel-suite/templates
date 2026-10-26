<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;

/**
 * Resolves stable Media/application asset aliases for class-based templates.
 *
 * @api
 */
interface TemplateAssetResolver
{
    public function resolve(string $key, Authenticatable|SystemActor $actor): ?string;

    /**
     * @return array<string, string>
     */
    public function scope(string $scope, Authenticatable|SystemActor $actor, ?string $type = null): array;
}
