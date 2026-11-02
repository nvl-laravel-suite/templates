<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Support;

use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Services\ResourceCloner;
use Nvl\Templates\Services\TemplateOperation;

/** Exercise internal copy algorithms within the same explicit admission used by family operations. */
final class ClonerClient
{
    public function copy(Template $template, array $source): array
    {
        return app(TemplateOperation::class)->run(SystemActor::Background, fn () => app(ResourceCloner::class)->copy($template, $source));
    }
}
