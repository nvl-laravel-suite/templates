<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig;

use InvalidArgumentException;
use Nvl\Templates\Enums\PdfOrientation;
use Nvl\Templates\Enums\PdfPageSize;
use Nvl\Templates\Support\LocalFilesystemPath;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\HeaderFooterData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\MarginsData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\MetadataData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\PageNumberingData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\ProtectionData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\WatermarkData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Enums\PageOrientation;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Enums\PaperSize;

/**
 * Mutable fluent adapter retained for class-based templates and converted to immutable render DTOs.
 *
 * @api
 */
final class EngineConfig
{
    public PaperSize $format = PaperSize::A4;

    public PageOrientation $orientation = PageOrientation::PORTRAIT;

    public MarginsData $margins;

    public ?MetadataData $metadata = null;

    public ?ProtectionData $protection = null;

    public ?WatermarkData $watermark = null;

    public ?PageNumberingData $pageNumbering = null;

    public ?HeaderFooterData $headerFooter = null;

    public string $defaultFont = 'dejavusans';

    public int $dpi = 96;

    public int $imageDpi = 96;

    public bool $showImageErrors = false;

    public ?string $tempDir = null;

    public bool $enableCompression = true;

    public int $imageQuality = 85;

    public function __construct()
    {
        $this->margins = new MarginsData(16, 15, 16, 15, 8, 8);
    }

    public function setPageSize(PaperSize $size): self
    {
        $this->format = $size;

        return $this;
    }

    public function setOrientation(PageOrientation $orientation): self
    {
        $this->orientation = $orientation;

        return $this;
    }

    public function setMargins(MarginsData $margins): self
    {
        $this->margins = $margins;

        return $this;
    }

    public function setMetadata(MetadataData $metadata): self
    {
        $this->metadata = $metadata;

        return $this;
    }

    public function setProtection(ProtectionData $protection): self
    {
        $this->protection = $protection;

        return $this;
    }

    public function setWatermark(WatermarkData $watermark): self
    {
        $this->watermark = $watermark;

        return $this;
    }

    public function setPageNumbering(PageNumberingData $pageNumbering): self
    {
        $this->pageNumbering = $pageNumbering;

        return $this;
    }

    public function setHeaderFooter(HeaderFooterData $headerFooter): self
    {
        $this->headerFooter = $headerFooter;

        return $this;
    }

    public function setDefaultFont(string $font): self
    {
        if (preg_match('/^[A-Za-z0-9_-]+$/D', $font) !== 1) {
            throw new InvalidArgumentException('PDF default font is invalid.');
        }

        $this->defaultFont = $font;

        return $this;
    }

    public function setDpi(int $dpi): self
    {
        if ($dpi < 72 || $dpi > 300) {
            throw new InvalidArgumentException('PDF DPI must be between 72 and 300.');
        }

        $this->dpi = $dpi;
        $this->imageDpi = $dpi;

        return $this;
    }

    public function setTempDir(string $path): self
    {
        if (LocalFilesystemPath::normalize($path) === null) {
            throw new InvalidArgumentException(
                'PDF temporary directory must be an absolute path.',
            );
        }

        $this->tempDir = $path;

        return $this;
    }

    public function setImageQuality(int $quality): self
    {
        if ($quality < 1 || $quality > 100) {
            throw new InvalidArgumentException('PDF image quality must be between 1 and 100.');
        }

        $this->imageQuality = $quality;

        return $this;
    }

    public function enableCompression(bool $enabled = true): self
    {
        $this->enableCompression = $enabled;

        return $this;
    }

    /** Native Templates operation.
     * @return array{pageSize: PdfPageSize|null, orientation: PdfOrientation|null, margins: array{left: float|null, right: float|null, top: float|null, bottom: float|null, header: float|null, footer: float|null}|null, defaultFont: string|null, defaultFontSize: float|null, dpi: int|null, imageDpi: int|null, imageQuality: int|null, showImageErrors: bool|null, temporaryDirectory: string|null, title: string|null, author: string|null, creator: string|null, subject: string|null, keywords: string|null, headerView: string|null, headerHtml: string|null, headerData: array<string, mixed>, footerView: string|null, footerHtml: string|null, footerData: array<string, mixed>, watermark: string|null, watermarkOpacity: float|null, compress: bool|null, pdfa: bool|null, pdfaAuto: bool|null, protectionPermissions: list<string>, userPassword: string|null, ownerPassword: string|null}
     */
    public function toPdfOptions(): array
    {
        $headerHtml = $this->headerFooter?->headerHtml;
        $footerHtml = $this->headerFooter?->footerHtml;

        if ($this->pageNumbering?->enabled === true) {
            $pageNumberHtml = $this->pageNumberHtml($this->pageNumbering);

            if (str_starts_with($this->pageNumbering->position, 'top-')) {
                $headerHtml = ($headerHtml ?? '').$pageNumberHtml;
            } else {
                $footerHtml = ($footerHtml ?? '').$pageNumberHtml;
            }
        }

        return [
            'defaultFontSize' => null, 'headerView' => null, 'headerData' => [], 'footerView' => null, 'footerData' => [], 'pdfa' => null, 'pdfaAuto' => null, 'pageSize' => PdfPageSize::from($this->format->value),
            'orientation' => $this->orientation === PageOrientation::PORTRAIT
                ? PdfOrientation::Portrait
                : PdfOrientation::Landscape,
            'margins' => [
                'left' => (float) $this->margins->left,
                'right' => (float) $this->margins->right,
                'top' => (float) $this->margins->top,
                'bottom' => (float) $this->margins->bottom,
                'header' => (float) $this->margins->header,
                'footer' => (float) $this->margins->footer,
            ],
            'defaultFont' => $this->defaultFont,
            'dpi' => $this->dpi,
            'imageDpi' => $this->imageDpi,
            'imageQuality' => $this->imageQuality,
            'showImageErrors' => $this->showImageErrors,
            'temporaryDirectory' => $this->tempDir,
            'title' => $this->metadata?->title,
            'author' => $this->metadata?->author,
            'creator' => $this->metadata?->creator,
            'subject' => $this->metadata?->subject,
            'keywords' => $this->metadata?->keywords,
            'headerHtml' => $headerHtml,
            'footerHtml' => $footerHtml,
            'watermark' => $this->watermark?->show === true ? $this->watermark->text : null,
            'watermarkOpacity' => $this->watermark?->alpha,
            'compress' => $this->enableCompression,
            'protectionPermissions' => $this->protection?->enabled === true
                ? $this->protection->permissions
                : [],
            'userPassword' => $this->protection?->enabled === true
                ? $this->protection->userPassword
                : null,
            'ownerPassword' => $this->protection?->enabled === true
                ? $this->protection->ownerPassword
                : null,
        ];
    }

    /**
     * Return the bounded mPDF-compatible configuration subset.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'format' => $this->format->value,
            'orientation' => $this->orientation->value,
            'margin_top' => $this->margins->top,
            'margin_right' => $this->margins->right,
            'margin_bottom' => $this->margins->bottom,
            'margin_left' => $this->margins->left,
            'margin_header' => $this->margins->header,
            'margin_footer' => $this->margins->footer,
            'default_font' => $this->defaultFont,
            'dpi' => $this->dpi,
            'img_dpi' => $this->imageDpi,
            'showImageErrors' => $this->showImageErrors,
            'tempDir' => $this->tempDir,
            'jpgQuality' => $this->imageQuality,
            'compress' => $this->enableCompression,
        ];
    }

    private function pageNumberHtml(PageNumberingData $numbering): string
    {
        $alignment = match ($numbering->position) {
            'top-left', 'bottom-left' => 'left',
            'top-right', 'bottom-right' => 'right',
            default => 'center',
        };

        return '<div style="text-align:'.$alignment.'">'
            .htmlspecialchars($numbering->template, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            .'</div>';
    }
}
