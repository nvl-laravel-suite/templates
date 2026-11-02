<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\ContextProvider;
use Nvl\Templates\Models\TemplateRevision;

/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * @internal
 */
final class EmptyContextProvider implements ContextProvider
{
    /** @param array<array-key,mixed> $owner
     * @return array{facts?: array<array-key,mixed>, context?: array<array-key,mixed>}
     */
    public function resolve(TemplateRevision $release, array $owner, Authenticatable|SystemActor $actor): array
    {
        return ['facts' => [], 'context' => []];
    }
}
