<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Nvl\Media\Contracts\HasNvlMedia;
use Nvl\Media\MediaRegistration;
use Nvl\Media\Models\Media;
use Nvl\Media\Traits\InteractsWithNvlMedia;

/**
 * Native document persistence record.
 *
 * @property string $template_revision_id
 * @property string|null $idempotency_key
 * @property string $fingerprint
 * @property string $status
 * @property array<string, mixed>|null $snapshot
 * @property string|null $snapshot_checksum
 * @property array<string, mixed>|null $result
 * @property string|null $error
 * @property string $output
 * @property int $generation
 * @property int $attempts
 * @property string|null $processing_token
 * @property Carbon|null $available_at
 * @property Carbon|null $dispatch_requested_at
 * @property Carbon|null $dispatched_at
 * @property Carbon|null $lease_expires_at
 * @property Carbon|null $completed_at
 * @property Carbon|null $failed_at
 * @property Carbon|null $expires_at
 * @property Carbon|null $purged_at
 *
 * @api
 */
final class TemplateRender extends TemplateModel implements HasNvlMedia
{
    use InteractsWithNvlMedia;

    public function registerNvlMedia(MediaRegistration $media, ?Media $asset = null): void
    {
        $slot = $media->slot('retained_output')->privateExclusive()->acceptsMimeTypes(['application/json', 'application/pdf']);
        $disk = config('nvl-templates.media.disk') ?? config('nvl-media.private_disk');
        if (is_string($disk) && $disk !== '') {
            $slot->useDisk($disk);
        }
    }

    protected string $tableKey = 'renders';

    protected $hidden = ['snapshot', 'snapshot_checksum', 'result', 'processing_token'];

    protected function casts(): array
    {
        return ['snapshot' => 'encrypted:array', 'result' => 'array', 'generation' => 'integer', 'attempts' => 'integer',
            'available_at' => 'immutable_datetime', 'dispatch_requested_at' => 'immutable_datetime', 'dispatched_at' => 'immutable_datetime', 'lease_expires_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime', 'failed_at' => 'immutable_datetime', 'expires_at' => 'immutable_datetime', 'purged_at' => 'immutable_datetime'];
    }

    /** @return BelongsTo<TemplateRevision, $this> */
    public function revision(): BelongsTo
    {
        return $this->belongsTo(TemplateRevision::class, 'template_revision_id');
    }
}
