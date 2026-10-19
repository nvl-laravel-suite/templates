<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Nvl\Support\Ownership\Contracts\OwnershipModelPersistence;
use Nvl\Support\Ownership\Contracts\OwnershipWriter;
use Nvl\Templates\Ownership\TemplateGraphOwnership;
use Nvl\Templates\Ownership\TemplatesOwnership;

/**
 * Holds source admission across native child creation, events and secondary graph checks.
 *
 * @internal
 */
final readonly class TemplateChildWriter
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private OwnershipWriter $writer,
        private OwnershipModelPersistence $persistence,
        private TemplateGraphOwnership $graph,
    ) {}

    /** @param Closure():bool $persist */
    public function save(Model $model, Closure $persist): bool
    {
        if (! $model->exists && TemplatesOwnership::declared() && ! array_key_exists('owner_scope_key', $model->getAttributes())) {
            $saved = false;
            $this->writer->create($model::class, function (array $attributes) use ($model, $persist, &$saved): Model {
                $model->forceFill($attributes);
                $saved = $this->guarded($model, $persist);

                return $model;
            });

            return $saved;
        }

        return $this->guarded($model, $persist);
    }

    /** @param Closure():bool $persist */
    private function guarded(Model $model, Closure $persist): bool
    {
        return $this->persistence->save($model, function () use ($model, $persist): bool {
            $this->graph->assertWrite($model);
            $saved = $persist();
            if ($saved) {
                $this->graph->assertWrite($model);
            }

            return $saved;
        });
    }
}
