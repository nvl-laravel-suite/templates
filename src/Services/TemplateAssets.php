<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\UploadedFile;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Models\TemplateAsset;

/**
 * Complete document asset operations with explicit actor admission.
 *
 * @api
 */
final readonly class TemplateAssets
{
    public function __construct(private TemplateOperation $operation, private AssetManager $assets) {}

    public function upload(UploadedFile $file, Authenticatable|SystemActor $actor): TemplateAsset
    {
        return $this->operation->run($actor, fn () => $this->assets->upload($file));
    }

    public function fromStorage(string $source, string $key, string $name, Authenticatable|SystemActor $actor): TemplateAsset
    {
        return $this->operation->run($actor, fn () => $this->assets->fromStorage($source, $key, $name));
    }

    public function fromUrl(string $url, string $name, Authenticatable|SystemActor $actor): TemplateAsset
    {
        return $this->operation->run($actor, fn () => $this->assets->fromUrl($url, $name));
    }

    /** @return array{0:TemplateAsset,1:string} Authorized immutable identity and original bytes. */
    public function contents(string $id, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, fn () => $this->assets->contents($id));
    }

    /** @return array{id:string,checksum:string,mimeType:string,url:string,attachment:?array{cid:string,name:string,mimeType:string,content:string}} */
    public function resolve(string $id, string $target, bool $embedEmail, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, fn () => $this->assets->resolve($id, $target, $embedEmail));
    }
}
