<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Services\AssetManager;
use Nvl\Templates\Services\DocumentInputs;
use Nvl\Templates\Services\LinkResolver;

/**
 * @phpstan-import-type Binding from BindingManifestValidator
 *
 * @internal
 */
final class BindingRenderer
{
    public function __construct(private BindingManifestValidator $validator, private LinkResolver $links) {}

    /** @param array<array-key,mixed> $document
     * @param  array<array-key,mixed>  $data
     * @param  array<string,string>  $assetNames
     */
    public function render(array $document, array $data, string $revisionId, array $assetNames = []): RenderedDocument
    {
        $artifact = $this->validator->prepare(DocumentInputs::map($document['artifacts'] ?? null, 'artifacts'));
        $target = $document['target'] ?? null;
        if (! is_string($target) || ! in_array($target, ['document', 'email'], true)) {
            throw ValidationException::withMessages(['target' => ['Invalid output target.']]);
        }
        $htmlValues = [];
        $plainValues = [];
        $inlineAssets = [];
        foreach ($artifact['bindings'] as $binding) {
            $token = '{{'.$binding['id'].'}}';
            if (! Arr::has($data, $binding['path']) && (
                $binding['kind'] !== 'text'
                || ! str_contains($artifact['html'], $token)
                || str_contains($artifact['subject'] ?? '', $token)
                || str_contains($artifact['text'] ?? '', $token)
            )) {
                throw ValidationException::withMessages([$binding['path'] => ['A required runtime binding is missing.']]);
            }
            $value = Arr::get($data, $binding['path']);
            if (! is_scalar($value) && $value !== null) {
                throw ValidationException::withMessages([$binding['path'] => ['A binding must resolve to a scalar.']]);
            }
            $value = is_bool($value) ? ($value ? 'true' : 'false') : (string) $value;
            if ($binding['kind'] === 'link') {
                $value = $this->links->resolve($value);
            }
            if ($binding['kind'] === 'image') {
                $asset = app(AssetManager::class)->resolve($value, $target, embedEmail: false);
                $value = $asset['url'];
                if ($target === 'email') {
                    $inlineAssets['template-'.$asset['id'].'@assets'] = $asset['id'];
                }
            }
            if ($binding['kind'] === 'style') {
                $value = $this->style($binding, $value);
            }
            $htmlValues[$token] = htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $plainValues[$token] = $value;
        }
        $html = strtr($artifact['html'], $htmlValues);
        $css = strtr($artifact['css'] ?? '', $htmlValues);
        if ($target === 'email') {
            ['html' => $html, 'css' => $css] = app(EmailProfile::class)->finalize($html, $css);
        }
        $subject = isset($artifact['subject']) ? strtr($artifact['subject'], $plainValues) : null;
        if ($subject !== null && (preg_match('/[\r\n]/', $subject) || mb_strlen($subject) > 998)) {
            throw ValidationException::withMessages(['subject' => ['Subject must be one bounded line.']]);
        }
        if (strlen($html.$css) > config('nvl-templates.limits.output_bytes')) {
            throw ValidationException::withMessages(['output' => ['Rendered output exceeds the byte limit.']]);
        }

        return app(RenderOutput::class)->finalize(new RenderedDocument($html, $css, $subject, isset($artifact['text']) ? strtr($artifact['text'], $plainValues) : null, $revisionId, hash('sha256', $html."\n".$css)), $inlineAssets, $assetNames);
    }

    /** @param Binding $binding */
    private function style(array $binding, string $value): string
    {
        return PresentationStyle::format($binding['property'], $value, $binding['unit'] ?? '');
    }
}
