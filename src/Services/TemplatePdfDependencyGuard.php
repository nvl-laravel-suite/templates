<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Mpdf\AssetFetcher;
use Mpdf\Container\SimpleContainer;
use Mpdf\Mpdf;
use Nvl\Templates\Exceptions\TemplateDependencyUnavailableException;

/** Checks optional PDF dependencies before loading an implementation with an mPDF parent. @internal */
final readonly class TemplatePdfDependencyGuard
{
    /** Determine whether all classes required by the built-in PDF renderer are available. */
    public function available(): bool
    {
        return class_exists(Mpdf::class) && class_exists(AssetFetcher::class) && class_exists(SimpleContainer::class);
    }

    /** Fail before renderer or asset-fetcher resolution when the selected dependency is absent. */
    public function assertAvailable(): void
    {
        if (! $this->available()) {
            throw new TemplateDependencyUnavailableException("Built-in PDF requires composer require 'mpdf/mpdf:^8.3.0' --with-all-dependencies and mPDF's GD/mbstring extensions.");
        }
    }
}
