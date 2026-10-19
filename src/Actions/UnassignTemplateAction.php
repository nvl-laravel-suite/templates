<?php

declare(strict_types=1);

namespace Nvl\Templates\Actions;

use Nvl\Support\Events\DomainEventDispatcher;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Contracts\UnassignTemplateContract;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Events\TemplateChanged;
use Nvl\Templates\Exceptions\StaleTemplateException;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Deletes one assignment with exact optimistic concurrency.
 *
 * @api
 */
final readonly class UnassignTemplateAction implements UnassignTemplateContract
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private TemplateAuthorization $authorization,
        private OwnershipBoundary $boundary,
        private DomainEventDispatcher $domainEvents,
    ) {}

    /** Remove an admitted host/profile assignment at its expected revision. */
    public function execute(
        TemplateAssignment|string $assignment,
        int $expectedRevision,
        TemplateActorData $actor,
    ): bool {
        $assignmentId = $assignment instanceof TemplateAssignment
            ? $assignment->id
            : $assignment;

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use (
                $actor,
                $assignmentId,
                $expectedRevision,
            ): bool {
                $assignment = $this->boundary->query(TemplateAssignment::query(), 'templates.assignments')
                    ->lockForUpdate()
                    ->findOrFail($assignmentId);
                $this->authorization->authorize(
                    TemplateAbility::Assign,
                    $actor,
                    [
                        'template_id' => $assignment->template_id,
                        'owner_type' => $assignment->owner_type,
                        'owner_id' => $assignment->owner_id,
                        'profile' => $assignment->profile,
                        'version_id' => $assignment->template_version_id,
                        'operation' => 'unassign',
                    ],
                );

                if ($assignment->revision !== $expectedRevision) {
                    throw StaleTemplateException::forResource(
                        'template assignment',
                        $assignment->id,
                    );
                }

                $templateId = $assignment->template_id;
                $deleted = (bool) $assignment->delete();

                if ($deleted) {
                    $this->domainEvents->dispatch(new TemplateChanged($templateId, 'unassigned', $actor), $assignment->getConnection());
                }

                return $deleted;
            });
    }
}
