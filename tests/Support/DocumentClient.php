<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Support;

use Illuminate\Database\Eloquent\Collection;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateGroup;
use Nvl\Templates\Models\TemplateGroupRevision;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Models\TemplateResourceRevision;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Rendering\RenderedDocument;
use Nvl\Templates\Services\DocumentResolver;
use Nvl\Templates\Services\ResourceManager;
use Nvl\Templates\Services\TemplateFamilies;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateOperation;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\ValueObjects\PdfOutput;

/** Test-only notation adapter; all behavior and transactions belong to native services.
 * No legacy runtime API is registered. Array results are projected solely for existing assertions.
 */
final class DocumentClient
{
    public function createTemplate(string $key, string $name, ?string $groupId = null): Template
    {
        return app(TemplateLifecycle::class)->create(compact('key', 'name', 'groupId'), SystemActor::Background);
    }

    public function createGroup(string $key, string $name): TemplateGroup
    {
        return app(TemplateFamilies::class)->create(compact('key', 'name'), SystemActor::Background);
    }

    public function saveDraft(string $templateId, array $document, int $expectedVersion): TemplateDraft
    {
        return app(TemplateLifecycle::class)->saveDraft($templateId, $document, $expectedVersion, SystemActor::Background);
    }

    public function publish(string $templateId, int $expectedVersion): TemplateRevision
    {
        return app(TemplateLifecycle::class)->publish($templateId, $expectedVersion, SystemActor::Background);
    }

    public function publishGroup(string $groupId, array $document, int $expectedRevision): TemplateGroupRevision
    {
        return app(TemplateFamilies::class)->publish($groupId, $document, $expectedRevision, SystemActor::Background);
    }

    public function createResource(string $key, string $name, string $kind, string $scope = 'tenant', ?string $ownerId = null): TemplateResource
    {
        return app(ResourceManager::class)->create($key, $name, $kind, $scope, $ownerId, SystemActor::Background);
    }

    public function publishResource(string $id, array $document, int $expectedRevision): TemplateResourceRevision
    {
        return app(ResourceManager::class)->publish($id, $document, $expectedRevision, SystemActor::Background);
    }

    public function resourcesFor(string $templateId, ?string $kind = null): Collection
    {
        return app(ResourceManager::class)->catalog($templateId, $kind, SystemActor::Background);
    }

    public function getTemplate(string $id): Template
    {
        return app(TemplateReader::class)->get($id, SystemActor::Background);
    }

    public function render(string $revisionId, array $facts = [], array $context = [], array $inputs = [], array $settings = []): RenderedDocument
    {
        return self::result(app(TemplateRenderer::class)->render($revisionId, compact('facts', 'context', 'inputs', 'settings'), SystemActor::Background));
    }

    public function preview(string $templateId, array $document, array $facts = [], array $context = [], array $inputs = [], array $settings = []): RenderedDocument
    {
        return self::result(app(TemplateRenderer::class)->preview($templateId, $document, compact('facts', 'context', 'inputs', 'settings'), SystemActor::Background));
    }

    public function prepare(string $revisionId, array $facts = [], array $context = [], array $inputs = [], array $settings = []): array
    {
        return app(TemplateRenderer::class)->prepare($revisionId, compact('facts', 'context', 'inputs', 'settings'), SystemActor::Background);
    }

    public function authoringTemplate(Template $template): Template
    {
        return app(TemplateOperation::class)->run(SystemActor::Background, fn () => app(DocumentResolver::class)->authoringTemplate($template));
    }

    public function prepareSource(Template $template, array $source, bool $resolveResources = true): array
    {
        return app(TemplateOperation::class)->run(SystemActor::Background, fn () => app(DocumentResolver::class)->prepareSource($template, $source, $resolveResources));
    }

    public function rawEffective(Template $template, array $source): array
    {
        return app(TemplateOperation::class)->run(SystemActor::Background, fn () => app(DocumentResolver::class)->rawEffective($template, $source));
    }

    public function pdf(string $revisionId, array $facts = [], array $context = [], array $inputs = [], array $settings = [], array $options = []): PdfOutput
    {
        return app(TemplateRenderer::class)->pdf($revisionId, compact('facts', 'context', 'inputs', 'settings'), $options, SystemActor::Background);
    }

    public function renders(): RenderClient
    {
        return app(RenderClient::class);
    }

    public static function result(array $data): RenderedDocument
    {
        return new RenderedDocument(...$data);
    }
}
