<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\Support\TemplatesConfiguration;
use Nvl\Templates\Tests\Fixtures\Compatibility\Services\TemplateResponseFactory;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\TemplateActorFactory;
use Nvl\Templates\Tests\Fixtures\Data\Mutations\RenderTemplateData;
use Nvl\Templates\Tests\Fixtures\Data\TemplateRenderData;

/**
 * Opt-in synchronous and asynchronous render endpoints.
 */
final class TemplateRenderController extends Controller
{
    /**
     * List authorized durable render history.
     */
    public function index(
        Request $request,
        TemplateActorFactory $actors,
        TemplateReader $action,
    ): JsonResponse {
        $query = [];

        foreach ($request->query() as $key => $value) {
            if (is_string($key)) {
                $query[$key] = $value;
            }
        }

        $renders = $action->renders(
            array_intersect_key($query, array_flip(['status', 'template', 'sort', 'page'])),
            $actors->fromRequest($request),
            $request->integer(
                'per_page',
                TemplatesConfiguration::limit('per_page', 25),
            ),
        );

        return $this->protectedJson([
            'data' => array_map(
                static fn (TemplateRender $render): array => TemplateRenderData::fromModel(
                    $render,
                )->toArray(),
                $renders->items(),
            ),
            'meta' => [
                'current_page' => $renders->currentPage(),
                'last_page' => $renders->lastPage(),
                'per_page' => $renders->perPage(),
                'total' => $renders->total(),
            ],
        ]);
    }

    /**
     * Show one authorized durable render status.
     */
    public function show(
        Request $request,
        TemplateRender $render,
        TemplateActorFactory $actors,
        TemplateReader $action,
    ): JsonResponse {
        return $this->protectedJson([
            'data' => TemplateRenderData::fromModel(
                $action->getRender($render, $actors->fromRequest($request)),
            )->toArray(),
        ]);
    }

    /**
     * Render one stored template synchronously.
     */
    public function render(
        Request $request,
        string $template,
        TemplateRenderer $action,
        TemplateActorFactory $actors,
        TemplateResponseFactory $responses,
    ): Response {
        $data = RenderTemplateData::validateAndCreate($request->all());
        $result = $action->render(
            $template,
            $data->payload,
            $data->toArray(),
            $actors->fromRequest($request),
        );

        return $data->download
            ? $responses->download($result)
            : $responses->inline($result);
    }

    /**
     * Queue one preflighted durable render.
     */
    public function queue(
        Request $request,
        string $template,
        TemplateRenderer $action,
        TemplateActorFactory $actors,
    ): JsonResponse {
        $render = $action->queue(
            $template,
            RenderTemplateData::validateAndCreate($request->all())->toArray(),
            $actors->fromRequest($request),
        );

        return $this->protectedJson([
            'data' => [
                'id' => $render->id,
                'status' => $render->status->value,
            ],
        ], 202);
    }

    /**
     * Return private render metadata without permitting intermediary storage.
     *
     * @param  array<string, mixed>  $payload
     */
    private function protectedJson(array $payload, int $status = 200): JsonResponse
    {
        $response = response()->json($payload, $status);
        $response->headers->set(
            'Cache-Control',
            'private, no-store, no-cache, must-revalidate',
        );
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }
}
