<?php

declare(strict_types=1);

namespace Nvl\Templates\Console\Commands;

use Illuminate\Console\Command;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Services\RenderRequests;

final class PruneTemplateRenders extends Command
{
    protected $signature = 'nvl:templates:renders:prune {--limit=100}';

    protected $description = 'Remove expired retained template renders and their native Media artifacts';

    public function handle(RenderRequests $renders): int
    {
        $limit = (int) $this->option('limit');
        $this->info('Purged '.$renders->prune($limit, SystemActor::Background).' expired renders and their retained artifacts.');

        return self::SUCCESS;
    }
}
