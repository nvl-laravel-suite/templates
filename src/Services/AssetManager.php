<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\DnsResolver;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\Capabilities;

/**
 * Document asset engine; enter through TemplateAssets or another native operation.
 *
 * @internal
 */
final class AssetManager
{
    public function __construct(private DnsResolver $dns, private RetainedMedia $media) {}

    public function upload(UploadedFile $file): TemplateAsset
    {
        Access::authorize('manage');
        if (! $file->isValid() || $file->getSize() > $this->byteLimit()) {
            $this->fail('Upload is invalid or too large.');
        }

        $path = $file->getRealPath();
        $bytes = $path === false ? false : file_get_contents($path);
        if (! is_string($bytes)) {
            $this->fail('Uploaded asset bytes are unavailable.');
        }

        return $this->store($bytes, $file->getClientOriginalName());
    }

    public function fromStorage(string $sourceId, string $key, string $name): TemplateAsset
    {
        Access::authorize('manage');
        $source = config('nvl-templates.imports.sources.'.$sourceId);
        if (! is_array($source) || $key === '' || str_starts_with($key, '/') || preg_match('/(^|[\/\\\\])\.\.([\/\\\\]|$)|[\x00-\x1f]/', $key)) {
            $this->fail('Use an authorized named storage source and relative object key.');
        }
        $diskName = $source['disk'] ?? null;
        $prefix = $source['prefix'] ?? '';
        if (! is_string($diskName) || $diskName === '' || ! is_string($prefix)) {
            throw new \LogicException('Configure the import source with a disk name and optional string prefix.');
        }
        $disk = Storage::disk($diskName);
        $path = rtrim($prefix, '/').'/'.$key;
        if (! $disk->exists($path) || $disk->size($path) > $this->byteLimit()) {
            $this->fail('Source file is unavailable or too large.');
        }

        $bytes = $disk->get($path);
        if (! is_string($bytes)) {
            $this->fail('Source file bytes are unavailable.');
        }

        return $this->store($bytes, $name);
    }

    public function fromUrl(string $url, string $name): TemplateAsset
    {
        Access::authorize('manage');
        $host = strtolower(parse_url($url, PHP_URL_HOST) ?: '');
        $allowed = $this->allowedHosts();
        if (parse_url($url, PHP_URL_SCHEME) !== 'https' || ! in_array($host, $allowed, true) || parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null || ! in_array(parse_url($url, PHP_URL_PORT), [null, 443], true) || preg_match('/[\x00-\x20\\\\]/', $url)) {
            $this->fail('URL imports require an explicitly approved HTTPS hostname.');
        }
        $addresses = $this->dns->addresses($host);
        if ($addresses === [] || ! defined('CURLOPT_RESOLVE')) {
            $this->fail('A pinned public DNS destination is required.');
        }
        foreach ($addresses as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_GLOBAL_RANGE)) {
                $this->fail('Private or reserved URL import destinations are prohibited.');
            }
        }
        $destination = $addresses[0] ?? null;
        if (! is_string($destination)) {
            $this->fail('A pinned public DNS destination is required.');
        }
        $timeout = config('nvl-templates.imports.timeout', 10);
        if ((! is_int($timeout) && ! is_float($timeout)) || $timeout <= 0 || ! is_finite((float) $timeout)) {
            throw new \LogicException('Configure a positive finite import timeout.');
        }
        $response = Http::timeout($timeout)->connectTimeout(5)->withOptions([
            'allow_redirects' => false, 'stream' => true, 'proxy' => '',
            'curl' => [CURLOPT_RESOLVE => [$host.':443:'.$destination]],
        ])->get($url);
        if (! $response->successful()) {
            $this->fail('Remote asset could not be imported without redirects.');
        }
        $stream = $response->toPsrResponse()->getBody();
        $bytes = '';
        $limit = $this->byteLimit();
        while (! $stream->eof()) {
            $bytes .= $stream->read(min(65536, $limit + 1 - strlen($bytes)));
            if (strlen($bytes) > $limit) {
                $stream->close();
                $this->fail('Remote asset exceeds the byte limit.');
            }
        }
        $stream->close();

        return $this->store($bytes, $name);
    }

    /**
     * Deferred email references still validate their retained bytes before compilation.
     *
     * @return array{id:string,checksum:string,mimeType:string,url:string,attachment:?array{cid:string,name:string,mimeType:string,content:string}}
     */
    public function resolve(string $id, string $target = 'document', bool $embedEmail = true): array
    {
        if (! in_array($target, ['document', 'email'], true)) {
            $this->fail('Unsupported asset render target.');
        }
        [$asset,$bytes] = $this->contents($id);
        if (! in_array($asset->mime_type, Capabilities::assetTypesByTarget()[$target], true)) {
            $this->fail('The retained image type is unsupported for this render target.');
        }
        $cid = 'template-'.$asset->id.'@assets';

        return ['id' => $asset->id, 'checksum' => $asset->checksum, 'mimeType' => $asset->mime_type,
            'url' => $target === 'email' ? 'cid:'.$cid : 'data:'.$asset->mime_type.';base64,'.base64_encode($bytes),
            'attachment' => $target === 'email' && $embedEmail ? ['cid' => $cid, 'name' => $asset->name, 'mimeType' => $asset->mime_type, 'content' => base64_encode($bytes)] : null];
    }

    /** @return array{0:TemplateAsset,1:string} */
    public function contents(string $id): array
    {
        $asset = TemplateAsset::query()->findOrFail($id);
        Access::authorize('read', $asset);
        if (! is_string($asset->media_id) || ! is_int($asset->media_revision)) {
            $this->fail('Managed asset has no retained Media identity.');
        }
        $bytes = $this->media->read($asset, 'retained_asset', [
            'mediaId' => $asset->media_id, 'revision' => $asset->media_revision,
            'checksum' => $asset->checksum, 'size' => $asset->size,
            'mimeType' => $asset->mime_type, 'filename' => $asset->name,
        ], $this->byteLimit());

        return [$asset, $bytes];
    }

    private function store(string $bytes, string $name): TemplateAsset
    {
        if ($bytes === '' || strlen($bytes) > $this->byteLimit()) {
            $this->fail('Asset exceeds the byte limit or is empty.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $image = in_array($mime, ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], true);
        if (! $image) {
            $this->fail('This asset driver accepts PNG, JPEG, WebP and GIF images.');
        }
        $size = @getimagesizefromstring($bytes);
        if (! $size || $size[0] * $size[1] > 40000000) {
            $this->fail('Invalid image or decoded image dimensions exceed the limit.');
        }
        $asset = new TemplateAsset;
        $connection = $this->media->connection($asset);

        return $connection->transaction(function () use ($asset, $bytes, $name, $mime): TemplateAsset {
            $filename = mb_substr(basename(str_replace('\\', '/', $name)), 0, 200);
            $asset->fill(['name' => $filename, 'mime_type' => $mime, 'size' => strlen($bytes), 'checksum' => hash('sha256', $bytes)])->save();
            // A persisted owner is required by native Media admission; its byte identity
            // is initialized exactly once before this enclosing transaction commits.
            $media = $this->media->upload($asset, 'retained_asset', $bytes, $filename, $mime);
            $asset->fill(['media_id' => $media->id, 'media_revision' => $media->revision])->save();

            return $asset;
        });
    }

    private function byteLimit(): int
    {
        $limit = config('nvl-templates.storage.max_bytes');
        if (! is_int($limit) || $limit < 1) {
            throw new \LogicException('Configure a positive integer asset byte limit.');
        }

        return $limit;
    }

    /** @return list<string> */
    private function allowedHosts(): array
    {
        $configured = config('nvl-templates.imports.allowed_hosts', []);
        if (! is_array($configured) || ! array_is_list($configured)) {
            throw new \LogicException('Configure URL import hosts as a list of hostnames.');
        }
        $hosts = [];
        foreach ($configured as $host) {
            if (! is_string($host) || $host === '') {
                throw new \LogicException('Configure URL import hosts as nonempty hostnames.');
            }
            $hosts[] = strtolower($host);
        }

        return $hosts;
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['asset' => [$message]]);
    }
}
