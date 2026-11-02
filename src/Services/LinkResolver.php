<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Validation\ValidationException;

/**
 * Internal document collaborator; invoked within an admitted operation.
 *
 * @internal
 */
final class LinkResolver
{
    public function resolve(string $url): string
    {
        if ($url === '' || preg_match('/[\x00-\x20\x7f\\\\<>"\']/', $url)) {
            $this->invalid();
        }
        $scheme = strtolower(parse_url($url, PHP_URL_SCHEME) ?: '');
        if (! in_array($scheme, ['https', 'mailto', 'tel'], true)) {
            $this->invalid();
        }
        if ($scheme === 'https' && (! filter_var($url, FILTER_VALIDATE_URL) || parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null)) {
            $this->invalid();
        }

        return $url;
    }

    private function invalid(): never
    {
        throw ValidationException::withMessages(['link' => ['Use an approved absolute HTTPS, mailto or tel destination.']]);
    }
}
