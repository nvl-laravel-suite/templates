<?php

declare(strict_types=1);

namespace Nvl\Templates\Console\Commands;

use Illuminate\Console\Command;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Services\RenderRequests;

final class RecoverTemplateRenders extends Command
{
    protected $signature = 'nvl:templates:renders:recover {--limit=100}';

    protected $description = 'Recover interrupted dispatches and expired template render leases in the active application scope';

    public function handle(RenderRequests $renders): int
    {
        $this->info('Recovered '.$renders->recover((int) $this->option('limit'), SystemActor::Background).' template renders.');

        return self::SUCCESS;
    }
}
