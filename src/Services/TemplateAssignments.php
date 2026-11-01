<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\UniqueConstraintViolationException;
use InvalidArgumentException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Events\DomainEventDispatcher;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Events\TemplateChanged;
use Nvl\Templates\Exceptions\StaleTemplateException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Ownership\TemplatesOwnership;

/**
 * Complete native template operations.
 *
 * @api
 */
final readonly class TemplateAssignments
{
    public function __construct(private TemplateAuthorization $authorization, private TemplateOwnerRegistry $owners, private TemplateDefinitionRegistry $definitions, private TemplateContentGuard $guard, private TemplateVersionResolver $versions, private OwnershipBoundary $boundary, private DomainEventDispatcher $domainEvents) {}

    /**
     * Create or revise one exact owner and profile assignment.
     *
     * @param  array<string,mixed>  $data
     */
    public function assign(
        Template|string $template,
        array $data,
        Authenticatable|SystemActor $actor,
    ): TemplateAssignment {
        $data = $this->guard->assign($data);
        $data += ['profile' => 'default', 'versionId' => null, 'settings' => [], 'expected_revision' => 0];
        $templateId = $template instanceof Template ? $template->id : $template;
        $actor = $this->guard->actor($actor);
        $this->authorization->authorize(
            TemplateAbility::Assign,
            $actor,
            [
                'template_id' => $templateId,
                'owner_type' => $data['ownerType'],
                'owner_id' => $data['ownerId'],
                'profile' => $data['profile'],
                'version_id' => $data['versionId'],
            ],
        );
        $this->owners->resolve($data['ownerType'], $data['ownerId']);
        $this->guard->settings($data['settings']);

        try {
            return TemplateModelRegistry::newInstance()->getConnection()
                ->transaction(function () use ($actor, $data, $templateId): TemplateAssignment {
                    $template = $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')->lockForUpdate()->findOrFail($templateId);
                    $definition = $this->definitions->get($template->key);
                    $canonicalJson = new CanonicalJson;

                    if ($template->status !== TemplateStatus::Active
                        || $template->renderer !== $definition['renderer']
                        || $canonicalJson->digest($template->schema)
                            !== $canonicalJson->digest($definition['schema'])) {
                        throw new InvalidArgumentException(
                            "Template [{$template->key}] must be active and synchronized before assignment.",
                        );
                    }

                    if (! in_array($data['profile'], $definition['profiles'], true)) {
                        throw new InvalidArgumentException(
                            "Profile [{$data['profile']}] is not declared for template [{$template->key}].",
                        );
                    }

                    if ($data['versionId'] !== null) {
                        $this->versions->forAssignment($template, $data['versionId']);
                    }

                    $assignment = $this->boundary->query(TemplateAssignment::query(), 'templates.assignments')
                        ->where('owner_type', $data['ownerType'])
                        ->where('owner_id', $data['ownerId'])
                        ->where('profile', $data['profile'])
                        ->lockForUpdate()
                        ->first();

                    if ($assignment !== null
                        && $assignment->revision !== $data['expected_revision']) {
                        throw StaleTemplateException::forResource('template assignment', $assignment->id);
                    }

                    if ($assignment === null && $data['expected_revision'] !== 0) {
                        throw StaleTemplateException::forResource('template assignment', 'new');
                    }

                    $nextRevision = null;
                    if (TemplatesOwnership::declared() && $assignment !== null && $assignment->template_id !== $template->id) {
                        $nextRevision = $assignment->revision + 1;
                        $assignment->delete();
                        $assignment = null;
                    }
                    $assignment ??= new TemplateAssignment;
                    if ($nextRevision !== null) {
                        $assignment->forceFill(['revision' => $nextRevision]);
                    }
                    $assignment->fill([
                        'template_id' => $template->id,
                        'template_version_id' => $data['versionId'],
                        'owner_type' => $data['ownerType'],
                        'owner_id' => $data['ownerId'],
                        'profile' => $data['profile'],
                        'settings' => $data['settings'],
                    ])->save();
                    $this->domainEvents->dispatch(new TemplateChanged($template->id, 'assigned', $actor), $template->getConnection());

                    return $assignment->refresh();
                });
        } catch (UniqueConstraintViolationException $exception) {
            $assignment = $this->boundary->query(TemplateAssignment::query(), 'templates.assignments')
                ->where('owner_type', $data['ownerType'])
                ->where('owner_id', $data['ownerId'])
                ->where('profile', $data['profile'])
                ->first();

            if ($assignment === null) {
                throw $exception;
            }

            throw StaleTemplateException::forResource(
                'template assignment',
                $assignment->id,
            );
        }
    }

    /** Remove an admitted host/profile assignment at its expected revision. */
    public function unassign(
        TemplateAssignment|string $assignment,
        int $expectedRevision,
        Authenticatable|SystemActor $actor,
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
                $actor = $this->guard->actor($actor);
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
