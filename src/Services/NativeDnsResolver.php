<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Nvl\Templates\Contracts\DnsResolver;

/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * @internal
 */
final class NativeDnsResolver implements DnsResolver
{
    /** @return list<string> */
    public function addresses(string $host): array
    {
        return gethostbynamel($host) ?: [];
    }
}
