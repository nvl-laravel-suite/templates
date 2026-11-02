<?php

declare(strict_types=1);

namespace Nvl\Templates\Exceptions;

use RuntimeException;

/**
 * The accepted render idempotency identity conflicts.
 *
 * @api
 */
final class RenderConflict extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('This render idempotency key belongs to a different accepted request.');
    }
}
