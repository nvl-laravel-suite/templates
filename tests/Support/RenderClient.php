<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Support;

use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Rendering\RenderedDocument;
use Nvl\Templates\Services\RenderRequests;

/** Test-only named-argument adapter to native bounded durable requests. */
final class RenderClient
{
    public function accept(string $revisionId, array $facts = [], array $context = [], array $inputs = [], array $settings = [], string $output = 'html', array $options = [], ?string $idempotencyKey = null, ?array $owner = null, ?string $requestIdentity = null): TemplateRender
    {
        return app(RenderRequests::class)->accept($revisionId, [
            'facts' => $facts, 'context' => $context, 'inputs' => $inputs, 'settings' => $settings,
            'output' => $output, 'options' => $options, 'idempotency_key' => $idempotencyKey,
            'owner' => $owner, 'request_identity' => $requestIdentity,
        ], SystemActor::Background);
    }

    public function get(string $id): TemplateRender
    {
        return app(RenderRequests::class)->get($id, SystemActor::Background);
    }

    public function process(string $id, ?int $generation = null, ?string $token = null): TemplateRender
    {
        return app(RenderRequests::class)->process($id, $generation, $token, SystemActor::Background);
    }

    public function result(string $id): RenderedDocument
    {
        return DocumentClient::result(app(RenderRequests::class)->result($id, SystemActor::Background));
    }

    public function dispatch(string $id): TemplateRender
    {
        return app(RenderRequests::class)->dispatch($id, SystemActor::Background);
    }

    public function recover(int $limit = 100): int
    {
        return app(RenderRequests::class)->recover($limit, SystemActor::Background);
    }

    public function prune(int $limit = 100): int
    {
        return app(RenderRequests::class)->prune($limit, SystemActor::Background);
    }

    public function bytes(string $id): string
    {
        return app(RenderRequests::class)->bytes($id, SystemActor::Background);
    }
}
