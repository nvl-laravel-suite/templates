<?php

declare(strict_types=1);

namespace Nvl\Templates;

use InvalidArgumentException;
use Nvl\Templates\Enums\PdfOrientation;
use Nvl\Templates\Enums\PdfPageSize;

/**
 * Describes one source-controlled view, its bounded data, options, and optional Content composition.
 *
 * Consumer applications may instantiate this class directly or extend it for
 * domain-specific templates with typed constructor arguments.
 *
 * @api
 */
class Template
{
    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $settings
     * @param  array{renderer?: string|null, locale?: string|null, subject?: string|null, filename?: string|null, pdf?: array{pageSize?: PdfPageSize|null, orientation?: PdfOrientation|null, margins?: array{left?: float|null, right?: float|null, top?: float|null, bottom?: float|null, header?: float|null, footer?: float|null}|null, defaultFont?: string|null, defaultFontSize?: float|null, dpi?: int|null, imageDpi?: int|null, imageQuality?: int|null, showImageErrors?: bool|null, temporaryDirectory?: string|null, title?: string|null, author?: string|null, creator?: string|null, subject?: string|null, keywords?: string|null, headerView?: string|null, headerHtml?: string|null, headerData?: array<string, mixed>, footerView?: string|null, footerHtml?: string|null, footerData?: array<string, mixed>, watermark?: string|null, watermarkOpacity?: float|null, compress?: bool|null, pdfa?: bool|null, pdfaAuto?: bool|null, protectionPermissions?: list<string>, userPassword?: string|null, ownerPassword?: string|null}|null, rendererOptions?: array<string, mixed>}|null  $options
     * @param  array{blocks:list<array<string,mixed>>,regions:array<string,list<array<string,mixed>>>,locale:string,...}|null  $composition
     */
    public function __construct(
        public readonly string $key,
        public readonly string $view = '',
        public readonly array $data = [],
        public readonly ?array $options = null,
        public readonly ?array $composition = null,
        public readonly array $schema = [],
        public readonly array $settings = [],
    ) {
        if (preg_match('/^[a-z][a-z0-9_.-]*$/', $this->key) !== 1) {
            throw new InvalidArgumentException(
                "Template key [{$this->key}] must be a stable lowercase alias.",
            );
        }

        if ($this->view !== ''
            && (preg_match('/^[A-Za-z0-9][A-Za-z0-9_.:\\/-]*$/', $this->view) !== 1
                || str_contains($this->view, '..')
                || str_starts_with($this->view, '/'))) {
            throw new InvalidArgumentException(
                "Template view [{$this->view}] is invalid.",
            );
        }

        $this->ensureAssociative($this->data, 'data');
        $this->ensureAssociative($this->schema, 'schema');
        $this->ensureAssociative($this->settings, 'settings');
    }

    /**
     * @param  array<array-key, mixed>  $value
     */
    private function ensureAssociative(array $value, string $name): void
    {
        if ($value !== [] && array_is_list($value)) {
            throw new InvalidArgumentException(
                "Template {$name} must be an associative object.",
            );
        }
    }
}
