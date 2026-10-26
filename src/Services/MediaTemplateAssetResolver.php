<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\UploadedFile;
use Nvl\Media\Enums\MediaLifecycleStatus;
use Nvl\Media\Models\Media;
use Nvl\Media\Services\MediaAttachments;
use Nvl\Media\Services\MediaReader;
use Nvl\Media\Services\MediaUploader;
use Nvl\Media\Slots\MediaSlot;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAssetResolver;
use Nvl\Templates\Exceptions\TemplateResolutionException;
use Nvl\Templates\Models\TemplateRender;

/**
 * Resolves opt-in template aliases through revision-aware NVL Media delivery.
 *
 * @internal
 */
final readonly class MediaTemplateAssetResolver implements TemplateAssetResolver
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private MediaTemplateAssetRegistry $assets,
        private TemplateAssetGuard $guard,
    ) {}

    /** Resolve the current revision-aware Media asset through its canonical boundary. */
    public function resolve(string $key, Authenticatable|SystemActor $actor): ?string
    {
        $this->guard->key($key);
        $asset = $this->assets->get($key);

        if (! is_array($asset)) {
            return null;
        }

        try {
            $media = app(MediaReader::class)->get($actor, $asset['mediaId']);
        } catch (ModelNotFoundException $exception) {
            throw new TemplateResolutionException('Template Media alias points to missing or unavailable media.', previous: $exception);
        }

        if ($asset['expected_revision'] !== null && $media->revision !== $asset['expected_revision']) {
            throw new TemplateResolutionException(
                "Template Media alias [{$key}] expected revision {$asset['expected_revision']}, current revision is {$media->revision}.",
            );
        }

        if ($asset['variation'] !== '') {
            $variation = $media->getVariation($asset['variation']);

            if ($variation === null
                || $variation->status !== MediaLifecycleStatus::Available->value
                || $variation->source_revision !== $media->revision) {
                throw new TemplateResolutionException(
                    "Template Media alias [{$key}] variation [{$asset['variation']}] is not available for revision {$media->revision}.",
                );
            }
        }

        $value = $asset['delivery'] === 'url'
            ? $media->getUrl($asset['variation'])
            : $media->getPath($asset['variation']);

        if ($value === '') {
            throw new TemplateResolutionException(
                "Template Media alias [{$key}] could not produce a safe {$asset['delivery']}.",
            );
        }

        $this->guard->value($value);

        return $value;
    }

    /**
     * @return array<string, string>
     */
    public function scope(string $scope, Authenticatable|SystemActor $actor, ?string $type = null): array
    {
        $resolved = [];

        foreach (array_keys($this->assets->scope($scope, $type)) as $key) {
            $value = $this->resolve($key, $actor);

            if ($value !== null) {
                $resolved[$key] = $value;
            }
        }

        return $resolved;
    }

    /** Persist one verified binary result under the private exclusive render slot.
     * @param  array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}  $result
     */
    public function storeOutput(TemplateRender $render, array $result, string $filename, string $disk, Authenticatable|SystemActor $actor): void
    {
        $temporary = tempnam(sys_get_temp_dir(), 'nvl-template-');
        if ($temporary === false) {
            throw new \RuntimeException('Unable to stage template output.');
        }
        try {
            if (file_put_contents($temporary, $result['content']) !== strlen($result['content'])) {
                throw new \RuntimeException('Unable to stage complete template output.');
            }
            $slot = (new MediaSlot('output'))->privateExclusive()->onlyKeepLatest(1);
            $file = new UploadedFile($temporary, $filename, $result['mime_type'], test: true);
            $media = app(MediaUploader::class)->upload($actor, $file, $disk, $render, $slot, $filename, isPublic: false);
            app(MediaAttachments::class)->attach($actor, $media, $render, 'output', slot: $slot);
        } finally {
            @unlink($temporary);
        }
    }
}
