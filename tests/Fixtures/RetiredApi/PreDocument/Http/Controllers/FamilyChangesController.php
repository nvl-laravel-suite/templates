<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Nvl\Templates\Services\FamilyLifecycle;

final class FamilyChangesController
{
    public function __construct(private FamilyLifecycle $lifecycle) {}

    public function index(string $template): JsonResponse
    {
        return response()->json(['data' => $this->lifecycle->listing($template)]);
    }

    public function show(string $template, string $candidate): JsonResponse
    {
        return response()->json(['data' => $this->lifecycle->get($template, $candidate)]);
    }

    public function create(Request $request, string $template): JsonResponse
    {
        $d = $request->validate(['operation' => 'required|in:upgrade,rebase,detach,regroup', 'target' => 'nullable|array', 'target.groupId' => 'required_unless:operation,detach|string', 'target.revision' => 'required_unless:operation,detach|integer|min:1', 'expectedVersion' => 'required|integer|min:0', 'sourceChecksum' => 'required|string|size:64']);

        return response()->json(['data' => $this->lifecycle->prepare($template, $d['operation'], $d['target'] ?? null, $d['expectedVersion'], $d['sourceChecksum'])], 201);
    }

    public function apply(Request $request, string $template, string $candidate): JsonResponse
    {
        $d = $request->validate(['resolutions' => 'sometimes|array', 'resolutions.*' => 'in:local,family', 'expectedVersion' => 'required|integer|min:0', 'sourceChecksum' => 'required|string|size:64']);

        return response()->json(['data' => $this->lifecycle->apply($template, $candidate, $d['resolutions'] ?? [], $d['expectedVersion'], $d['sourceChecksum'])]);
    }

    public function review(Request $request, string $template, string $candidate): JsonResponse
    {
        $d = $request->validate(['resolutions' => 'sometimes|array', 'resolutions.*' => 'in:local,family', 'expectedVersion' => 'required|integer|min:0', 'sourceChecksum' => 'required|string|size:64']);

        return response()->json(['data' => $this->lifecycle->review($template, $candidate, $d['resolutions'] ?? [], $d['expectedVersion'], $d['sourceChecksum'])]);
    }
}
