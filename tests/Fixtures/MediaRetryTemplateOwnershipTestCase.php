<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Templates\Tests\OwnershipTestCase;

/** Installs a real Media field before the published copy is captured. */
class MediaRetryTemplateOwnershipTestCase extends OwnershipTestCase
{
    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $fields = $app['config']->get('nvl-content.definitions.copy.schema.fields');
        if (! is_array($fields)) {
            throw new \RuntimeException('The installed copy definition requires an explicit field list.');
        }
        $fields[] = ['key' => 'logo', 'type' => 'media', 'label' => 'Logo', 'settings' => ['mime_types' => ['image/png']]];
        $app['config']->set('nvl-content.definitions.copy.schema.fields', $fields);
    }
}
