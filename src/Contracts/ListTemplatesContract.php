<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Nvl\Filterable\Data\FilterSet;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Models\Template;

/**
 * Defines the consumer-facing ListTemplatesAction workflow.
 *
 * @api
 */
interface ListTemplatesContract
{
    /**
     * Return one configured and deterministically sorted template page.
     *
     * @return LengthAwarePaginator<int, Template>
     */
    public function execute(
        FilterSet $filterSet,
        TemplateActorData $actor,
        ?int $perPage = null,
    ): LengthAwarePaginator;
}
