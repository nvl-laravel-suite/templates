<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

trait ImmutableRevision
{
    public static function bootImmutableRevision(): void
    {
        static::updating(fn () => throw new \LogicException('Published template revisions are immutable.'));
        static::deleting(fn () => throw new \LogicException('Published template revisions cannot be deleted.'));
    }
}
