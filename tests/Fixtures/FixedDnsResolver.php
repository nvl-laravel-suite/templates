<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Templates\Contracts\DnsResolver;

final readonly class FixedDnsResolver implements DnsResolver
{
    /** @param list<string> $addresses */
    public function __construct(private array $addresses) {}

    public function addresses(string $host): array
    {
        return $this->addresses;
    }
}
