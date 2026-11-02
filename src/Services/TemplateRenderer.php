<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Rendering\EmailProfile;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\JsonWire;
use Nvl\Templates\Support\Pdf;
use Nvl\Templates\Support\PreviewPayload;
use Nvl\Templates\ValueObjects\PdfOutput;

/**
 * Native document operations.
 *
 * @api
 */
final class TemplateRenderer
{
    public function __construct(
        private readonly TemplateOperation $operation,
        private readonly DocumentResolver $documents,
        private readonly DocumentValidator $validator,
        private readonly ResourceManager $resources,
        private readonly RenderPipeline $pipeline,
        private readonly RuntimeDataResolver $runtime,
        private readonly AssetManager $assets,
        private readonly EmailProfile $email,
    ) {}

    /** Render an authorized immutable publication without delivery.
     * @param  array{facts?: array<array-key,mixed>, context?: array<array-key,mixed>, inputs?: array<array-key,mixed>, settings?: array<array-key,mixed>}  $data
     * @return array{html: string, css: string, subject: ?string, text: ?string, revisionId: string, checksum: string, inlineAssets: list<array{cid: string, name: string, mimeType: string, content: string}>}
     */
    public function render(string $revisionId, array $data, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($revisionId, $data) {
            DocumentInputs::runtime($data);
            $facts = $data['facts'] ?? [];
            $context = $data['context'] ?? [];
            $inputs = $data['inputs'] ?? [];
            $settings = $data['settings'] ?? [];
            $release = $this->pipeline->release($revisionId);
            $data = $this->runtime->resolve($release->document, $facts, $context, $inputs, $settings);

            return $this->pipeline->render($release->document, $data, $release->id)->toArray();
        });
    }

    /** Compile a raw authoring source against its exact family pin and current grants.
     * @param  array<array-key,mixed>  $document  Portable authoring source.
     * @param  array{facts?: array<array-key,mixed>, context?: array<array-key,mixed>, inputs?: array<array-key,mixed>, settings?: array<array-key,mixed>}  $data
     * @return array{html: string, css: string, subject: ?string, text: ?string, revisionId: string, checksum: string, inlineAssets: list<array{cid: string, name: string, mimeType: string, content: string}>}
     */
    public function preview(string $templateId, array $document, array $data, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($templateId, $document, $data) {
            DocumentInputs::runtime($data);
            $facts = $data['facts'] ?? [];
            $context = $data['context'] ?? [];
            $inputs = $data['inputs'] ?? [];
            $settings = $data['settings'] ?? [];
            Access::authorize('manage');
            $template = TemplateModelRegistry::query()->findOrFail($templateId);
            Access::authorize('manage', $template);
            [$effective] = $this->documents->effectiveDocument($template, $document);
            $this->documents->requireCompilation($document, $effective);
            $effective = $this->resources->snapshot($this->documents->authoringTemplate($template), $effective);
            $this->validator->publication($effective);
            $data = $this->runtime->resolve($effective, $facts, $context, $inputs, $settings);

            return $this->pipeline->render($effective, $data, 'preview')->toArray();
        });
    }

    /** Prepare validated browser-preview data and checked inline asset URLs.
     * @param  array{facts?: array<array-key,mixed>, context?: array<array-key,mixed>, inputs?: array<array-key,mixed>, settings?: array<array-key,mixed>}  $data
     * @return array{revisionId: string, document: array<array-key,mixed>, data: mixed, previewAssets: object}
     */
    public function prepare(string $revisionId, array $data, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($revisionId, $data) {
            DocumentInputs::runtime($data);
            $facts = $data['facts'] ?? [];
            $context = $data['context'] ?? [];
            $inputs = $data['inputs'] ?? [];
            $settings = $data['settings'] ?? [];
            $release = $this->pipeline->release($revisionId);
            $data = $this->runtime->resolve($release->document, $facts, $context, $inputs, $settings, true);
            $assets = [];
            $payload = ['revisionId' => $release->id, 'document' => JsonWire::document($release->document),
                'data' => JsonWire::value($data, DocumentInputs::map($release->document['dataSchema'] ?? null, 'dataSchema')), 'previewAssets' => (object) $assets];
            PreviewPayload::check($payload);
            foreach (DocumentInputs::map($release->document['managedAssets'] ?? [], 'managedAssets') as $id => $assetId) {
                if (! is_string($assetId)) {
                    throw ValidationException::withMessages(['managedAssets' => ['A managed asset identity must be a string.']]);
                }
                $assets[$id] = $this->assets->resolve($assetId)['url'];
                $payload['previewAssets'] = (object) $assets;
                PreviewPayload::check($payload);
            }

            return $payload;
        });
    }

    /** Render an authorized browser projection while retaining the original delivery fields.
     * @param  array<array-key,mixed>  $document
     * @param  array{facts?: array<array-key,mixed>,context?: array<array-key,mixed>,inputs?: array<array-key,mixed>,settings?: array<array-key,mixed>}  $data
     * @return array{html:string,css:string,subject:?string,text:?string,revisionId:string,checksum:string,inlineAssets:list<array{cid:string,name:string,mimeType:string,content:string}>,previewHtml:string}
     */
    public function previewForBrowser(string $templateId, array $document, array $data, bool $includeInlineAssets, Authenticatable|SystemActor $actor): array
    {
        return $this->operation->run($actor, function () use ($templateId, $document, $data, $includeInlineAssets): array {
            $output = $this->preview($templateId, $document, $data, $this->operation->actor());
            $output['previewHtml'] = $this->email->browserPreview($output['html'], $output['inlineAssets'], PreviewPayload::limit());
            if (! $includeInlineAssets) {
                $output['inlineAssets'] = [];
            }
            PreviewPayload::check($output);

            return $output;
        });
    }

    /** Render a document publication through the explicitly configured PDF driver.
     * @param  array{facts?: array<array-key,mixed>, context?: array<array-key,mixed>, inputs?: array<array-key,mixed>, settings?: array<array-key,mixed>}  $data
     * @param  array{filename?: string, expectedPages?: int, maxPages?: int}  $options
     */
    public function pdf(string $revisionId, array $data, array $options, Authenticatable|SystemActor $actor): PdfOutput
    {
        return $this->operation->run($actor, function () use ($revisionId, $data, $options) {
            DocumentInputs::runtime($data);
            $facts = $data['facts'] ?? [];
            $context = $data['context'] ?? [];
            $inputs = $data['inputs'] ?? [];
            $settings = $data['settings'] ?? [];
            $release = $this->pipeline->release($revisionId);
            if ($release->document['target'] !== 'document') {
                throw ValidationException::withMessages(['output' => ['PDF output requires a document template.']]);
            }
            $options = Pdf::options($options);

            return Pdf::driver()->render($this->pipeline->render($release->document, $this->runtime->resolve($release->document, $facts, $context, $inputs, $settings), $release->id), $release->document, $options);
        });
    }
}
