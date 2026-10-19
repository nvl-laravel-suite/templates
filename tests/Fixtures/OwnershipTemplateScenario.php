<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Nvl\Content\Actions\CreateContentBlockAction;
use Nvl\Content\Actions\PlaceContentBlockAction;
use Nvl\Content\Data\ContentActorData;
use Nvl\Content\Data\Mutations\CreateContentBlockData;
use Nvl\Content\Data\Mutations\PlaceContentBlockData;
use Nvl\Content\Enums\ContentVisibility;
use Nvl\Templates\Actions\CreateTemplateAction;
use Nvl\Templates\Actions\CreateTemplateVersionAction;
use Nvl\Templates\Actions\PublishTemplateVersionAction;
use Nvl\Templates\Data\Mutations\CreateTemplateData;
use Nvl\Templates\Data\Mutations\CreateTemplateVersionData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\TemplateVersion;

/** Builds real published compositions through package actions. */
final class OwnershipTemplateScenario
{
    /** @param array<string,mixed> $values */
    public static function version(string $key = 'welcome', array $values = [], ContentVisibility $visibility = ContentVisibility::Public): TemplateVersion
    {
        $actor = TemplateActorData::system();
        $template = app(CreateTemplateAction::class)->execute(CreateTemplateData::from(['key' => $key, 'translations' => ['en' => ['title' => 'Welcome']]]), $actor);
        $version = app(CreateTemplateVersionAction::class)->execute($template, CreateTemplateVersionData::from(['metadata' => []]), $actor);
        $block = app(CreateContentBlockAction::class)->execute(CreateContentBlockData::from(['definition' => 'copy', 'key' => $key.'-body', 'values' => $values, 'visibility' => $visibility, 'translations' => ['en' => ['text' => 'Private copy']]]), ContentActorData::system());
        app(PlaceContentBlockAction::class)->execute($block, $version, TemplateVersion::CONTENT_GROUP, PlaceContentBlockData::from(['key' => 'body', 'region' => 'main']), ContentActorData::system());

        return app(PublishTemplateVersionAction::class)->execute($version, $version->revision, $actor);
    }
}
