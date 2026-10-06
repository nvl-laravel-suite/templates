<?php

declare(strict_types=1);

namespace Nvl\Templates\Html;

use Nvl\Support\Facades\Locales;

/**
 * Typed preparation context for class-based templates.
 *
 * @api
 */
final class TemplateContext
{
    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $options
     * @param  list<array{src: string, x_mm?: float, y_mm?: float, w_mm?: float, h_mm?: float, rotate?: float}>  $stickers
     */
    public function __construct(
        public string $language = '',
        public array $data = [],
        public array $options = [],
        public ?string $fallbackLanguage = null,
        public ?string $variant = null,
        public array $stickers = [],
        public ?string $frameKey = null,
    ) {
        $this->language = $this->language !== ''
            ? $this->language
            : Locales::default();
        $this->fallbackLanguage ??= Locales::fallbacks()[0] ?? Locales::default();
    }
}
