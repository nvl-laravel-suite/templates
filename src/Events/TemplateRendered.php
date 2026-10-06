<?php

declare(strict_types=1);

namespace Nvl\Templates\Events;

use Nvl\Support\Contracts\DomainEvent;

/**
 * Announces a completed durable render.
 *
 * @api
 */
final class TemplateRendered implements DomainEvent
{
    public function __construct(
        public readonly string $renderId,
        public readonly string $templateId,
        public readonly string $versionId,
        public readonly int $schemaVersion = 1,
    ) {}

    /** Return the immutable event payload schema version. */
    public function schemaVersion(): int
    {
        return $this->schemaVersion;
    }
}
