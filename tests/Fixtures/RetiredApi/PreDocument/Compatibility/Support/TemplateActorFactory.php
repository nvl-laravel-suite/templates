<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Compatibility\Support;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Request;

/**
 * Maps Laravel authentication to the package's transport-neutral actor DTO.
 */
final class TemplateActorFactory
{
    /**
     * Build a stable actor identity from the authenticated request user.
     */
    public function fromRequest(Request $request): Authenticatable
    {
        $user = $request->user();
        if (! $user instanceof Authenticatable) {
            throw new AuthenticationException;
        }

        return $user;
    }
}
