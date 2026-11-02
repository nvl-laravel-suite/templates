<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Connection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Nvl\Media\Contracts\HasNvlMedia;
use Nvl\Media\Contracts\MediaAuthorization;
use Nvl\Media\Enums\MediaAbility;
use Nvl\Media\Enums\MediaVisibility;
use Nvl\Media\MediaRegistration;
use Nvl\Media\Models\Media;
use Nvl\Media\Models\MediaAssociation;
use Nvl\Media\Services\MediaAssetService;
use Nvl\Media\Services\MediaAttachments;
use Nvl\Media\Services\MediaLibrary;
use Nvl\Media\Services\MediaModelRegistry;
use Nvl\Media\Services\MediaReader;
use Nvl\Media\Services\MediaUploader;
use Nvl\Support\Auth\CanonicalActorResolver;

/**
 * Native private Media composition shared by asset and output retention.
 *
 * @internal
 */
final readonly class RetainedMedia
{
    public function __construct(
        private TemplateOperation $operation,
        private MediaUploader $uploader,
        private MediaAttachments $attachments,
        private MediaReader $reader,
        private MediaAuthorization $authorization,
        private MediaAssetService $assets,
        private MediaLibrary $library,
        private CanonicalActorResolver $actors,
    ) {}

    /** Reject cross-connection compositions before any database or retained file write. */
    public function connection(Model $owner): Connection
    {
        $connection = $owner->getConnection();
        if ($connection !== MediaModelRegistry::newInstance()->getConnection()
            || $connection !== (new MediaAssociation)->getConnection()) {
            throw new \LogicException('Templates and Media must use the same actual database connection for retained bytes.');
        }

        return $connection;
    }

    /** The caller owns the encompassing transaction, including owner creation. */
    public function upload(Model&HasNvlMedia $owner, string $slotName, string $bytes, string $filename, string $mime): Media
    {
        $connection = $this->connection($owner);
        if ($connection->transactionLevel() < 1) {
            throw new \LogicException('Retained Media writes require the owner transaction.');
        }
        $actor = $this->operation->actor();
        $slot = MediaRegistration::forOwner($owner)->getSlot($slotName)
            ?? throw new \LogicException('The retained Media owner slot is not registered.');
        if ($slot->isPublic || ! $slot->isExclusive()) {
            throw new \LogicException('Retained Media requires a private exclusive owner slot.');
        }
        $temporary = tempnam(sys_get_temp_dir(), 'nvl-template-');
        if ($temporary === false) {
            throw new \RuntimeException('Unable to stage retained Media input.');
        }
        try {
            if (file_put_contents($temporary, $bytes) !== strlen($bytes)) {
                throw new \RuntimeException('Unable to stage complete retained Media input.');
            }
            $media = $this->uploader->upload(
                actor: $actor,
                file: new UploadedFile($temporary, $filename, $mime, null, true),
                disk: $slot->resolveDisk(false),
                model: $owner,
                slot: $slot,
                fileName: $filename,
                isPublic: false,
                allowDuplicates: true,
                deduplicateExisting: false,
                skipAutoVariations: true,
            );
            $this->attachments->attach($actor, $media, $owner, collection: $slotName, dispatchVariations: false, slot: $slot);
            if ($media->size !== strlen($bytes) || ! hash_equals($media->digest, hash('sha256', $bytes)) || $media->mime_type !== $mime) {
                throw new \RuntimeException('Native Media did not preserve the retained byte identity.');
            }

            return $media;
        } finally {
            @unlink($temporary);
        }
    }

    /** @param array{mediaId:string,revision:int,checksum:string,size:int,mimeType:string,filename:string} $identity */
    public function read(Model&HasNvlMedia $owner, string $slot, array $identity, int $limit): string
    {
        $media = $this->owned($owner, $slot, $identity);
        $actor = $this->operation->actor();
        $actor = $actor instanceof Authenticatable ? $this->actors->resolve($actor) : $actor;
        if (! $this->authorization->allows($actor, MediaAbility::Download, $media, $owner)) {
            throw new AuthorizationException('The actor cannot download this retained Media.');
        }
        if ($identity['size'] > $limit) {
            $this->fail();
        }
        $resolved = $this->assets->resolve($media);
        $disk = Storage::disk($resolved['disk']);
        if ($disk->size($resolved['path']) !== $identity['size']) {
            $this->fail();
        }
        $stream = $disk->readStream($resolved['path']);
        if (! is_resource($stream)) {
            $this->fail();
        }
        $bytes = '';
        try {
            while (! feof($stream)) {
                $remaining = $identity['size'] + 1 - strlen($bytes);
                if ($remaining < 1) {
                    $this->fail();
                }
                $chunk = fread($stream, min(65536, $remaining));
                if ($chunk === false || ($chunk === '' && ! feof($stream))) {
                    $this->fail();
                }
                $bytes .= $chunk;
                if (strlen($bytes) > $identity['size']) {
                    $this->fail();
                }
            }
        } finally {
            fclose($stream);
        }
        if (strlen($bytes) !== $identity['size'] || ! hash_equals($identity['checksum'], hash('sha256', $bytes))) {
            $this->fail();
        }

        return $bytes;
    }

    /** @param array{mediaId:string,revision:int,checksum:string,size:int,mimeType:string,filename:string} $identity */
    public function delete(Model&HasNvlMedia $owner, string $slot, array $identity): bool
    {
        $connection = $this->connection($owner);

        return $connection->transaction(function () use ($owner, $slot, $identity): bool {
            $media = $this->owned($owner, $slot, $identity);

            return $this->library->delete($this->operation->actor(), $media, owner: $owner);
        });
    }

    /** @param array{mediaId:string,revision:int,checksum:string,size:int,mimeType:string,filename:string} $identity */
    private function owned(Model&HasNvlMedia $owner, string $slot, array $identity): Media
    {
        $this->connection($owner);
        // Native owner-slot reads admit the canonical owner and apply current View policy.
        $rows = $this->reader->slots($this->operation->actor(), $owner, [$slot], limit: 1000);
        foreach ($rows[$slot] as $media) {
            if ($media->id !== $identity['mediaId']) {
                continue;
            }
            if ($media->visibility !== MediaVisibility::Private || $media->is_public
                || $media->revision !== $identity['revision'] || $media->size !== $identity['size']
                || $media->mime_type !== $identity['mimeType'] || ! hash_equals($identity['checksum'], $media->digest)) {
                $this->fail();
            }

            return $media;
        }
        $this->fail();
    }

    private function fail(): never
    {
        throw ValidationException::withMessages(['media' => ['Retained Media is unavailable or its immutable identity no longer matches.']]);
    }
}
