<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use DOMDocument;
use DOMElement;
use DOMNode;
use Illuminate\Validation\ValidationException;

/**
 *  Validates each runtime binding context before substitution.
 *
 * @phpstan-type Binding array{id: string, path: string, kind: string, property: string, unit: string}
 * @phpstan-type Artifact array{html: string, css: string, subject: ?string, text: ?string, bindings: list<Binding>}
 *
 * @internal
 */
final class BindingManifestValidator
{
    public const TOKEN = '/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/';

    public const STYLES = ['font-size', 'line-height', 'font-weight', 'width', 'height', 'text-align', 'color', 'background-color', 'border-radius', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'];

    /** @param array<array-key,mixed> $artifact */
    public function validate(array $artifact): void
    {
        $this->prepare($artifact);
    }

    /** @param array<array-key,mixed> $artifact
     * @return Artifact
     */
    public function prepare(array $artifact): array
    {
        $bindings = $artifact['bindings'] ?? [];
        if (! is_array($bindings)) {
            $this->fail('Runtime bindings must be an array.');
        }
        if (count($bindings) > config('nvl-templates.limits.bindings')) {
            $this->fail('Too many runtime bindings.');
        }
        $byId = [];
        foreach ($bindings as $binding) {
            if (! is_array($binding) || ! is_string($binding['id'] ?? null) || ! is_string($binding['path'] ?? null) || ! is_string($binding['kind'] ?? null)) {
                $this->fail('Invalid binding declaration.');
            }
            $id = $binding['id'];
            $path = $binding['path'];
            $kind = $binding['kind'];
            if (! preg_match('/^[a-zA-Z][a-zA-Z0-9_]*$/D', $id) || isset($byId[$id]) || ! preg_match('/^(facts|context|content|inputs|settings)\.[a-zA-Z][a-zA-Z0-9_.]*$/D', $path) || ! in_array($kind, ['text', 'attribute', 'link', 'image', 'style'], true)) {
                $this->fail('Invalid or duplicate binding declaration.');
            }
            $property = $kind === 'style' ? ($binding['property'] ?? null) : '';
            $unit = $kind === 'style' ? ($binding['unit'] ?? '') : '';
            if (! is_string($property) || ! is_string($unit) || ($kind === 'style' && (! in_array($property, self::STYLES, true) || ! in_array($unit, ['', 'px', 'mm', 'pt', '%', 'rem'], true)))) {
                $this->fail('Unsupported style binding.');
            }
            $byId[$id] = ['id' => $id, 'path' => $path, 'kind' => $kind, 'property' => $property, 'unit' => $unit];
        }
        $html = $artifact['html'] ?? '';
        $css = $artifact['css'] ?? '';
        if (! is_string($html) || trim($html) === '' || ! is_string($css) || strlen($html.$css) > config('nvl-templates.limits.document_bytes')) {
            $this->fail('A bounded nonempty HTML artifact is required.');
        }
        $this->validateRawHtml($html);
        $this->validateCss($css, $byId);
        $dom = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        try {
            $dom->loadHTML('<?xml encoding="utf-8" ?>'.$html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        $restore = [];
        $marker = 'TPLBIND'.bin2hex(random_bytes(12));
        $walk = function (DOMNode $node) use (&$walk, $byId, &$restore, $marker): void {
            if ($node instanceof DOMElement) {
                $tag = strtolower($node->tagName);
                if (in_array($tag, ['script', 'iframe', 'object', 'embed', 'base', 'form', 'link', 'svg', 'math', 'template', 'audio', 'video', 'source', 'track', 'input', 'frame', 'frameset', 'xmp', 'plaintext', 'noscript'], true)) {
                    $this->fail('Executable or external document content is prohibited.');
                }
                foreach ($node->attributes as $attribute) {
                    $name = strtolower($attribute->name);
                    if (str_starts_with($name, 'on') || $name === 'srcdoc' || ($tag === 'meta' && $name === 'http-equiv')) {
                        $this->fail('Active HTML attributes are prohibited.');
                    }
                    if (in_array($name, ['srcset', 'background', 'poster', 'xlink:href', 'ping'], true) || ($name === 'src' && ! preg_match('/^\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}$/D', $attribute->value))) {
                        $this->fail('Image and fetch sources must use a managed asset binding.');
                    }
                    if ($name === 'style') {
                        $this->validateCss($attribute->value, $byId);

                        continue;
                    }
                    foreach ($this->tokens($attribute->value) as $id) {
                        $binding = $byId[$id] ?? null;
                        $expected = $name === 'href' ? 'link' : ($name === 'src' ? 'image' : 'attribute');
                        if ($binding === null || $binding['kind'] !== $expected || trim($attribute->value) !== '{{'.$id.'}}' || ! in_array($name, ['href', 'src', 'alt', 'title', 'lang', 'dir', 'width', 'height'], true)) {
                            $this->fail('Binding used in an unsupported HTML attribute context.');
                        }
                    }
                    if (in_array($name, ['href', 'src'], true) && preg_match('/^\s*(javascript|file|vbscript):/i', $attribute->value)) {
                        $this->fail('Unsafe static destination.');
                    }
                    if (in_array($name, ['href', 'src'], true) && $this->tokens($attribute->value)) {
                        $placeholder = $marker.count($restore);
                        $restore[$placeholder] = $attribute->value;
                        $attribute->value = $placeholder;
                    }
                }
            }
            if (in_array($node->nodeType, [XML_COMMENT_NODE, XML_PI_NODE], true) && $this->tokens($node->nodeValue ?? '')) {
                $this->fail('Bindings are not allowed in comments or instructions.');
            }
            // Browsers and mail clients end or interpret such comments differently
            // from this parser, exposing markup that was never validated here.
            if ($node->nodeType === XML_COMMENT_NODE && strpbrk($node->nodeValue ?? '', '<>') !== false) {
                $this->fail('Comments must not contain markup.');
            }
            if ($node->nodeType === XML_TEXT_NODE) {
                $parent = strtolower($node->parentNode->nodeName ?? '');
                if ($parent === 'style') {
                    $this->validateCss($node->nodeValue ?? '', $byId);
                } else {
                    foreach ($this->tokens($node->nodeValue ?? '') as $id) {
                        if (($byId[$id]['kind'] ?? null) !== 'text') {
                            $this->fail('Only declared text bindings are permitted in text.');
                        }
                    }
                }
            }
            foreach ($node->childNodes as $child) {
                $walk($child);
            }
        };
        $walk($dom);
        $subject = $artifact['subject'] ?? null;
        $text = $artifact['text'] ?? null;
        if (($subject !== null && ! is_string($subject)) || ($text !== null && ! is_string($text))) {
            $this->fail('Subject and text sidecars must be strings or null.');
        }
        foreach (['subject' => $subject, 'text' => $text] as $field => $value) {
            foreach ($this->tokens($value ?? '') as $id) {
                if (($byId[$id]['kind'] ?? null) !== 'text') {
                    $this->fail('Only text bindings are allowed in '.$field.'.');
                }
            }
        }
        foreach (iterator_to_array($dom->childNodes) as $child) {
            if ($child->nodeType === XML_PI_NODE) {
                $dom->removeChild($child);
            }
        }
        $serialized = $dom->saveHTML();
        if ($serialized === false) {
            $this->fail('The prepared HTML artifact could not be serialized.');
        }

        return ['html' => strtr($serialized, $restore), 'css' => $css, 'subject' => $subject, 'text' => $text, 'bindings' => array_values($byId)];
    }

    private function validateRawHtml(string $html): void
    {
        // DOM parsers repair malformed/unquoted markup. Every original markup
        // token must already be inside a quoted attribute; DOM checks its kind/value.
        preg_match_all('/<(?:"[^"]*"|\'[^\']*\'|[^\'">])*>/s', $html, $tags);
        foreach ($tags[0] as $tag) {
            preg_match_all('/\s([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*(["\'])(.*?)\2/s', $tag, $attributes, PREG_OFFSET_CAPTURE);
            preg_match_all(self::TOKEN, $tag, $tokens, PREG_OFFSET_CAPTURE);
            foreach ($tokens[0] as [$token, $offset]) {
                $quoted = false;
                foreach ($attributes[3] as [$value, $valueOffset]) {
                    if ($offset >= $valueOffset && $offset + strlen($token) <= $valueOffset + strlen($value)) {
                        $quoted = true;
                        break;
                    }
                }
                if (! $quoted) {
                    $this->fail('Markup bindings require a quoted attribute; structural bindings are prohibited.');
                }
            }
        }
    }

    /** @param array<string,Binding> $bindings */
    private function validateCss(string $css, array $bindings): void
    {
        if (preg_match('/[<>\\\\]|expression\s*\(|@import|url\s*\(|image-set\s*\(|javascript:|file:/i', $css)) {
            $this->fail('Unsafe or unsupported stylesheet.');
        }
        preg_match_all(self::TOKEN, $css, $occurrences, PREG_OFFSET_CAPTURE);
        foreach ($occurrences[1] as $index => [$id, $offset]) {
            $binding = $bindings[$id] ?? null;
            $tokenOffset = $occurrences[0][$index][1];
            $before = substr($css, 0, $tokenOffset);
            $after = substr($css, $tokenOffset + strlen($occurrences[0][$index][0]));
            if (($binding['kind'] ?? null) !== 'style' || ! preg_match('/(?:^|[;{])\s*'.preg_quote($binding['property'] ?? '', '/').'\s*:\s*$/i', $before) || ! preg_match('/^\s*(?:;|\}|$)/', $after)) {
                $this->fail('A style binding must occupy its declared property value.');
            }
        }
    }

    /** @return list<string> */
    private function tokens(string $value): array
    {
        preg_match_all(self::TOKEN, $value, $matches);

        return $matches[1];
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['artifacts' => [$message]]);
    }
}
