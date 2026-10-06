<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Nvl\Filterable\Data\FilterSet;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\TemplateRender;

/**
 * Defines the consumer-facing ListTemplateRendersAction workflow.
 *
 * @api
 */
interface ListTemplateRendersContract
{
    /**
     * Return one deterministic page of durable render history.
     *
     * @return LengthAwarePaginator<int, TemplateRender>
     */
    public function execute(
        FilterSet $filterSet,
        TemplateActorData $actor,
        ?int $perPage = null,
    ): LengthAwarePaginator;
}
