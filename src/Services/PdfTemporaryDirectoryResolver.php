<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Closure;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Support\Ownership\Exceptions\OwnershipViolation;
use Nvl\Templates\Ownership\TemplatesOwnership;
use Nvl\Templates\Support\TemplatesConfiguration;

/**
 * Validates and creates the mPDF workspace without escaping allowed roots.
 *
 * @internal
 */
final readonly class PdfTemporaryDirectoryResolver
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private SafeFilesystemPathResolver $paths,
        private OwnershipBoundary $ownershipBoundary,
        private Filesystem $files,
    ) {}

    /**
     * Inspect the configured path without creating directories.
     */
    public function isSafe(): bool
    {
        try {
            $this->validatedPath(false);

            return true;
        } catch (InvalidArgumentException|OwnershipViolation) {
            return false;
        }
    }

    /**
     * Return a created, writable, and fully resolved mPDF directory.
     */
    public function resolve(?string $path = null): string
    {
        return $this->validatedPath(true, $path);
    }

    /**
     * Keep the owned workspace private to one render and remove it on every exit.
     *
     * @template TResult
     *
     * @param  Closure(string): TResult  $render
     * @return TResult
     */
    public function withDirectory(Closure $render, ?string $path = null): mixed
    {
        $isolated = TemplatesOwnership::declared();
        $directory = $this->resolve($path);
        try {
            return $render($directory);
        } finally {
            if ($isolated) {
                $this->files->deleteDirectory($directory);
            }
        }
    }

    private function validatedPath(bool $create, ?string $override = null): string
    {
        $configured = $override ?? TemplatesConfiguration::string(
            'nvl-templates.pdf.temp_path',
            storage_path('framework/cache/nvl-templates/mpdf'),
        );

        if (TemplatesOwnership::declared()) {
            $scope = $this->ownershipBoundary->key('templates.templates', 'pdf-work');
            $configured = rtrim($configured, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.hash('sha256', $scope).DIRECTORY_SEPARATOR.'work'.DIRECTORY_SEPARATOR.Str::uuid();
        }
        $allowedRoots = config('nvl-templates.pdf.allowed_temp_roots', [storage_path()]);

        if (! is_array($allowedRoots) || $allowedRoots === []) {
            throw new InvalidArgumentException(
                'templates.pdf.allowed_temp_roots must contain at least one path.',
            );
        }

        return $this->paths->directory(
            $configured,
            array_values($allowedRoots),
            create: $create,
            writable: true,
            description: 'PDF temporary directory',
        );
    }
}
