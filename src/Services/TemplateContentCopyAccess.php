<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Database\Eloquent\Model;
use Nvl\Content\Contracts\ContentCatalogCopyAccess;
use Nvl\Templates\Ownership\TemplateCatalogSource;

/**
 * Applies either authority’s exact catalog capability before exposing immutable Content.
 *
 * @internal
 */
final readonly class TemplateContentCopyAccess implements ContentCatalogCopyAccess
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(private TemplateCatalogSource $native) {}

    /** Resolve the current grant-authorized canonical central Content owner. */
    public function canonicalSource(string $ownerId, string $group, string $grantId, bool $lock = false): Model
    {
        return $this->native->granted($ownerId, $group, $grantId, $lock);
    }

    /** Validate the exact legacy recipient grant before exposing its Content source. */
}
