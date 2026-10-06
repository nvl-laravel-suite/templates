<?php

declare(strict_types=1);

namespace Nvl\Templates\Events;

use Nvl\Support\Contracts\DomainEvent;
use Nvl\Templates\Data\TemplateActorData;

/**
 * Announces a durable template aggregate mutation.
 *
 * @api
 */
final class TemplateChanged implements DomainEvent
{
    public function __construct(
        public readonly string $templateId,
        public readonly string $operation,
        public readonly TemplateActorData $actor,
        public readonly int $schemaVersion = 1,
    ) {}

    /** Return the immutable event payload schema version. */
    public function schemaVersion(): int
    {
        return $this->schemaVersion;
    }
}
