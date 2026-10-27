<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Support\TemplatesConfiguration;

/**
 * Complete native template operations.
 *
 * @api
 */
final readonly class TemplateReader
{
    public function __construct(private TemplateAuthorization $authorization, private OwnershipBoundary $boundary) {}

    /** Resolve the exact admitted template and authorize its read. */
    public function get(Template|string $template, Authenticatable|SystemActor $actor): Template
    {
        $templateId = $template instanceof Template ? $template->id : $template;
        $model = $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')
            ->with([
                'translations',
                'versions',
                'assignments',
            ])
            ->findOrFail($templateId);
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(
            TemplateAbility::View,
            $actor,
            ['template_id' => $model->id],
        );

        return $model;
    }

    /**
     * Return one configured and deterministically sorted template page.
     *
     * @param  array<string,mixed>  $criteria
     * @return LengthAwarePaginator<int, Template>
     */
    public function paginate(
        array $criteria,
        Authenticatable|SystemActor $actor,
        ?int $perPage = null,
    ): LengthAwarePaginator {
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(TemplateAbility::List, $actor);
        $query = $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')
            ->with('translations');
        $columns = ['status' => 'status', 'renderer' => 'renderer'];
        if (array_diff(array_keys($criteria), [...array_keys($columns), 'sort', 'page']) !== []) {
            throw new \InvalidArgumentException('Unknown template query criterion.');
        }
        foreach ($columns as $alias => $column) {
            if (array_key_exists($alias, $criteria)) {
                $value = $criteria[$alias];
                is_array($value) ? $query->whereIn($column, $value) : $query->where($column, $value);
            }
        }
        $sorts = ['key' => 'key', 'created' => 'created_at', 'updated' => 'updated_at', 'id' => 'id'];
        $sort = $criteria['sort'] ?? 'key';
        if (! is_string($sort) || ! isset($sorts[ltrim($sort, '-')])) {
            throw new \InvalidArgumentException('Unknown template sort.');
        }
        $query->orderBy($sorts[ltrim($sort, '-')], str_starts_with($sort, '-') ? 'desc' : 'asc')->orderBy('id');
        $perPage ??= TemplatesConfiguration::limit('per_page', 25);

        return $query->paginate(max(
            1,
            min(TemplatesConfiguration::limit('maximum_per_page', 100), $perPage),
        ), page: isset($criteria['page']) && (is_int($criteria['page']) || is_string($criteria['page'])) ? max(1, (int) $criteria['page']) : 1);
    }

    /**
     * Resolve and authorize one durable render record.
     */
    public function getRender(
        TemplateRender|string $render,
        Authenticatable|SystemActor $actor,
    ): TemplateRender {
        $renderId = $render instanceof TemplateRender ? $render->id : $render;
        $model = $this->boundary->query(TemplateRender::query(), 'templates.renders')
            ->findOrFail($renderId);
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(
            TemplateAbility::View,
            $actor,
            [
                'resource' => 'template_render',
                'render_id' => $model->id,
                'template_id' => $model->template_id,
                'requested_by_type' => $model->requested_by_type,
                'requested_by' => $model->requested_by,
            ],
        );
        $this->assertOwnership($model, $actor);

        return $model;
    }

    private function assertOwnership(
        TemplateRender $render,
        Authenticatable|SystemActor $actor,
    ): void {
        if (! ($actor instanceof SystemActor)
            && (($actor instanceof Model ? $actor->getMorphClass() : null) === null
                || TemplateContentGuard::actorId($actor) === null
                || $render->requested_by_type !== ($actor instanceof Model ? $actor->getMorphClass() : null)
                || $render->requested_by !== TemplateContentGuard::actorId($actor))) {
            throw new AuthorizationException(
                'The actor may only view its own template renders.',
            );
        }
    }

    /**
     * Return one deterministic page of durable render history.
     *
     * @param  array<string,mixed>  $criteria
     * @return LengthAwarePaginator<int, TemplateRender>
     */
    public function renders(
        array $criteria,
        Authenticatable|SystemActor $actor,
        ?int $perPage = null,
    ): LengthAwarePaginator {
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(
            TemplateAbility::View,
            $actor,
            ['resource' => 'template_render_history'],
        );
        $query = $this->boundary->query(TemplateRender::query(), 'templates.renders');

        if (! ($actor instanceof SystemActor)) {
            if (($actor instanceof Model ? $actor->getMorphClass() : null) === null || TemplateContentGuard::actorId($actor) === null) {
                throw new AuthorizationException(
                    'Template render history requires a stable actor identifier.',
                );
            }

            $query->where('requested_by_type', ($actor instanceof Model ? $actor->getMorphClass() : null))
                ->where('requested_by', TemplateContentGuard::actorId($actor));
        }

        $columns = ['status' => 'status', 'template' => 'template_id'];
        if (array_diff(array_keys($criteria), [...array_keys($columns), 'sort', 'page']) !== []) {
            throw new \InvalidArgumentException('Unknown template query criterion.');
        }
        foreach ($columns as $alias => $column) {
            if (array_key_exists($alias, $criteria)) {
                $value = $criteria[$alias];
                is_array($value) ? $query->whereIn($column, $value) : $query->where($column, $value);
            }
        }
        $sorts = ['created' => 'created_at', 'started' => 'started_at', 'completed' => 'completed_at', 'id' => 'id'];
        $sort = $criteria['sort'] ?? '-created';
        if (! is_string($sort) || ! isset($sorts[ltrim($sort, '-')])) {
            throw new \InvalidArgumentException('Unknown template sort.');
        }
        $query->orderBy($sorts[ltrim($sort, '-')], str_starts_with($sort, '-') ? 'desc' : 'asc')->orderBy('id');
        $perPage ??= TemplatesConfiguration::limit('per_page', 25);

        return $query->paginate(max(
            1,
            min(TemplatesConfiguration::limit('maximum_per_page', 100), $perPage),
        ), page: isset($criteria['page']) && (is_int($criteria['page']) || is_string($criteria['page'])) ? max(1, (int) $criteria['page']) : 1);
    }
}
