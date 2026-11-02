<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Ownership;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Ownership\Contracts\OwnershipContext;

final class HostPolicy
{
    public static function assertActor(Authenticatable|SystemActor $actor): void
    {
        $owner = app(OwnershipContext::class)->requireOwner();
        if (! $actor instanceof TestActor || (string) $actor->company_id !== $owner->key) {
            throw new AuthorizationException('Explicit actor is not admitted to this company.');
        }
    }
}
