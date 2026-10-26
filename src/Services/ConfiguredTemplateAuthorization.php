<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;

/**
 * Safe default authorization boundary: default deny.
 *
 * Consumer applications should bind TemplateAuthorization to their policy adapter.
 */
final class ConfiguredTemplateAuthorization implements TemplateAuthorization
{
    /**
     * Require an explicit consumer policy binding for every actor.
     *
     * @param  array<string, mixed>  $context
     */
    public function authorize(
        TemplateAbility $ability,
        Authenticatable|SystemActor $actor,
        array $context = [],
    ): void {

        throw new AuthorizationException(
            "Template ability [{$ability->value}] requires a consumer authorization binding.",
        );
    }
}
