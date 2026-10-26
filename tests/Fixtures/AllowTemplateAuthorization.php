<?php

namespace Nvl\Templates\Tests\Fixtures;

use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;

final class AllowTemplateAuthorization implements TemplateAuthorization
{
    public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void {}
}
