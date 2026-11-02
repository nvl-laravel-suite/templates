<?php

declare(strict_types=1);

namespace Nvl\Templates\Exceptions;

/**
 * A bounded retryable worker failure code for host adapters.
 *
 * @api
 */
final class RetryableRenderException extends \RuntimeException
{
    public function __construct(public readonly string $reason)
    {
        if (! preg_match('/^[a-z][a-z_]{0,63}$/D', $reason)) {
            throw new \InvalidArgumentException('Render failure reasons must be safe bounded codes.');
        }
        parent::__construct($reason);
    }
}
