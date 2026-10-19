<?php

declare(strict_types=1);

namespace Nvl\Templates\Actions;

use InvalidArgumentException;
use Nvl\Support\Events\DomainEventDispatcher;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Contracts\UpdateTemplateVersionContract;
use Nvl\Templates\Data\Mutations\UpdateTemplateVersionData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Enums\TemplateVersionStatus;
use Nvl\Templates\Events\TemplateChanged;
use Nvl\Templates\Exceptions\StaleTemplateException;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateContentGuard;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Replaces draft content while published and retired versions stay immutable.
 *
 * @api
 */
final readonly class UpdateTemplateVersionAction implements UpdateTemplateVersionContract
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private TemplateAuthorization $authorization,
        private TemplateContentGuard $guard,
        private OwnershipBoundary $boundary,
        private DomainEventDispatcher $domainEvents,
    ) {}

    /** Update draft metadata while rejecting stale or immutable publications. */
    public function execute(
        TemplateVersion|string $version,
        UpdateTemplateVersionData $data,
        TemplateActorData $actor,
    ): TemplateVersion {
        $versionId = $version instanceof TemplateVersion ? $version->id : $version;
        $this->authorization->authorize(
            TemplateAbility::Update,
            $actor,
            ['version_id' => $versionId],
        );
        $this->guard->metadata($data->metadata);

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use ($actor, $data, $versionId): TemplateVersion {
                $version = $this->boundary->query(TemplateVersion::query(), 'templates.versions')
                    ->lockForUpdate()
                    ->findOrFail($versionId);

                if ($version->revision !== $data->expectedRevision) {
                    throw StaleTemplateException::forResource('template version', $version->id);
                }

                if ($version->status !== TemplateVersionStatus::Draft) {
                    throw new InvalidArgumentException(
                        'Published and retired template versions are immutable.',
                    );
                }

                $version->fill([
                    'metadata' => $data->metadata,
                    'content_snapshot' => null,
                    'content_hash' => null,
                ])->save();
                $this->domainEvents->dispatch(new TemplateChanged($version->template_id, 'version_updated', $actor), $version->getConnection());

                return $version->refresh();
            });
    }
}
