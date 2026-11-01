<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateAssignments;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Support\TemplatesConfiguration;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\TemplateActorFactory;
use Nvl\Templates\Tests\Fixtures\Data\Mutations\AssignTemplateData;
use Nvl\Templates\Tests\Fixtures\Data\Mutations\CreateTemplateData;
use Nvl\Templates\Tests\Fixtures\Data\Mutations\CreateTemplateVersionData;
use Nvl\Templates\Tests\Fixtures\Data\Mutations\ExpectedRevisionData;
use Nvl\Templates\Tests\Fixtures\Data\Mutations\UpdateTemplateData;
use Nvl\Templates\Tests\Fixtures\Data\Mutations\UpdateTemplateVersionData;
use Nvl\Templates\Tests\Fixtures\Data\TemplateAssignmentData;
use Nvl\Templates\Tests\Fixtures\Data\TemplateManagementData;
use Nvl\Templates\Tests\Fixtures\Data\TemplateVersionData;

/**
 * Thin opt-in management endpoints for templates and publication versions.
 */
final class TemplatesController extends Controller
{
    /**
     * List one allowlisted page of authorized templates.
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
        $templates = $action->paginate(
            array_intersect_key($query, array_flip(['status', 'renderer', 'sort', 'page'])),
            $actors->fromRequest($request),
            $request->integer(
                'per_page',
                TemplatesConfiguration::limit('per_page', 25),
            ),
        );

        return response()->json([
            'data' => array_map(
                static fn (Template $template): array => TemplateManagementData::fromModel(
                    $template,
                )->toArray(),
                $templates->items(),
            ),
            'meta' => [
                'current_page' => $templates->currentPage(),
                'last_page' => $templates->lastPage(),
                'per_page' => $templates->perPage(),
                'total' => $templates->total(),
            ],
        ]);
    }

    public function store(
        Request $request,
        TemplateLifecycle $action,
        TemplateActorFactory $actors,
    ): JsonResponse {
        $template = $action->create(
            CreateTemplateData::validateAndCreate($request->all())->toArray(),
            $actors->fromRequest($request),
        );

        return response()->json([
            'data' => TemplateManagementData::fromModel($template)->toArray(),
        ], 201);
    }

    public function show(
        Request $request,
        Template $template,
        TemplateActorFactory $actors,
        TemplateReader $action,
    ): JsonResponse {
        return response()->json([
            'data' => TemplateManagementData::fromModel(
                $action->get($template, $actors->fromRequest($request)),
            )->toArray(),
        ]);
    }

    public function update(
        Request $request,
        Template $template,
        TemplateActorFactory $actors,
        TemplateLifecycle $action,
    ): JsonResponse {
        $data = UpdateTemplateData::validateAndCreate($request->all());
        $template = $action->update(
            $template,
            ['expected_revision' => $data->expectedRevision, 'status' => $data->status, 'metadata' => $data->metadata, 'translations' => $data->translations],
            $actors->fromRequest($request),
        );

        return response()->json([
            'data' => TemplateManagementData::fromModel($template)->toArray(),
        ]);
    }

    public function version(
        Request $request,
        Template $template,
        TemplateLifecycle $action,
        TemplateActorFactory $actors,
    ): JsonResponse {
        $version = $action->createVersion(
            $template,
            CreateTemplateVersionData::validateAndCreate($request->all())->toArray(),
            $actors->fromRequest($request),
        );

        return response()->json([
            'data' => TemplateVersionData::fromModel($version)->toArray(),
        ], 201);
    }

    public function publish(
        Request $request,
        TemplateVersion $version,
        TemplateLifecycle $action,
        TemplateActorFactory $actors,
    ): JsonResponse {
        $data = ExpectedRevisionData::validateAndCreate($request->all());
        $published = $action->publishVersion(
            $version,
            $data->expectedRevision,
            $actors->fromRequest($request),
        );

        return response()->json([
            'data' => TemplateVersionData::fromModel($published)->toArray(),
        ]);
    }

    public function updateVersion(
        Request $request,
        TemplateVersion $version,
        TemplateActorFactory $actors,
        TemplateLifecycle $action,
    ): JsonResponse {
        $data = UpdateTemplateVersionData::validateAndCreate($request->all());
        $version = $action->updateVersion(
            $version,
            ['expected_revision' => $data->expectedRevision, 'metadata' => $data->metadata],
            $actors->fromRequest($request),
        );

        return response()->json([
            'data' => TemplateVersionData::fromModel($version)->toArray(),
        ]);
    }

    public function assign(
        Request $request,
        Template $template,
        TemplateActorFactory $actors,
        TemplateAssignments $action,
    ): JsonResponse {
        $assignment = $action->assign(
            $template,
            AssignTemplateData::validateAndCreate($request->all())->toArray(),
            $actors->fromRequest($request),
        );

        return response()->json([
            'data' => TemplateAssignmentData::fromModel($assignment)->toArray(),
        ]);
    }

    public function unassign(
        Request $request,
        TemplateAssignment $assignment,
        TemplateActorFactory $actors,
        TemplateAssignments $action,
    ): JsonResponse {
        $data = ExpectedRevisionData::validateAndCreate($request->all());

        return response()->json([
            'data' => [
                'deleted' => $action->unassign(
                    $assignment,
                    $data->expectedRevision,
                    $actors->fromRequest($request),
                ),
            ],
        ]);
    }
}
