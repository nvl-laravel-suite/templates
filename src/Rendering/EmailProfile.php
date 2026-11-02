<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use DOMDocument;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Services\DocumentInputs;
use Symfony\Component\CssSelector\CssSelectorConverter;

/**
 * @phpstan-type EmailRules array{id: string, clients: list<string>, tags: list<string>, styles: list<string>, settings: list<string>, displays: list<string>, conditionalStyles: list<string>}
 *
 * @internal
 */
final class EmailProfile
{
    /** @var EmailRules|null */
    private static ?array $cachedRules = null;

    /** @return array{id: string, clients: list<string>, tags: list<string>, styles: list<string>, settings: list<string>, displays: list<string>, conditionalStyles: list<string>} */
    public static function rules(): array
    {
        if (self::$cachedRules !== null) {
            return self::$cachedRules;
        }
        $json = file_get_contents(__DIR__.'/../../resources/contracts/email-profile.v1.json');
        if ($json === false) {
            throw new \LogicException('The bundled email profile is unavailable.');
        }
        $data = DocumentInputs::map(json_decode($json, true, 32, JSON_THROW_ON_ERROR), 'emailProfile');

        return self::$cachedRules = ['id' => DocumentInputs::text($data['id'] ?? null, 'emailProfile.id'),
            'clients' => DocumentInputs::strings($data['clients'] ?? null, 'emailProfile.clients'),
            'tags' => DocumentInputs::strings($data['tags'] ?? null, 'emailProfile.tags'),
            'styles' => DocumentInputs::strings($data['styles'] ?? null, 'emailProfile.styles'),
            'settings' => DocumentInputs::strings($data['settings'] ?? null, 'emailProfile.settings'),
            'displays' => DocumentInputs::strings($data['displays'] ?? null, 'emailProfile.displays'),
            'conditionalStyles' => DocumentInputs::strings($data['conditionalStyles'] ?? null, 'emailProfile.conditionalStyles')];
    }

    /** @param array<array-key,mixed> $document */
    public function source(array $document): void
    {
        $source = DocumentInputs::map($document['source'] ?? null, 'source');
        $definition = DocumentInputs::map($source['definition'] ?? null, 'source.definition');
        $styles = DocumentInputs::map($definition['styles'] ?? [], 'styles');
        $this->sourceCss(DocumentInputs::text($styles['theme'] ?? '', 'styles.theme'));
        $this->sourceCss(DocumentInputs::text($styles['css'] ?? '', 'styles.css'));
        $rules = self::rules();
        $nodeGroups = [DocumentInputs::maps($definition['nodes'] ?? null, 'nodes')];
        $blocks = DocumentInputs::maps($definition['blocks'] ?? [], 'blocks');
        foreach ($blocks as $block) {
            $nodeGroups[] = DocumentInputs::maps($block['nodes'] ?? [], 'blocks.nodes');
        }
        foreach ($nodeGroups as $nodes) {
            foreach ($nodes as $node) {
                if (($node['kind'] ?? null) !== 'element') {
                    continue;
                }
                $tag = DocumentInputs::text($node['tag'] ?? null, 'node.tag');
                if (! in_array($tag, $rules['tags'], true)) {
                    $this->fail('Unsupported element '.$tag.'.');
                }
                foreach (DocumentInputs::map($node['style'] ?? [], 'node.style') as $property => $value) {
                    $property = DocumentInputs::text($property, 'node.style.property');
                    $value = DocumentInputs::text($value, 'node.style.value');
                    if (str_contains($value, '{{')) {
                        $this->fail('Source styles use typed settings, not raw tokens.');
                    }
                    $this->style($property, $value);
                }
                foreach (DocumentInputs::map($node['attributes'] ?? [], 'node.attributes') as $name => $value) {
                    $name = DocumentInputs::text($name, 'node.attribute.name');
                    if (in_array($name, ['data-email-shell', 'data-email-profile'], true)) {
                        $this->fail('Email shell markers belong to the compiler.');
                    }
                    $this->destination($name, DocumentInputs::text($value, 'node.attribute.value'), false);
                }
            }
        }
        foreach ($blocks as $block) {
            $this->sourceCss(DocumentInputs::text($block['css'] ?? '', 'block.css'));
        }
        foreach (DocumentInputs::maps($definition['assets'] ?? [], 'assets') as $asset) {
            if (($asset['kind'] ?? null) !== 'image' || ! in_array($asset['mimeType'] ?? null, ['image/png', 'image/jpeg', 'image/gif'], true)) {
                $this->fail('Use PNG, JPEG or GIF for the email baseline.');
            }
        }
        $defaults = DocumentInputs::map($document['settingsDefaults'] ?? [], 'settingsDefaults');
        foreach (DocumentInputs::maps($document['settingsSpec'] ?? [], 'settingsSpec') as $setting) {
            $id = DocumentInputs::text($setting['id'] ?? null, 'setting.id');
            $unit = DocumentInputs::text($setting['unit'] ?? '', 'setting.unit');
            foreach (DocumentInputs::maps($setting['targets'] ?? null, 'setting.targets') as $target) {
                $property = DocumentInputs::text($target['property'] ?? null, 'setting.target.property');
                if (! in_array($property, $rules['settings'], true) || ! in_array($unit, ['', 'px', '%'], true)) {
                    $this->fail('Unsupported email presentation setting '.$id.'.');
                }
                foreach ([$setting['defaultValue'] ?? null, $defaults[$id] ?? $setting['defaultValue'] ?? null] as $value) {
                    $this->style($property, PresentationStyle::format($property, $value, $unit));
                }
            }
        }
    }

    public function artifact(string $html, string $css = ''): void
    {
        $this->css($css);
        $dom = $this->dom($html);
        foreach ($dom->getElementsByTagName('*') as $node) {
            if (! in_array(strtolower($node->tagName), array_merge(self::rules()['tags'], ['html', 'head', 'body', 'meta', 'title', 'style']), true)) {
                $this->fail('Unsupported email output element '.$node->tagName.'.');
            }
            if ($node->tagName === 'style') {
                $this->css($node->textContent);
            }
            foreach ($node->attributes as $attribute) {
                if ($node->tagName === 'meta' && strtolower($attribute->name) === 'http-equiv') {
                    $this->fail('Active email metadata is unsupported.');
                }
                if (str_starts_with(strtolower($attribute->name), 'on') || in_array(strtolower($attribute->name), ['srcdoc', 'srcset', 'background', 'poster', 'xlink:href'], true)) {
                    $this->fail('Unsupported active or external email attribute.');
                }
                if ($attribute->name === 'style') {
                    $this->declarations($attribute->value);
                }
                $this->destination($attribute->name, $attribute->value, true);
            }
        }
    }

    /** Called after typed value/media resolution; this never substitutes content tokens again.
     * @return array{html: string, css: string}
     */
    public function finalize(string $html, string $css = ''): array
    {
        $this->artifact($html, $css);
        $dom = $this->dom($html);
        if ($css !== '') {
            $head = $dom->getElementsByTagName('head')->item(0);
            if (! $head) {
                $head = $dom->createElement('head');
                $root = $dom->documentElement;
                if ($root === null) {
                    $this->fail('Email output requires a document element.');
                }
                $root->insertBefore($head, $root->firstChild);
            }
            $style = $dom->createElement('style');
            $style->appendChild($dom->createTextNode($css));
            $head->appendChild($style);
            // Serializing the whole document entity-encodes Unicode inside
            // raw style text. Per-node serialization retains UTF-8 CSS.
            $html = '';
            foreach ($dom->childNodes as $node) {
                $html .= $node->nodeType === XML_DOCUMENT_TYPE_NODE ? $dom->saveXML($node) : $dom->saveHTML($node);
            }
        }
        // Already finalized binding output has only media rules and inline styles.
        $static = '';
        foreach ($dom->getElementsByTagName('style') as $style) {
            $static .= preg_replace('/@media[^{}]*\{(?:[^{}]|\{[^{}]*\})*\}/i', '', $style->textContent);
        }
        if (trim($static) !== '') {
            $html = (new EmailCssInliner)->convert($html);
        }

        return ['html' => $html, 'css' => ''];
    }

    /** @param list<array{cid: string, mimeType: string, content: string}> $inlineAssets */
    public function browserPreview(string $html, array $inlineAssets, ?int $maxBytes = null): string
    {
        if ($maxBytes !== null && strlen($html) > $maxBytes) {
            throw ValidationException::withMessages(['preview' => ['Browser preview exceeds the byte limit.']]);
        }
        $images = [];
        foreach ($inlineAssets as $asset) {
            if (in_array($asset['mimeType'], ['image/png', 'image/jpeg', 'image/gif'], true)) {
                $images['cid:'.$asset['cid']] = 'data:'.$asset['mimeType'].';base64,'.$asset['content'];
            }
        }
        if ($images === []) {
            return $html;
        }
        $document = $this->dom($html);
        $changed = false;
        $projectedBytes = 0;
        foreach ($document->getElementsByTagName('img') as $image) {
            $source = preg_replace('/^cid:/i', 'cid:', $image->getAttribute('src'));
            if (isset($images[$source])) {
                $projectedBytes += strlen($images[$source]);
                if ($maxBytes !== null && $projectedBytes > $maxBytes) {
                    throw ValidationException::withMessages(['preview' => ['Browser preview exceeds the byte limit.']]);
                }
                $changed = true;
            }
        }

        if (! $changed) {
            return $html;
        }
        foreach ($document->getElementsByTagName('img') as $image) {
            $source = preg_replace('/^cid:/i', 'cid:', $image->getAttribute('src'));
            if (isset($images[$source])) {
                $image->setAttribute('src', $images[$source]);
            }
        }
        $preview = '';
        foreach ($document->childNodes as $node) {
            $preview .= $node->nodeType === XML_DOCUMENT_TYPE_NODE ? $document->saveXML($node) : $document->saveHTML($node);
        }

        return $preview;
    }

    private function css(string $css, bool $nested = false): void
    {
        $css = trim(preg_replace('~/\*.*?\*/~s', '', $css) ?? $this->fail('Email CSS could not be parsed.'));
        while ($css !== '') {
            $open = strpos($css, '{');
            if ($open === false) {
                $this->fail('Malformed email CSS.');
            }
            $selector = trim(substr($css, 0, $open));
            $depth = 1;
            for ($close = $open + 1; $close < strlen($css) && $depth; $close++) {
                $depth += $css[$close] === '{' ? 1 : ($css[$close] === '}' ? -1 : 0);
            }
            if ($depth) {
                $this->fail('Unbalanced email CSS.');
            }
            $body = substr($css, $open + 1, $close - $open - 2);
            if (str_starts_with($selector, '@')) {
                if ($nested || ! preg_match('/^@media\s+(?:screen\s+and\s+)?\((?:min|max)-width\s*:\s*\d+px\)$/iD', $selector)) {
                    $this->fail('Only top-level screen width media queries are supported.');
                }
                $this->css($body, true);
            } else {
                $plain = preg_replace('/(["\']).*?\1/s', '', str_replace(':root', '', $selector)) ?? $this->fail('Email selector could not be parsed.');
                if (preg_match('/[:+~\\\\]|[\^$*|~]=/', $plain)) {
                    $this->fail('Use simple email selectors.');
                }
                try {
                    $xpath = (new CssSelectorConverter)->toXPath($selector);
                } catch (\Throwable) {
                    $this->fail('Unsupported email selector.');
                }
                // Quoted CSS escapes can decode to controls that DOMXPath
                // cannot parse, even when the CSS selector parser accepts them.
                if (preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $xpath)) {
                    $this->fail('Unsupported email selector.');
                }
                $this->declarations($body, $nested);
            }
            $css = trim(substr($css, $close));
        }
    }

    private function sourceCss(string $css): void
    {
        if (str_contains($css, '{{')) {
            $this->fail('Source styles use typed settings, not raw tokens.');
        }
        $this->css($css);
    }

    private function declarations(string $css, bool $responsive = false): void
    {
        $css = preg_replace('~/\*.*?\*/~s', '', $css) ?? $this->fail('Email CSS could not be parsed.');
        foreach (explode(';', $css) as $declaration) {
            if (trim($declaration) === '') {
                continue;
            }
            $parts = explode(':', $declaration, 2);
            if (count($parts) !== 2) {
                $this->fail('Malformed email declaration.');
            }
            if ($responsive && ! preg_match('/!important\s*$/i', $parts[1])) {
                $this->fail('Responsive email declarations require !important.');
            }
            $this->style(strtolower(trim($parts[0])), trim($parts[1]));
        }
    }

    private function style(string $property, string $value): void
    {
        $rules = self::rules();
        if (! in_array($property, $rules['styles'], true)) {
            $this->fail($property.' is outside the email profile.');
        }
        if (preg_match('/^\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}$/D', $value)) {
            return; // BindingManifestValidator independently checks the typed context.
        }
        $value = preg_replace('/\s*!important\s*$/i', '', $value) ?? $this->fail('Email value could not be parsed.');
        preg_match_all('/([a-z-]+)\s*\(/i', $value, $functions);
        foreach ($functions[1] as $function) {
            if (! in_array(strtolower($function), ['rgb', 'rgba', 'hsl', 'hsla'], true)) {
                $this->fail('Use plain email values; CSS layout functions are unsupported.');
            }
        }
        if (preg_match('/var\s*\(|calc\s*\(|(?:^|[^a-z])[-\d.]+(?:mm|cm|in|pt|pc|rem|em|vw|vh|dvh|vmin|vmax)\b|url\s*\(|expression\s*\(|[<>\\\\{};]/i', $value) || $property === 'display' && ! in_array(strtolower($value), $rules['displays'], true)) {
            $this->fail('Unsupported value for '.$property.'.');
        }
    }

    private function destination(string $name, string $value, bool $output): void
    {
        if (! in_array($name, ['src', 'href'], true) || preg_match('/^\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}$/D', $value)) {
            return;
        }
        if (! preg_match($name === 'href' ? '/^(https?:|mailto:|tel:)/i' : ($output ? '/^(https:\/\/|cid:)/i' : '/^https:\/\//i'), $value)) {
            $this->fail('Use an absolute destination or retained email asset.');
        }
    }

    private function dom(string $html): DOMDocument
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        try {
            $dom->loadHTML('<?xml encoding="utf-8" ?>'.$html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        foreach (iterator_to_array($dom->childNodes) as $child) {
            if ($child->nodeType === XML_PI_NODE) {
                $dom->removeChild($child);
            }
        }

        return $dom;
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['email' => ['Email: '.$message]]);
    }
}
