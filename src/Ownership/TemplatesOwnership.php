<?php

declare(strict_types=1);

namespace Nvl\Templates\Ownership;

use Illuminate\Database\Eloquent\Model;
use Nvl\Support\Ownership\Compatibility\LegacyOwnershipSupport;
use Nvl\Support\Ownership\Contracts\OwnershipContext;
use Nvl\Support\Ownership\Enums\OwnershipContextMode;
use Nvl\Support\Ownership\Services\OwnershipResourceRegistry;
use Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope;
use Nvl\Support\Ownership\ValueObjects\OwnershipSnapshot;

/**
 * Resolves canonical metadata without retaining request admission.
 *
 * @internal
 */
final class TemplatesOwnership
{
    /** Determine whether this package graph declares native primary ownership. */
    public static function declared(): bool
    {
        return (app(OwnershipResourceRegistry::class)->all()['templates.templates'] ?? null)?->ownership->strategy !== null && app(OwnershipResourceRegistry::class)->get('templates.templates')->ownership->strategy !== 'unscoped';
    }

    /** Determine whether native or legacy ownership enforcement applies. */
    public static function active(): bool
    {
        return self::declared() || app(LegacyOwnershipSupport::class)->enabled();
    }

    /** Resolve the exact canonical model to its declared ownership resource. */
    public static function resource(Model $model): string
    {
        return self::declared() ? app(OwnershipResourceRegistry::class)->forModel($model)->key : app(LegacyOwnershipSupport::class)->resource($model);
    }

    /** Capture scalar admission; untouched graphs preserve disabled installation behavior. */
    public static function envelope(): OwnershipJobEnvelope
    {
        $context = app(OwnershipContext::class);
        if ($context->snapshot()->mode === OwnershipContextMode::Unresolved) {
            foreach (app(OwnershipResourceRegistry::class)->all() as $resource) {
                if ($resource->ownership->strategy !== 'unscoped') {
                    return OwnershipJobEnvelope::capture($context);
                }
            }

            return OwnershipJobEnvelope::fromSnapshot(new OwnershipSnapshot(OwnershipContextMode::Disabled));
        }

        return OwnershipJobEnvelope::capture($context);
    }

    private function __construct() {}
}
