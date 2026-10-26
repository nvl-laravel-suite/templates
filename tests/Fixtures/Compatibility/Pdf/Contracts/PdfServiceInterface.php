<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Compatibility\Pdf\Contracts;

use Nvl\Templates\Tests\Fixtures\Compatibility\Html\HtmlPayload;
use Nvl\Templates\Tests\Fixtures\Compatibility\Pdf\Options\PdfOptions;
use Nvl\Templates\Tests\Fixtures\Compatibility\Templates\Contracts\TemplateInterface;

/**
 * Renders HTML or class-based templates into verified PDF output.
 *
 * @api
 */
interface PdfServiceInterface
{
    public function renderHtml(
        HtmlPayload $payload,
        PdfOptions $options,
    ): GeneratedPdfInterface;

    public function saveHtml(
        HtmlPayload $payload,
        PdfOptions $options,
        string $path,
    ): string;

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $assets
     * @param  array<string, mixed>  $options
     */
    public function renderTemplate(
        TemplateInterface $template,
        string $language,
        array $data = [],
        array $assets = [],
        array $options = [],
    ): GeneratedPdfInterface;

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $assets
     * @param  array<string, mixed>  $options
     */
    public function saveWithTemplate(
        TemplateInterface $template,
        string $language,
        array $data = [],
        array $assets = [],
        array $options = [],
        ?string $filename = null,
    ): string;

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $assets
     * @param  array<string, mixed>  $options
     */
    public function saveToStorage(
        TemplateInterface $template,
        string $language,
        array $data = [],
        array $assets = [],
        array $options = [],
        ?string $filename = null,
    ): string;
}
