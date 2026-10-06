<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

use InvalidArgumentException;
use Nvl\Support\Config\PackageOptions;

/**
 * Validates independently configurable management and render route groups.
 */
final class TemplatesRouteConfiguration
{
    public static function path(string $group): string
    {
        $path = config("templates.routes.{$group}.prefix", "api/v1/templates/{$group}");

        if (! is_string($path)) {
            throw new InvalidArgumentException("templates.routes.{$group}.prefix must be a string.");
        }

        $path = trim($path, '/');

        if ($path === ''
            || str_contains($path, '..')
            || str_contains($path, '//')
            || preg_match('#^[A-Za-z0-9][A-Za-z0-9/_-]*$#', $path) !== 1) {
            throw new InvalidArgumentException(
                "templates.routes.{$group}.prefix must be a safe route prefix.",
            );
        }

        return $path;
    }

    public static function name(string $group): string
    {
        $name = config("templates.routes.{$group}.name", "nvl.templates.{$group}.");

        if (! is_string($name)) {
            throw new InvalidArgumentException("templates.routes.{$group}.name must be a string.");
        }

        $name = rtrim(trim($name), '.');

        if ($name === '' || preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]*$/', $name) !== 1) {
            throw new InvalidArgumentException(
                "templates.routes.{$group}.name must be a safe route-name prefix.",
            );
        }

        return $name.'.';
    }

    /**
     * @return list<string>
     */
    public static function middleware(string $group): array
    {
        $configured = PackageOptions::routeMiddleware('templates', $group, ['api', 'auth']);

        if ($configured === []) {
            throw new InvalidArgumentException(
                "templates.routes.{$group}.middleware cannot be empty.",
            );
        }

        return $configured;
    }

    private function __construct() {}
}
