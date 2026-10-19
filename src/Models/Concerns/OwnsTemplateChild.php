<?php

declare(strict_types=1);

namespace Nvl\Templates\Models\Concerns;

use Illuminate\Container\Container;
use Nvl\Support\Ownership\Traits\HasOwnership;
use Nvl\Templates\Services\TemplateChildWriter;

/**
 * Delegates canonical internal child persistence without depending on actor state at model boot.
 *
 * @internal
 */
trait OwnsTemplateChild
{
    use HasOwnership;

    /** @param array<string,mixed> $options */
    public function save(array $options = []): bool
    {
        return Container::getInstance()->make(TemplateChildWriter::class)->save($this, fn (): bool => parent::save($options));
    }
}
