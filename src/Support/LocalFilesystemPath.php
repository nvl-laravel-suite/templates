<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

/**
 * Normalizes local absolute paths without accepting Windows device or stream aliases.
 *
 * @internal
 */
final class LocalFilesystemPath
{
    /** Return a normalized local absolute path, or null for an unsafe path spelling. */
    public static function normalize(string $path): ?string
    {
        if (str_contains($path, "\0")) {
            return null;
        }

        $windows = DIRECTORY_SEPARATOR === '\\';
        $absolute = $windows
            ? strlen($path) >= 3
                && preg_match('/^[A-Za-z]:$/D', substr($path, 0, 2)) === 1
                && in_array($path[2], ['\\', '/'], true)
            : str_starts_with($path, DIRECTORY_SEPARATOR);
        if (! $absolute) {
            return null;
        }

        $prefix = $windows ? strtoupper(substr($path, 0, 2)).DIRECTORY_SEPARATOR : DIRECTORY_SEPARATOR;
        $relative = substr($path, $windows ? 3 : 1);
        if ($windows) {
            $relative = str_replace('/', DIRECTORY_SEPARATOR, $relative);
        }
        $segments = [];
        foreach (explode(DIRECTORY_SEPARATOR, $relative) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($segments);

                continue;
            }
            if ($windows && ! self::safeWindowsSegment($segment)) {
                return null;
            }
            $segments[] = $segment;
        }

        return $prefix.implode(DIRECTORY_SEPARATOR, $segments);
    }

    /** Reject DOS devices, NTFS streams, invalid characters and Win32 normalization aliases. */
    private static function safeWindowsSegment(string $segment): bool
    {
        if ($segment !== trim($segment, ' ')
            || str_ends_with($segment, '.')
            || preg_match('/[<>:"|?*\x00-\x1f]/', $segment) !== 0) {
            return false;
        }

        $basename = rtrim(explode('.', $segment, 2)[0], ' ');

        return preg_match('/^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³]|CONIN\$|CONOUT\$)$/iu', $basename) === 0;
    }
}
