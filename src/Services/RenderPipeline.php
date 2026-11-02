<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\DocumentCompiler;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateResource;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Rendering\BindingRenderer;
use Nvl\Templates\Rendering\EmailProfile;
use Nvl\Templates\Rendering\RenderedDocument;
use Nvl\Templates\Rendering\RenderOutput;
use Nvl\Templates\Support\Access;
use Nvl\Templates\Support\CanonicalJson;
use Nvl\Templates\Support\Compiler;
use Nvl\Templates\Support\Scope;

/**
 *  Internal document collaborator; invoked within an admitted operation.
 *
 * @phpstan-type AssetEvidence array<string,array{identity: string, name: string}>
 * @phpstan-type PreparedRender array{scope: string, revisionId: string, document: array<array-key,mixed>, data: array<array-key,mixed>, documentChecksum: string, rendererIdentity: string, assets: AssetEvidence}
 *
 * @internal
 */
final class RenderPipeline
{
    /** @param array<array-key,mixed> $facts
     * @param  array<array-key,mixed>  $context
     * @param  array<array-key,mixed>  $inputs
     * @param  array<array-key,mixed>  $settings
     * @return PreparedRender
     */
    public function prepare(string $revisionId, array $facts = [], array $context = [], array $inputs = [], array $settings = []): array
    {
        $release = $this->release($revisionId);
        $document = $release->document;
        $data = DocumentInputs::map(app(RuntimeDataResolver::class)->resolve($document, $facts, $context, $inputs, $settings), 'data');
        $candidates = array_values(DocumentInputs::map($document['managedAssets'] ?? [], 'managedAssets'));
        $artifact = DocumentInputs::map($document['artifacts'] ?? null, 'artifacts');
        foreach (DocumentInputs::maps($artifact['bindings'] ?? [], 'artifacts.bindings') as $binding) {
            if (($binding['kind'] ?? null) === 'image') {
                $candidates[] = Arr::get($data, DocumentInputs::text($binding['path'] ?? null, 'binding.path'));
            }
        }
        $ids = [];
        foreach ($candidates as $candidate) {
            $ids[] = DocumentInputs::text($candidate, 'managedAssets.identity');
        }
        $assets = [];
        foreach (array_unique($ids) as $id) {
            [$asset] = app(AssetManager::class)->contents($id);
            $assets[$id] = ['identity' => $this->assetIdentity($asset), 'name' => $asset->name];
        }

        return ['scope' => Scope::current(), 'revisionId' => $release->id, 'document' => $document, 'data' => $data,
            'documentChecksum' => CanonicalJson::hash($document), 'rendererIdentity' => $this->identity($document), 'assets' => $assets];
    }

    /** @param array<array-key,mixed> $prepared */
    public function renderPrepared(array $prepared): RenderedDocument
    {
        $prepared = $this->validatePrepared($prepared);
        if (($prepared['scope'] ?? null) !== Scope::current()) {
            throw new AuthorizationException('The accepted render scope is not active.');
        }
        $release = $this->release($prepared['revisionId']);
        if (! hash_equals(CanonicalJson::hash($release->document), $prepared['documentChecksum']) || ! hash_equals($this->identity($release->document), $prepared['rendererIdentity'])) {
            throw ValidationException::withMessages(['render' => ['The accepted renderer or published document changed.']]);
        }
        $this->validateAssets($prepared['assets']);
        app(SchemaValidator::class)->validate($prepared['data'], DocumentInputs::map($prepared['document']['dataSchema'] ?? null, 'dataSchema'));

        $names = [];
        foreach ($prepared['assets'] as $id => $evidence) {
            $names['template-'.$id.'@assets'] = $evidence['name'];
        }

        return $this->render($prepared['document'], $prepared['data'], $prepared['revisionId'], $names);
    }

    /** Recheck current grants, bytes and accepted identity before execution or retained output reads.
     * @param  AssetEvidence  $assets
     */
    public function validateAssets(array $assets): void
    {
        foreach ($assets as $id => $identity) {
            [$asset] = app(AssetManager::class)->contents($id);
            if (! hash_equals($identity['identity'], $this->assetIdentity($asset))) {
                throw ValidationException::withMessages(['assets' => ['An accepted image identity changed.']]);
            }
        }
    }

    /** Validate the stored preparation envelope before executing or reading it.
     * @param  array<array-key,mixed>  $prepared
     * @return PreparedRender
     */
    public function validatePrepared(array $prepared): array
    {
        $scope = $prepared['scope'] ?? null;
        $revision = $prepared['revisionId'] ?? null;
        $checksum = $prepared['documentChecksum'] ?? null;
        $renderer = $prepared['rendererIdentity'] ?? null;
        if (! is_string($scope) || ! is_string($revision) || ! is_string($checksum) || ! is_string($renderer)) {
            throw ValidationException::withMessages(['render' => ['Invalid accepted render identity.']]);
        }
        $assets = [];
        foreach (DocumentInputs::map($prepared['assets'] ?? null, 'assets') as $id => $asset) {
            if (! is_array($asset) || ! is_string($asset['identity'] ?? null) || ! is_string($asset['name'] ?? null)) {
                throw ValidationException::withMessages(['assets' => ['Invalid accepted asset identity.']]);
            }
            if (! is_string($id)) {
                throw ValidationException::withMessages(['assets' => ['A retained asset requires a string identity.']]);
            }
            $assets[$id] = ['identity' => $asset['identity'], 'name' => $asset['name']];
        }

        return ['scope' => $scope, 'revisionId' => $revision, 'document' => DocumentInputs::map($prepared['document'] ?? null, 'document'),
            'data' => DocumentInputs::map($prepared['data'] ?? null, 'data'), 'documentChecksum' => $checksum,
            'rendererIdentity' => $renderer, 'assets' => $assets];
    }

    private function assetIdentity(TemplateAsset $asset): string
    {
        return CanonicalJson::hash($asset->only(['id', 'media_id', 'media_revision', 'mime_type', 'size', 'checksum']));
    }

    /** @param array<array-key,mixed> $document */
    private function identity(array $document): string
    {
        $artifact = DocumentInputs::map($document['artifacts'] ?? null, 'artifacts');
        $engine = $artifact['engine'] ?? 'bindings';
        $compiler = $engine === 'shared' ? config('nvl-templates.compiler.identity') : null;
        if ($engine === 'shared' && (! is_string($compiler) || trim($compiler) === '' || Compiler::configured() === null)) {
            throw ValidationException::withMessages(['compiler' => ['Durable shared renders require a configured compiler and immutable compiler.identity build tag.']]);
        }
        $files = glob(dirname(__DIR__).'/Rendering/*.php');
        if ($files === false) {
            throw new \LogicException('The bundled renderer identity files are unavailable.');
        }
        sort($files);
        $hashes = [];
        foreach ($files as $file) {
            $hashes[basename($file)] = hash_file('sha256', $file);
        }

        return CanonicalJson::hash(['engine' => $engine, 'module' => $hashes, 'compiler' => $compiler,
            'driver' => $engine === 'shared' ? config('nvl-templates.compiler.driver') : null]);
    }

    public function release(string $revisionId, string $ability = 'render'): TemplateRevision
    {
        $release = TemplateRevision::query()->findOrFail($revisionId);
        Access::authorize($ability, $release);
        if (TemplateModelRegistry::query()->findOrFail($release->template_id)->status === 'revoked') {
            throw ValidationException::withMessages(['template' => ['This template has been revoked.']]);
        }
        foreach ($release->dependencies ?? [] as $pin) {
            $pin = DocumentInputs::map($pin, 'dependencies');
            $resource = TemplateResource::query()->findOrFail(DocumentInputs::text($pin['resourceId'] ?? null, 'dependencies.resourceId'));
            Access::authorize($ability, $resource);
            if ($resource->status === 'revoked') {
                throw ValidationException::withMessages(['resources' => ['A pinned resource has been revoked.']]);
            }
        }

        return $release;
    }

    /** @param array<array-key,mixed> $document
     * @param  array<array-key,mixed>  $data
     * @param  array<string,string>  $assetNames
     */
    public function render(array $document, array $data, string $revisionId, array $assetNames = []): RenderedDocument
    {
        $artifact = DocumentInputs::map($document['artifacts'] ?? null, 'artifacts');
        if (($artifact['engine'] ?? 'bindings') === 'shared') {
            $driver = Compiler::configured();
            if (! $driver instanceof DocumentCompiler) {
                throw ValidationException::withMessages(['compiler' => ['Configure a DocumentCompiler implementation.']]);
            }
            $assets = [];
            $attachments = [];
            $source = DocumentInputs::map($document['source'] ?? null, 'source');
            $definition = DocumentInputs::map($source['definition'] ?? null, 'source.definition');
            $managed = DocumentInputs::map($document['managedAssets'] ?? [], 'managedAssets');
            $target = DocumentInputs::text($document['target'] ?? null, 'target');
            foreach (DocumentInputs::maps($definition['assets'] ?? [], 'source.definition.assets') as $asset) {
                $assetId = DocumentInputs::text($asset['id'] ?? null, 'asset.id');
                $managedId = $managed[$assetId] ?? null;
                if (! is_string($managedId)) {
                    throw ValidationException::withMessages(['assets' => ['Every compiler asset needs a retained managed asset mapping.']]);
                }
                $resolved = app(AssetManager::class)->resolve($managedId, $target, embedEmail: false);
                $assets[$assetId] = $resolved['url'];
                if ($target === 'email') {
                    $attachments['template-'.$resolved['id'].'@assets'] = $resolved['id'];
                }
            }
            $output = $driver->compile($document, $data, $assets);
            if (! is_string($output['html'] ?? null) || trim($output['html']) === '' || ! is_string($output['css'] ?? null) || strlen($output['html'].$output['css']) > config('nvl-templates.limits.output_bytes')) {
                throw ValidationException::withMessages(['compiler' => ['The compiler returned an invalid or oversized result.']]);
            }
            $html = $output['html'];
            $css = $output['css'];
            $subject = $output['subject'] ?? null;
            $text = $output['text'] ?? null;
            if (($subject !== null && ! is_string($subject)) || ($text !== null && ! is_string($text))) {
                throw ValidationException::withMessages(['compiler' => ['Compiler sidecars must be strings or null.']]);
            }
            if ($target === 'email') {
                $finalized = app(EmailProfile::class)->finalize($html, $css);
                $html = $finalized['html'];
                $css = $finalized['css'];
                if (strlen($html) > config('nvl-templates.limits.output_bytes')) {
                    throw ValidationException::withMessages(['compiler' => ['Finalized email exceeds the byte limit.']]);
                }
            }

            return app(RenderOutput::class)->finalize(new RenderedDocument($html, $css, $subject, $text, $revisionId, hash('sha256', $html."\n".$css)), $attachments, $assetNames);
        }

        return app(BindingRenderer::class)->render($document, $data, $revisionId, $assetNames);
    }
}
