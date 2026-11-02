<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

/**
 * Network address lookup seam for constrained remote asset imports.
 *
 * @api
 */
interface DnsResolver
{
    /** @return list<string> */
    public function addresses(string $host): array;
}
