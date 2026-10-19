<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Templates\Tests\OwnershipTestCase;

/** Exercises repeated preparation on one physically prefixed source. */
class TemplatesPrefixedOwnershipTestCase extends OwnershipTestCase
{
    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $app['config']->set('database.connections.sqlite.prefix', 'review_');
    }
}
