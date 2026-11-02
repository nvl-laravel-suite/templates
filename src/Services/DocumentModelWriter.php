<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Nvl\Support\Ownership\Contracts\OwnershipModelPersistence;
use Nvl\Support\Ownership\Contracts\OwnershipWriter;
use Nvl\Support\Ownership\Services\OwnershipResourceRegistry;

/**
 * Assigns native captured/inherited identity before new document model persistence.
 *
 * @internal
 */
final readonly class DocumentModelWriter
{
    public function __construct(private OwnershipWriter $writer, private OwnershipModelPersistence $persistence, private OwnershipResourceRegistry $resources) {}

    /** @param Closure(): bool $persist */
    public function save(Model $model, Closure $persist): bool
    {
        $resource = $this->resources->forModel($model);
        if (! $model->exists && $resource->ownership->strategy !== 'unscoped' && ! array_key_exists('owner_scope_key', $model->getAttributes())) {
            $saved = false;
            $this->writer->create($model::class, function (array $attributes) use ($model, $persist, &$saved): Model {
                $model->forceFill($attributes);
                $saved = $this->persistence->save($model, $persist);

                return $model;
            });

            return $saved;
        }

        return $this->persistence->save($model, $persist);
    }
}
