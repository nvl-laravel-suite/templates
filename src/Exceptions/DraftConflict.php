<?php

declare(strict_types=1);

namespace Nvl\Templates\Exceptions;

use RuntimeException;

/**
 * The submitted optimistic draft version is stale.
 *
 * @api
 */
final class DraftConflict extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('The draft changed. Reload its current version before saving.');
    }
}
