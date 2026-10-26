<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Content\Enums\ContentVisibility;
use Nvl\Content\Services\ContentBlocks;
use Nvl\Content\Services\ContentPlacements;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateLifecycle;

/** Builds real published compositions through package actions. */
final class OwnershipTemplateScenario
{
    /** @param array<string,mixed> $values */
    public static function version(string $key = 'welcome', array $values = [], ContentVisibility $visibility = ContentVisibility::Public): TemplateVersion
    {
        $actor = SystemActor::Background;
        $template = app(TemplateLifecycle::class)->create(['key' => $key, 'translations' => ['en' => ['title' => 'Welcome']]], $actor);
        $version = app(TemplateLifecycle::class)->createVersion($template, ['metadata' => []], $actor);
        $block = app(ContentBlocks::class)->create(['definition' => 'copy', 'key' => $key.'-body', 'values' => $values, 'visibility' => $visibility, 'translations' => ['en' => ['text' => 'Private copy']]], SystemActor::Background);
        app(ContentPlacements::class)->place($block, $version, TemplateVersion::CONTENT_GROUP, ['key' => 'body', 'region' => 'main'], SystemActor::Background);

        return app(TemplateLifecycle::class)->publishVersion($version, $version->revision, $actor);
    }
}
