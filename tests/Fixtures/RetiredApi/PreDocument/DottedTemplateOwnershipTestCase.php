<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Templates\Tests\OwnershipTestCase;

/** Installs literal aliases before the immutable graph is adopted. */
class DottedTemplateOwnershipTestCase extends OwnershipTestCase
{
    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $app['config']->set('nvl-templates.owners', ['member' => OwnershipTemplateOwnerResolver::class, 'sales.order' => DottedTemplateOwnerResolver::class]);
        $app['config']->set('nvl-templates.ownership.owner_resources', ['member' => 'fixture.template-hosts', 'sales.order' => 'fixture.template-hosts']);
    }
}
