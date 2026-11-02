<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Content\Models\ContentBlock;
use Nvl\Media\Models\Media;
use Nvl\Ownership\Services\OwnershipAdoptionCoordinator;
use Nvl\Ownership\ValueObjects\OwnershipOperation;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Tests\OwnershipTestCase;

/** Leaves ordinary Templates installed while adopting only a host package. */
class UnscopedTemplatesOwnershipTestCase extends OwnershipTestCase
{
    protected function blockClass(): string
    {
        return ContentBlock::class;
    }

    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $app['config']->set('nvl-templates.models.template', Template::class);
        $app['config']->set('nvl-media.models.media', Media::class);
    }

    protected function adoptOwnership(): void
    {
        $operation = new OwnershipOperation('adopt-host-only', 'operator', '1');
        $coordinator = app(OwnershipAdoptionCoordinator::class);
        $plan = $coordinator->prepare(['fixture'], [], $operation);
        $coordinator->backfill($plan, 100, $operation);
        $coordinator->activate($plan, $operation);
    }
}
