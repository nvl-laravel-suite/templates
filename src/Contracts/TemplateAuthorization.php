<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Enums\TemplateAbility;

/**
 * Authorizes every template operation independently of an application's user model.
 *
 * @api
 */
interface TemplateAuthorization
{
    /**
     * Throw an authorization exception when the operation is forbidden.
     *
     * @param  array<string, mixed>  $context
     */
    public function authorize(
        TemplateAbility $ability,
        Authenticatable|SystemActor $actor,
        array $context = [],
    ): void;
}
