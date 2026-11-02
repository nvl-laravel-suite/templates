<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Carbon\CarbonImmutable;
use Nvl\Media\Contracts\HasNvlMedia;
use Nvl\Media\MediaRegistration;
use Nvl\Media\Models\Media;
use Nvl\Media\Traits\InteractsWithNvlMedia;

/**
 * Immutable retained image identity owned by the Templates document graph.
 *
 * @property string $name
 * @property string|null $media_id
 * @property int|null $media_revision
 * @property string $mime_type
 * @property int $size
 * @property string $checksum
 * @property CarbonImmutable|null $archived_at
 *
 * @api
 */
final class TemplateAsset extends TemplateModel implements HasNvlMedia
{
    use InteractsWithNvlMedia;

    protected string $tableKey = 'assets';

    protected static function booted(): void
    {
        parent::booted();
        self::updating(function (self $asset): void {
            $allowed = ['name', 'archived_at', 'updated_at'];
            if ($asset->getRawOriginal('media_id') === null && $asset->getRawOriginal('media_revision') === null
                && is_string($asset->media_id) && is_int($asset->media_revision) && $asset->media_revision > 0) {
                $allowed = [...$allowed, 'media_id', 'media_revision'];
            }
            if (array_diff(array_keys($asset->getDirty()), $allowed)) {
                throw new \LogicException('Imported asset identities and bytes are immutable. Import a new asset instead.');
            }
        });
        self::deleting(fn () => throw new \LogicException('Imported assets are retained for published revisions.'));
    }

    public function registerNvlMedia(MediaRegistration $media, ?Media $asset = null): void
    {
        $slot = $media->slot('retained_asset')->privateExclusive()->singleFile()
            ->acceptsMimeTypes(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
        $disk = config('nvl-templates.media.disk') ?? config('nvl-media.private_disk');
        if (is_string($disk) && $disk !== '') {
            $slot->useDisk($disk);
        }
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['media_revision' => 'integer', 'size' => 'integer', 'archived_at' => 'immutable_datetime'];
    }
}
