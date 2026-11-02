<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

use Illuminate\Auth\Access\AuthorizationException;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Services\TemplateOperation;

/**
 * Internal policy seam; never consults an ambient authentication guard.
 *
 * @internal
 */
final class Access
{
    public static function allows(string $ability, mixed $resource = null): bool
    {
        try {
            self::authorize($ability, $resource);

            return true;
        } catch (AuthorizationException) {
            return false;
        }
    }

    public static function authorize(string $ability, mixed $resource = null): void
    {
        app(TemplateAuthorization::class)->authorize(TemplateAbility::from($ability), app(TemplateOperation::class)->actor(), $resource === null ? [] : ['resource' => $resource]);
    }
}
