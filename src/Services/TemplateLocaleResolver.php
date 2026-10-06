<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Exception;
use InvalidArgumentException;
use Nvl\Support\Contracts\LocaleCatalog;

/**
 * Normalizes template locales into one stable lowercase BCP-47-like form.
 */
final class TemplateLocaleResolver
{
    /** Create the shared locale normalizer for template storage. */
    public function __construct(private readonly LocaleCatalog $catalog) {}

    /**
     * Resolve and validate one template locale.
     */
    public function resolve(mixed $value): string
    {
        if (! is_string($value) || trim($value) === '') {
            throw new InvalidArgumentException('Template locale must be a non-empty string.');
        }

        try {
            $locale = mb_strtolower($this->catalog->normalize($value));
        } catch (Exception $exception) {
            throw new InvalidArgumentException("Template locale [{$value}] is invalid.", previous: $exception);
        }

        if (preg_match('/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/', $locale) !== 1) {
            throw new InvalidArgumentException("Template locale [{$locale}] is invalid.");
        }

        return $locale;
    }
}
