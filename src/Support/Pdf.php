<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\PdfDriver;

final class Pdf
{
    public static function configured(): ?PdfDriver
    {
        $id = config('nvl-templates.pdf.driver');
        if (! is_string($id) || $id === '') {
            return null;
        }
        try {
            $driver = app($id);
            if ($driver instanceof PdfDriver && $driver->identity() !== '') {
                return $driver;
            }
        } catch (\Throwable) {
        }

        return null;
    }

    public static function driver(): PdfDriver
    {
        return self::configured() ?? throw ValidationException::withMessages(['pdf' => ['A configured PDF driver is required.']]);
    }

    /** @param array<array-key,mixed> $options
     * @return array{filename:string,expectedPages?:int,maxPages?:int}
     */
    public static function options(array $options): array
    {
        if (array_diff(array_keys($options), ['filename', 'expectedPages', 'maxPages']) !== []) {
            throw ValidationException::withMessages(['options' => ['Unsupported PDF options.']]);
        }
        $filename = $options['filename'] ?? 'document.pdf';
        if (! is_string($filename) || ! preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,140}\.pdf\z/', $filename)) {
            throw ValidationException::withMessages(['filename' => ['Use a bounded plain PDF filename.']]);
        }
        $result = ['filename' => $filename];
        foreach (['expectedPages', 'maxPages'] as $key) {
            if (array_key_exists($key, $options)) {
                $count = $options[$key];
                if (! is_int($count) || $count < 1 || $count > 1000) {
                    throw ValidationException::withMessages([$key => ['Use a page count from 1 to 1000.']]);
                }
                $result[$key] = $count;
            }
        }
        if (isset($options['expectedPages'], $options['maxPages']) && $options['expectedPages'] > $options['maxPages']) {
            throw ValidationException::withMessages(['expectedPages' => ['Expected pages exceeds the maximum.']]);
        }

        return $result;
    }
}
