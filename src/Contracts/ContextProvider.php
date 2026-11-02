<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Models\TemplateRevision;

/**
 * Host-owned business context resolver; never supplies ownership authority.
 *
 * @api
 */
interface ContextProvider
{
    /** Authorize the owner reference and return trusted facts/context. Use the explicit freshly admitted requester, never ambient Auth. Never echo request facts.
     * @param  array<array-key,mixed>  $owner
     * @return array{facts?: array<array-key,mixed>, context?: array<array-key,mixed>}
     */
    public function resolve(TemplateRevision $release, array $owner, Authenticatable|SystemActor $actor): array;
}
