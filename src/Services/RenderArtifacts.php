<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Validation\ValidationException;
use League\Flysystem\FilesystemException;
use Nvl\Media\Exceptions\MediaUploadException;
use Nvl\Templates\Exceptions\RetryableRenderException;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Rendering\RenderedDocument;
use Nvl\Templates\Support\Access;

/**
 * Retains complete render bundles through native private Media.
 *
 * @internal
 */
final readonly class RenderArtifacts
{
    public function __construct(private RetainedMedia $media) {}

    /** @return array{mediaId:string,revision:int,checksum:string,size:int,mimeType:string,filename:string} */
    public function store(TemplateRender $render, RenderedDocument $result): array
    {
        return $this->write($render, json_encode($result->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), 'json', 'application/json', 'render.json');
    }

    /** @return array{mediaId:string,revision:int,checksum:string,size:int,mimeType:string,filename:string} */
    public function write(TemplateRender $render, string $bytes, string $extension, string $mime, string $filename): array
    {
        if ($bytes === '' || strlen($bytes) > $this->byteLimit()) {
            throw ValidationException::withMessages(['output' => ['Rendered output exceeds the byte limit.']]);
        }
        if (! in_array([$extension, $mime], [['json', 'application/json'], ['pdf', 'application/pdf']], true)
            || pathinfo($filename, PATHINFO_EXTENSION) !== $extension) {
            throw ValidationException::withMessages(['output' => ['Unsupported retained output format.']]);
        }
        $connection = $this->media->connection($render);

        try {
            return $connection->transaction(function () use ($render, $bytes, $mime, $filename): array {
                $media = $this->media->upload($render, 'retained_output', $bytes, $filename, $mime);

                return ['mediaId' => $media->id, 'revision' => $media->revision, 'size' => strlen($bytes),
                    'checksum' => hash('sha256', $bytes), 'mimeType' => $mime, 'filename' => $filename];
            });
        } catch (MediaUploadException|FilesystemException) {
            throw new RetryableRenderException('output_unavailable');
        }
    }

    public function read(TemplateRender $render): string
    {
        Access::authorize('read', $render);
        $manifest = $this->validate($render->result);

        return $this->media->read($render, 'retained_output', $manifest, $this->byteLimit());
    }

    /** @param array<array-key,mixed> $manifest Stored manifest; validated before native Media deletion. */
    public function delete(TemplateRender $render, array $manifest): bool
    {
        $manifest = $this->validate($manifest);

        return $this->media->delete($render, 'retained_output', $manifest);
    }

    /** @return array{mediaId:string,revision:int,checksum:string,size:int,mimeType:string,filename:string} */
    private function validate(mixed $manifest): array
    {
        if (! is_array($manifest) || ! is_string($manifest['mediaId'] ?? null)
            || ! preg_match('/^[a-f0-9-]{36}$/Di', $manifest['mediaId'])
            || ! is_int($manifest['revision'] ?? null) || $manifest['revision'] < 1
            || ! is_int($manifest['size'] ?? null) || $manifest['size'] < 1
            || ! is_string($manifest['checksum'] ?? null) || ! preg_match('/^[a-f0-9]{64}$/D', $manifest['checksum'])
            || ! in_array($manifest['mimeType'] ?? null, ['application/json', 'application/pdf'], true)
            || ! is_string($manifest['filename'] ?? null)) {
            throw ValidationException::withMessages(['output' => ['Invalid retained output manifest.']]);
        }

        return ['mediaId' => $manifest['mediaId'], 'revision' => $manifest['revision'],
            'checksum' => $manifest['checksum'], 'size' => $manifest['size'],
            'mimeType' => $manifest['mimeType'], 'filename' => $manifest['filename']];
    }

    private function byteLimit(): int
    {
        $limit = config('nvl-templates.limits.output_bytes');
        if (! is_int($limit) || $limit < 1) {
            throw new \LogicException('Configure a positive integer output byte limit.');
        }

        return $limit;
    }
}
