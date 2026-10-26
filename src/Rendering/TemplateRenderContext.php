<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use Nvl\Templates\Enums\PdfOrientation;
use Nvl\Templates\Enums\PdfPageSize;
use Nvl\Templates\Template;

/**
 * Provides renderers and Blade views with one fully validated immutable context.
 *
 * @api
 */
final readonly class TemplateRenderContext
{
    /**
     * @param  array<string, mixed>  $rendererOptions
     * @param  array{pageSize?: PdfPageSize|null, orientation?: PdfOrientation|null, margins?: array{left?: float|null, right?: float|null, top?: float|null, bottom?: float|null, header?: float|null, footer?: float|null}|null, defaultFont?: string|null, defaultFontSize?: float|null, dpi?: int|null, imageDpi?: int|null, imageQuality?: int|null, showImageErrors?: bool|null, temporaryDirectory?: string|null, title?: string|null, author?: string|null, creator?: string|null, subject?: string|null, keywords?: string|null, headerView?: string|null, headerHtml?: string|null, headerData?: array<string, mixed>, footerView?: string|null, footerHtml?: string|null, footerData?: array<string, mixed>, watermark?: string|null, watermarkOpacity?: float|null, compress?: bool|null, pdfa?: bool|null, pdfaAuto?: bool|null, protectionPermissions?: list<string>, userPassword?: string|null, ownerPassword?: string|null}|null  $pdf
     */
    public function __construct(
        public Template $template,
        public string $view,
        public string $renderer,
        public string $locale,
        public ?string $subject,
        public ?string $filename,
        public ?array $pdf,
        public array $rendererOptions,
    ) {}

    /**
     * Return the optional Content composition.
     *
     * @return array{blocks:list<array<string,mixed>>,regions:array<string,list<array<string,mixed>>>,locale:string,...}|null
     */
    public function composition(): ?array
    {
        return $this->template->composition;
    }

    /**
     * Return the template data object.
     *
     * @return array<string, mixed>
     */
    public function data(): array
    {
        return $this->template->data;
    }

    /**
     * Return implementation-layer settings supplied to the template.
     *
     * @return array<string, mixed>
     */
    public function settings(): array
    {
        return $this->template->settings;
    }

    /**
     * Return the root Content blocks or an empty list.
     *
     * @return list<array<string, mixed>>
     */
    public function blocks(): array
    {
        $composition = $this->composition();

        return $composition === null ? [] : $composition['blocks'];
    }

    /**
     * Return Content blocks grouped by region or an empty map.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function regions(): array
    {
        $composition = $this->composition();

        return $composition === null ? [] : $composition['regions'];
    }

    /**
     * Return the explicit variables made available to a Blade template.
     *
     * @return array{
     *     template: Template,
     *     options: self,
     *     composition: array<string,mixed>|null,
     *     blocks: list<array<string, mixed>>,
     *     regions: array<string, list<array<string, mixed>>>,
     *     data: array<string, mixed>,
     *     settings: array<string, mixed>
     * }
     */
    public function viewData(): array
    {
        return [
            'template' => $this->template,
            'options' => $this,
            'composition' => $this->composition(),
            'blocks' => $this->blocks(),
            'regions' => $this->regions(),
            'data' => $this->data(),
            'settings' => $this->settings(),
        ];
    }
}
