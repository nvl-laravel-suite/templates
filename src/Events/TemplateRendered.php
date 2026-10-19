<?php

declare(strict_types=1);

namespace Nvl\Templates\Events;

use Nvl\Support\Contracts\DomainEvent;
use Nvl\Support\Ownership\Contracts\OwnershipQueuedJob;
use Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope;
use Nvl\Templates\Ownership\TemplatesOwnership;

/**
 * Announces a completed durable render.
 *
 * @api
 */
final class TemplateRendered implements DomainEvent, OwnershipQueuedJob
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        public readonly string $renderId,
        public readonly string $templateId,
        public readonly string $versionId,
        public readonly int $schemaVersion = 1,
    ) {
        $this->ownershipEnvelope = TemplatesOwnership::envelope();
    }

    private readonly OwnershipJobEnvelope $ownershipEnvelope;

    /** Return the scalar authority captured before queue serialization. */
    public function ownershipJobEnvelope(): OwnershipJobEnvelope
    {
        return $this->ownershipEnvelope;
    }

    /** Return the immutable event payload schema version. */
    public function schemaVersion(): int
    {
        return $this->schemaVersion;
    }
}
