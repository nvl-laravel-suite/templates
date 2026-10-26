<?php

namespace Nvl\Templates\Tests\Fixtures;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Nvl\Media\Contracts\MediaAuthorization;
use Nvl\Media\Enums\MediaAbility;
use Nvl\Media\Models\Media;
use Nvl\Support\Enums\SystemActor;

final class AllowMediaAuthorization implements MediaAuthorization
{
    public function allows(Authenticatable|SystemActor $actor, MediaAbility $ability, ?Media $media = null, ?Model $owner = null): bool
    {
        return true;
    }
}
