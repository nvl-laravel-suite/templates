<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Nvl\Media\Contracts\MediaAuthorization;
use Nvl\Media\Enums\MediaAbility;
use Nvl\Media\Models\Media;
use Nvl\Support\Enums\SystemActor;

/** Mutable current permission state shared with already-resolved native Media services. */
final class NativePdfAcceptanceMediaPolicy implements MediaAuthorization
{
    public ?string $deniedDownloadMediaId = null;

    public function allows(Authenticatable|SystemActor $actor, MediaAbility $ability, ?Media $media = null, ?Model $owner = null): bool
    {
        return $this->deniedDownloadMediaId === null || $ability !== MediaAbility::Download || $media?->id !== $this->deniedDownloadMediaId;
    }
}
