<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

/**
 * Host compiler adapter for the portable document format; no delivery.
 *
 * @api
 */
interface DocumentCompiler
{
    /** Return complete HTML/CSS; assets are pre-resolved canonical-asset-ID => URI. */
    /** @param array<array-key,mixed> $document
     * @param  array<array-key,mixed>  $data
     * @param  array<array-key,string>  $assets
     * @return array{html:string,css:string,subject?:string|null,text?:string|null}
     */
    public function compile(array $document, array $data, array $assets = []): array;
}
