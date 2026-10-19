<?php

declare(strict_types=1);

namespace Nvl\Templates\Ownership;

use Nvl\Content\Contracts\ContentStorage;
use Nvl\Content\Contracts\ExportContentSnapshotForCopyContract;
use Nvl\Content\Contracts\ImportContentSnapshotContract;
use Nvl\Media\Contracts\MediaCatalogImport;
use Nvl\Media\Services\MediaModelRegistry;
use Nvl\Support\Ownership\Exceptions\OwnershipViolation;
use Nvl\Templates\Contracts\TemplateCatalogAccess;
use Nvl\Templates\Data\Mutations\ImportPlatformTemplateData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Enums\TemplateVersionStatus;
use Nvl\Templates\Models\TemplateOwnerGrant;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\CanonicalJson;
use Nvl\Templates\Services\TemplateDefinitionRegistry;
use Nvl\Templates\Services\TemplateModelRegistry;
use Throwable;

/**
 * Copies recipient-granted central publications into independent native graphs.
 *
 * @api
 */
final readonly class TemplateOwnerCatalog
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private TemplateCatalogSource $sources,
        private TemplateCatalogAccess $access,
        private TemplateDefinitionRegistry $definitions,
        private CanonicalJson $json,
        private ExportContentSnapshotForCopyContract $export,
        private ImportContentSnapshotContract $content,
        private MediaCatalogImport $media,
        private ContentStorage $storage,
    ) {}

    /** Issue or revise a recipient-owned capability for one central publication. */
    public function grant(string $sourceId, int $revision): TemplateOwnerGrant
    {
        $this->sources->admit();
        $this->access->assertCanGrant($sourceId, $revision);

        return TemplateModelRegistry::newInstance()->getConnection()->transaction(function () use ($sourceId, $revision): TemplateOwnerGrant {
            $source = $this->sources->version($sourceId, true);
            if ($source->revision !== $revision) {
                throw new OwnershipViolation('Template source revision changed.');
            }
            $grant = TemplateOwnerGrant::query()->where('template_version_id', $sourceId)->lockForUpdate()->first() ?? new TemplateOwnerGrant;
            $grant->forceFill(['template_version_id' => $sourceId, 'source_revision' => $revision, 'revision' => $grant->exists ? $grant->revision + 1 : 1, 'revoked_at' => null])->save();

            return $grant;
        });
    }

    /** Revoke one expected capability revision while retaining independent copies. */
    public function revoke(string $grantId, int $revision): TemplateOwnerGrant
    {
        $this->sources->admit();
        $this->access->assertCanRevoke($grantId);

        return TemplateModelRegistry::newInstance()->getConnection()->transaction(function () use ($grantId, $revision): TemplateOwnerGrant {
            $grant = TemplateOwnerGrant::query()->whereKey($grantId)->lockForUpdate()->first() ?? throw new OwnershipViolation('Template grant is unavailable.');
            if ($grant->revision !== $revision) {
                throw new OwnershipViolation('Template grant revision changed.');
            }
            $grant->forceFill(['revision' => $grant->revision + 1, 'revoked_at' => now()])->save();

            return $grant;
        });
    }

    /** Stage and recheck a granted graph before an atomic independent copy. */
    public function import(ImportPlatformTemplateData $data, TemplateActorData $actor): TemplateVersion
    {
        $this->sources->admit();
        $connection = TemplateModelRegistry::newInstance()->getConnection();
        foreach ([$this->storage->connection(), MediaModelRegistry::newInstance()->getConnection()] as $sourceConnection) {
            if ($sourceConnection->getPdo() !== $connection->getPdo()) {
                throw new OwnershipViolation('Atomic Template copies require Content and Media on the same actual source.');
            }
        }
        $grant = TemplateOwnerGrant::query()->whereKey($data->grantId)->first() ?? throw new OwnershipViolation('Template grant is unavailable.');
        $version = $this->sources->granted($grant->template_version_id, TemplateVersion::CONTENT_GROUP, $grant->id);
        $this->assertTuple($grant, $version, $data);
        $definition = $this->definitions->get($data->targetKey);
        if ($version->template->key !== $data->targetKey || $version->template->renderer !== $definition->renderer || $this->json->digest($version->template->schema) !== $this->json->digest($definition->schema)) {
            throw new OwnershipViolation('Template catalog source does not match its code definition.');
        }
        $source = $this->export->execute(TemplateVersion::CONTENT_OWNER_TYPE, $version->id, TemplateVersion::CONTENT_GROUP, $grant->id);
        $sourceIds = $source->mediaIds;
        sort($sourceIds);
        $grantIds = $data->mediaGrantIds;
        ksort($grantIds);
        if (array_keys($grantIds) !== $sourceIds) {
            throw new OwnershipViolation('Template copies require one exact Media grant map.');
        }
        $staged = [];
        $snapshots = [];
        try {
            foreach ($sourceIds as $sourceId) {
                $snapshot = $this->media->inspect($grantIds[$sourceId]);
                if ($snapshot->sourceId !== $sourceId) {
                    throw new OwnershipViolation('Media grant belongs to another source.');
                }
                $snapshots[$sourceId] = $snapshot;
                $staged[$sourceId] = $this->media->stage($snapshot);
            }

            return $connection->transaction(function () use ($data, $actor, $grant, $source, $definition, $sourceIds, $snapshots, $staged): TemplateVersion {
                $version = $this->sources->granted($source->ownerId, $source->group, $grant->id, true);
                if ($version->template->key !== $data->targetKey || $version->template->renderer !== $definition->renderer || $this->json->digest($version->template->schema) !== $this->json->digest($definition->schema)) {
                    throw new OwnershipViolation('Template code definition changed while staging.');
                }
                $locked = TemplateOwnerGrant::query()->whereKey($grant->id)->lockForUpdate()->firstOrFail();
                $this->assertTuple($locked, $version, $data);
                if ($this->export->execute($source->ownerAlias, $source->ownerId, $source->group, $source->grantId) != $source) {
                    throw new OwnershipViolation('Template catalog source changed while staging.');
                }
                $map = $data->mediaGrantIds;
                ksort($map);
                $hash = $this->json->digest([$data->grantId, $data->expectedGrantRevision, $data->expectedSourceRevision, $source->sourceHash, $data->targetKey, $map]);
                $existing = TemplateVersion::query()->where('catalog_import_key', $data->idempotencyKey)->lockForUpdate()->first();
                if ($existing !== null) {
                    if ($existing->getAttribute('catalog_import_request_hash') !== $hash) {
                        throw new OwnershipViolation('Template import key belongs to another request.');
                    }

                    return $existing;
                }
                if (TemplateModelRegistry::query()->where('key', $data->targetKey)->exists()) {
                    throw new OwnershipViolation('Template target key already exists.');
                }
                $template = TemplateModelRegistry::create(['key' => $data->targetKey, 'renderer' => $definition->renderer, 'status' => 'active', 'schema' => $definition->schema, 'metadata' => ['catalog_source_key' => $version->template->key]]);
                $copy = new TemplateVersion;
                $copy->forceFill(['template_id' => $template->id, 'version' => 1, 'status' => TemplateVersionStatus::Draft, 'metadata' => [], 'catalog_grant_id' => $locked->id, 'catalog_source_version_id' => $source->ownerId, 'catalog_source_revision' => $source->sourceRevision, 'catalog_source_hash' => $source->sourceHash, 'catalog_import_key' => $data->idempotencyKey, 'catalog_import_request_hash' => $hash])->save();
                $mediaMap = [];
                foreach ($sourceIds as $sourceId) {
                    $id = $this->media->persist($snapshots[$sourceId], $staged[$sourceId], $this->mediaKey($data->idempotencyKey, $sourceId))->getKey();
                    if (! is_string($id)) {
                        throw new OwnershipViolation('Copied Media identifier is invalid.');
                    }
                    $mediaMap[$sourceId] = $id;
                }
                $snapshot = $this->content->execute($copy, $source, $mediaMap, $actor->contentActor());
                $copy->forceFill(['content_snapshot' => $snapshot, 'content_hash' => $snapshot->version, 'status' => TemplateVersionStatus::Published, 'published_by_type' => $actor->type, 'published_by' => $actor->id, 'published_at' => now()])->save();

                return $copy->refresh();
            });
        } catch (Throwable $error) {
            foreach ($staged as $file) {
                $this->media->discard($file);
            }
            throw $error;
        }
    }

    private function assertTuple(TemplateOwnerGrant $grant, TemplateVersion $version, ImportPlatformTemplateData $data): void
    {
        if ($grant->id !== $data->grantId || $grant->revision !== $data->expectedGrantRevision || $grant->source_revision !== $data->expectedSourceRevision || $version->revision !== $data->expectedSourceRevision || $grant->revoked_at !== null) {
            throw new OwnershipViolation('Template grant or source revision changed.');
        }
    }

    private function mediaKey(string $key, string $source): string
    {
        $hex = substr(hash('sha256', $key."\0".$source), 0, 32);
        $hex[12] = '5';
        $hex[16] = dechex((hexdec($hex[16]) & 3) | 8);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20);
    }
}
