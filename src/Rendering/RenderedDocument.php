<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use Illuminate\Validation\ValidationException;

/**
 *  Typed internal compilation result; public services expose a native array.
 *
 * @phpstan-type InlineAsset array{cid: string, name: string, mimeType: string, content: string}
 * @phpstan-type RenderResult array{html: string, css: string, subject: ?string, text: ?string, revisionId: string, checksum: string, inlineAssets: list<InlineAsset>}
 *
 * @internal
 */
final readonly class RenderedDocument
{
    /** @param list<InlineAsset> $inlineAssets */
    public function __construct(public string $html, public string $css, public ?string $subject, public ?string $text, public string $revisionId, public string $checksum, public array $inlineAssets = []) {}

    /** Validate the retained bundle before exposing its native result shape. */
    public static function fromArray(mixed $value): self
    {
        if (! is_array($value) || ! is_string($value['html'] ?? null) || ! is_string($value['css'] ?? null)
            || ! is_string($value['revisionId'] ?? null) || ! is_string($value['checksum'] ?? null)
            || ! array_key_exists('subject', $value) || (! is_string($value['subject']) && $value['subject'] !== null)
            || ! array_key_exists('text', $value) || (! is_string($value['text']) && $value['text'] !== null)
            || ! is_array($value['inlineAssets'] ?? null) || ! array_is_list($value['inlineAssets'])) {
            throw ValidationException::withMessages(['render' => ['The retained render bundle is invalid.']]);
        }
        $assets = [];
        foreach ($value['inlineAssets'] as $asset) {
            if (! is_array($asset) || ! is_string($asset['cid'] ?? null) || ! is_string($asset['name'] ?? null)
                || ! is_string($asset['mimeType'] ?? null) || ! is_string($asset['content'] ?? null)) {
                throw ValidationException::withMessages(['render' => ['The retained inline asset bundle is invalid.']]);
            }
            $assets[] = ['cid' => $asset['cid'], 'name' => $asset['name'], 'mimeType' => $asset['mimeType'], 'content' => $asset['content']];
        }

        return new self($value['html'], $value['css'], $value['subject'], $value['text'], $value['revisionId'], $value['checksum'], $assets);
    }

    /** @return RenderResult */
    public function toArray(): array
    {
        return ['html' => $this->html, 'css' => $this->css, 'subject' => $this->subject, 'text' => $this->text,
            'revisionId' => $this->revisionId, 'checksum' => $this->checksum, 'inlineAssets' => $this->inlineAssets];
    }
}
