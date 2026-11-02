<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Models\TemplateGroupRevision;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\Capabilities;

/**
 * Native metadata catalogs with explicit actor admission and bounded pagination.
 *
 * Catalog Read admission includes scoped pagination metadata. Per-record Read
 * filtering can shorten pages; totals describe the scoped query before that
 * filtering, not a policy-specific count. Hosts own projections and delivery URLs.
 * Asset metadata never grants byte access; use TemplateAssets::contents for that.
 *
 * @api
 */
final readonly class TemplateCatalog
{
    private const int MAX_PAGE = 1000000;

    public function __construct(private TemplateOperation $operation) {}

    /**
     * @param  array<array-key,mixed>  $query  Only integer page (1..1000000) and per_page (1..100); defaults 1/25.
     * @return LengthAwarePaginator<int,Template> Exact configured Template models.
     */
    public function templates(array $query, Authenticatable|SystemActor $actor): LengthAwarePaginator
    {
        return $this->operation->run($actor, function () use ($query): LengthAwarePaginator {
            Access::authorize('read');
            $controls = $this->controls($query);

            return $this->page(TemplateModelRegistry::query()->orderBy('name')->orderBy('id'), $controls);
        });
    }

    /**
     * @param  array<array-key,mixed>  $query  Only integer page (1..1000000) and per_page (1..100); defaults 1/25.
     * @return LengthAwarePaginator<int,TemplateGroup>
     */
    public function groups(array $query, Authenticatable|SystemActor $actor): LengthAwarePaginator
    {
        return $this->operation->run($actor, function () use ($query): LengthAwarePaginator {
            Access::authorize('read');
            $controls = $this->controls($query);

            return $this->page(TemplateGroup::query()->orderBy('name')->orderBy('id'), $controls);
        });
    }

    /**
     * @param  array<array-key,mixed>  $query  Integer page/per_page (defaults 1/30), optionally target 'email' or 'document'.
     * @return LengthAwarePaginator<int,TemplateAsset> Retained metadata only; no bytes or asset URLs are resolved.
     */
    public function assets(array $query, Authenticatable|SystemActor $actor): LengthAwarePaginator
    {
        return $this->operation->run($actor, function () use ($query): LengthAwarePaginator {
            Access::authorize('read');
            $controls = $this->controls($query, assets: true);
            $builder = TemplateAsset::query()->whereNull('archived_at')
                ->whereNotNull('media_id')->where('media_id', '!=', '')
                ->whereNotNull('media_revision')->where('media_revision', '>', 0)
                ->where('size', '>', 0)->where('checksum', '!=', '');
            $types = Capabilities::assetTypesByTarget();
            $builder->whereIn('mime_type', $types[$controls['target'] ?? 'document']);

            return $this->page($builder->orderByDesc('created_at')->orderByDesc('id'), $controls);
        });
    }

    /** Read an exact published family revision after authorizing its current family, revision and materialized dependencies. */
    public function groupRevision(string $groupId, int $revision, Authenticatable|SystemActor $actor): TemplateGroupRevision
    {
        return $this->operation->run($actor, function () use ($groupId, $revision): TemplateGroupRevision {
            Access::authorize('read');
            if ($revision < 1) {
                throw ValidationException::withMessages(['revision' => ['Use a positive published family revision.']]);
            }
            $group = TemplateGroup::query()->findOrFail($groupId);
            Access::authorize('read', $group);
            $release = TemplateGroupRevision::query()->where('group_id', $group->id)->where('revision', $revision)->firstOrFail();
            Access::authorize('read', $release);
            $dependencies = $release->document['dependencies'] ?? [];
            if (! is_array($dependencies) || ! array_is_list($dependencies)) {
                throw ValidationException::withMessages(['dependencies' => ['A dependency list is required.']]);
            }
            foreach ($dependencies as $pin) {
                if (! is_array($pin) || ! is_string($pin['resourceId'] ?? null) || $pin['resourceId'] === '') {
                    throw ValidationException::withMessages(['dependencies' => ['A pinned resource identity is required.']]);
                }
                Access::authorize('read', TemplateResource::query()->findOrFail($pin['resourceId']));
            }

            return $release;
        });
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $builder
     * @param  array{page:int,per_page:int,target:'email'|'document'|null}  $controls
     * @return LengthAwarePaginator<int,TModel>
     */
    private function page(Builder $builder, array $controls): LengthAwarePaginator
    {
        $page = $builder->paginate($controls['per_page'], ['*'], 'page', $controls['page']);
        $readable = array_values(array_filter($page->items(), static fn ($record): bool => Access::allows('read', $record)));
        $page->setCollection(new Collection($readable));

        return $page;
    }

    /**
     * @param  array<array-key,mixed>  $query
     * @return array{page:int,per_page:int,target:'email'|'document'|null}
     */
    private function controls(array $query, bool $assets = false): array
    {
        if (array_diff(array_keys($query), $assets ? ['page', 'per_page', 'target'] : ['page', 'per_page']) !== []) {
            throw ValidationException::withMessages(['query' => ['Unsupported catalog query controls.']]);
        }
        $page = array_key_exists('page', $query) ? $query['page'] : 1;
        $perPage = array_key_exists('per_page', $query) ? $query['per_page'] : ($assets ? 30 : 25);
        if (! is_int($page) || $page < 1 || $page > self::MAX_PAGE) {
            throw ValidationException::withMessages(['page' => ['Use an integer page from 1 to 1000000.']]);
        }
        if (! is_int($perPage) || $perPage < 1 || $perPage > 100) {
            throw ValidationException::withMessages(['per_page' => ['Use an integer per_page from 1 to 100.']]);
        }
        $target = null;
        if (array_key_exists('target', $query)) {
            $target = $query['target'];
            if (! in_array($target, ['email', 'document'], true)) {
                throw ValidationException::withMessages(['target' => ['Use the email or document asset target.']]);
            }
        }

        return ['page' => $page, 'per_page' => $perPage, 'target' => $target];
    }
}
