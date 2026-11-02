<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Compatibility\Pdf\Options;

use Nvl\Templates\Enums\PdfOrientation;
use Nvl\Templates\Enums\PdfPageSize;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\HeaderFooterData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\MarginsData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\MetadataData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\PageNumberingData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\ProtectionData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\WatermarkData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\EngineConfig;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Enums\PageOrientation;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Enums\PaperSize;

/**
 * Fluent PDF options compatible with class-based template consumers.
 *
 * @api
 */
final class PdfOptions
{
    private EngineConfig $config;

    public function __construct(?EngineConfig $config = null)
    {
        $this->config = $config ?? new EngineConfig;
    }

    public static function a4Portrait(): self
    {
        return (new self)
            ->paper(PaperSize::A4)
            ->orientation(PageOrientation::PORTRAIT);
    }

    public function paper(PaperSize $size): self
    {
        $this->config->setPageSize($size);

        return $this;
    }

    public function orientation(PageOrientation $orientation): self
    {
        $this->config->setOrientation($orientation);

        return $this;
    }

    public function margins(MarginsData $margins): self
    {
        $this->config->setMargins($margins);

        return $this;
    }

    public function metadata(MetadataData $metadata): self
    {
        $this->config->setMetadata($metadata);

        return $this;
    }

    public function protection(ProtectionData $protection): self
    {
        $this->config->setProtection($protection);

        return $this;
    }

    public function watermark(WatermarkData $watermark): self
    {
        $this->config->setWatermark($watermark);

        return $this;
    }

    public function pageNumbering(PageNumberingData $pageNumbering): self
    {
        $this->config->setPageNumbering($pageNumbering);

        return $this;
    }

    public function headerFooter(HeaderFooterData $headerFooter): self
    {
        $this->config->setHeaderFooter($headerFooter);

        return $this;
    }

    public function dpi(int $dpi): self
    {
        $this->config->setDpi($dpi);

        return $this;
    }

    public function imageQuality(int $quality): self
    {
        $this->config->setImageQuality($quality);

        return $this;
    }

    public function debugImages(bool $enabled = true): self
    {
        $this->config->showImageErrors = $enabled;

        return $this;
    }

    /** Native Templates operation.
     * @return array{pageSize: PdfPageSize|null, orientation: PdfOrientation|null, margins: array{left: float|null, right: float|null, top: float|null, bottom: float|null, header: float|null, footer: float|null}|null, defaultFont: string|null, defaultFontSize: float|null, dpi: int|null, imageDpi: int|null, imageQuality: int|null, showImageErrors: bool|null, temporaryDirectory: string|null, title: string|null, author: string|null, creator: string|null, subject: string|null, keywords: string|null, headerView: string|null, headerHtml: string|null, headerData: array<string, mixed>, footerView: string|null, footerHtml: string|null, footerData: array<string, mixed>, watermark: string|null, watermarkOpacity: float|null, compress: bool|null, pdfa: bool|null, pdfaAuto: bool|null, protectionPermissions: list<string>, userPassword: string|null, ownerPassword: string|null}
     */
    public function toData(): array
    {
        return $this->config->toPdfOptions();
    }

    /**
     * @return array<string, mixed>
     */
    public function toMpdfConfig(): array
    {
        return $this->config->toArray();
    }
}
