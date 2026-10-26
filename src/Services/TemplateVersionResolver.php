<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Enums\TemplateVersionStatus;
use Nvl\Templates\Exceptions\TemplateResolutionException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateVersion;

/**
 * Applies the package's single publication-status policy to version selection.
 */
final class TemplateVersionResolver
{
    /**
     * Resolve an immutable version that may be pinned to an assignment.
     *
     * @param  array{locale: string, payload: array<string, mixed>, ownerType: string|null, ownerId: string|null, profile: string, versionId: string|null, idempotencyKey: string|null, download: bool}  $data
     */
    public function forRender(
        Template $template,
        array $data,
        ?TemplateAssignment $assignment,
        Authenticatable|SystemActor $actor,
    ): TemplateVersion {
        $data += ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotencyKey' => null, 'download' => false];
        $explicitVersion = $data['versionId'] !== null;
        $assignmentVersion = ! $explicitVersion
            && $assignment?->template_version_id !== null;
        $versionId = $data['versionId'] ?? $assignment?->template_version_id;
        $statuses = ($actor instanceof SystemActor) || $assignmentVersion
            ? [
                TemplateVersionStatus::Published->value,
                TemplateVersionStatus::Retired->value,
            ]
            : [TemplateVersionStatus::Published->value];
        $query = $template->versions()->whereIn('status', $statuses);

        if ($versionId !== null) {
            $query->where('id', $versionId);
        } else {
            $query->orderByDesc('version');
        }

        return $query->first()
            ?? throw new TemplateResolutionException(
                "Template [{$template->key}] has no matching immutable version.",
            );
    }

    /**
     * Resolve a published or retired version for a durable assignment pin.
     */
    public function forAssignment(
        Template $template,
        string $versionId,
    ): TemplateVersion {
        return $template->versions()
            ->whereKey($versionId)
            ->whereIn('status', [
                TemplateVersionStatus::Published->value,
                TemplateVersionStatus::Retired->value,
            ])
            ->first()
            ?? throw new TemplateResolutionException(
                'Template assignments may only pin published or retired versions.',
            );
    }
}
