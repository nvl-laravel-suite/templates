<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use DOMDocument;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Services\AssetManager;
use Nvl\Templates\Support\Access;

final class RenderOutput
{
    /**
     * @param  array<string, string>  $assetReferences  Candidate CID to retained asset ID.
     * @param  array<string, string>  $assetNames  Accepted names keyed by CID, when rendering a snapshot.
     */
    public function finalize(RenderedDocument $result, array $assetReferences = [], array $assetNames = []): RenderedDocument
    {
        $bytes = $this->encodedSize($result->toArray());
        $this->guard($bytes);
        $assets = [];
        if ($assetReferences !== []) {
            $dom = new DOMDocument('1.0', 'UTF-8');
            $previous = libxml_use_internal_errors(true);
            try {
                $dom->loadHTML('<?xml encoding="utf-8" ?>'.$result->html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
            } finally {
                libxml_clear_errors();
                libxml_use_internal_errors($previous);
            }
            $referenced = [];
            foreach ($dom->getElementsByTagName('img') as $image) {
                $source = $image->getAttribute('src');
                if (strncasecmp($source, 'cid:', 4) === 0) {
                    $referenced[substr($source, 4)] = true;
                }
            }
            $assetReferences = array_intersect_key($assetReferences, $referenced);
            $minimumBytes = $bytes;
            $count = 0;
            foreach ($assetReferences as $cid => $id) {
                $asset = TemplateAsset::query()->findOrFail($id);
                Access::authorize('read', $asset);
                $this->guard($asset->size);
                $metadata = ['cid' => $cid, 'name' => $assetNames[$cid] ?? $asset->name, 'mimeType' => $asset->mime_type, 'content' => ''];
                $minimumBytes += $this->encodedSize($metadata) + 4 * intdiv($asset->size + 2, 3) + ($count++ === 0 ? 0 : 1);
                $this->guard($minimumBytes);
            }
            foreach ($assetReferences as $cid => $id) {
                $resolved = app(AssetManager::class)->resolve($id, 'email');
                if ($resolved['attachment'] === null) {
                    throw ValidationException::withMessages(['assets' => ['An inline asset requires retained attachment bytes.']]);
                }
                $asset = array_replace($resolved['attachment'], ['name' => $assetNames[$cid] ?? $resolved['attachment']['name']]);
                $bytes += $this->encodedSize($asset) + ($assets === [] ? 0 : 1);
                $this->guard($bytes);
                $assets[] = $asset;
            }
        }
        $result = new RenderedDocument($result->html, $result->css, $result->subject, $result->text, $result->revisionId, $result->checksum, $assets);
        $this->guard($this->encodedSize($result->toArray()));

        return $result;
    }

    /** @param array<array-key,mixed> $value */
    private function encodedSize(array $value): int
    {
        return strlen(json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    }

    private function guard(int $bytes): void
    {
        if ($bytes < 0 || $bytes > config('nvl-templates.limits.output_bytes')) {
            throw ValidationException::withMessages(['output' => ['Rendered output exceeds the byte limit.']]);
        }
    }
}
