<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

use Illuminate\Contracts\Cache\LockProvider;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Cache;
use InvalidArgumentException;
use Nvl\Support\Config\PackageOptions;
use Nvl\Templates\Jobs\RenderTemplateJob;

/**
 * Applies Laravel's render overlap semantics on the package's inherited lock store.
 */
final class TemplateRenderOverlapLock extends WithoutOverlapping
{
    /** Process a render job under the selected store while retaining Laravel's key and release policy. */
    public function handle(mixed $job, mixed $next): void
    {
        if (! $job instanceof RenderTemplateJob) {
            throw new InvalidArgumentException('Template render locking requires a render job.');
        }

        $provider = Cache::store(PackageOptions::lockStore('templates'))->getStore();
        if (! $provider instanceof LockProvider) {
            throw new InvalidArgumentException('The selected template lock store must support atomic locks.');
        }
        $lock = $provider->lock($this->getLockKey($job), $this->expiresAfter);
        if ($lock->get()) {
            try {
                $next($job);
            } finally {
                $lock->release();
            }
        } elseif ($this->releaseAfter !== null) {
            $job->release($this->releaseAfter);
        }
    }
}
