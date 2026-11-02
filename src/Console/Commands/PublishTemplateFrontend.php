<?php

declare(strict_types=1);

namespace Nvl\Templates\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;

final class PublishTemplateFrontend extends Command
{
    protected $signature = 'nvl:templates:frontend:publish
        {--dry-run : Inspect the publication without writing files}
        {--force : Replace existing files that differ from the package}';

    protected $description = 'Publish the bundled Template Maker frontend into the configured components directory';

    public function handle(Filesystem $files): int
    {
        $destination = config('nvl-templates.frontend.path', resource_path('js/components/template-maker'));
        if (! is_string($destination) || trim($destination) === '' || str_contains($destination, "\0")) {
            $this->error('nvl-templates.frontend.path must be a non-empty filesystem path.');

            return self::FAILURE;
        }

        if (! str_starts_with($destination, '/') && ! (DIRECTORY_SEPARATOR === '\\' && (str_starts_with($destination, '\\') || preg_match('/^[A-Za-z]:[\\\\\/]/', $destination)))) {
            $destination = base_path($destination);
        }
        $destination = rtrim($destination, DIRECTORY_SEPARATOR === '\\' ? '/\\' : '/').DIRECTORY_SEPARATOR;
        $source = dirname(__DIR__, 3).'/resources/js/template-maker';

        try {
            $this->assertSafeDirectory($source);
            $this->assertSafeDirectory($destination);
            $sourceDirectory = $this->normalizedDirectory($source);
            $destinationDirectory = $this->normalizedDirectory($destination);
            $sourceComparison = DIRECTORY_SEPARATOR === '\\' ? strtolower($sourceDirectory) : $sourceDirectory;
            $destinationComparison = DIRECTORY_SEPARATOR === '\\' ? strtolower($destinationDirectory) : $destinationDirectory;
            if (str_starts_with($destinationComparison, $sourceComparison) || str_starts_with($sourceComparison, $destinationComparison)
                || (DIRECTORY_SEPARATOR === '/' && ($this->containsDirectory($sourceDirectory, $destinationDirectory) || $this->containsDirectory($destinationDirectory, $sourceDirectory)))) {
                throw new RuntimeException('The frontend destination must not overlap the package source directory.');
            }
            $destination = $destinationDirectory;
            $pending = [];
            $conflicts = [];
            $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source, RecursiveDirectoryIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);

            /** @var SplFileInfo $entry */
            foreach ($entries as $entry) {
                $path = $entry->getPathname();
                if ($entry->isLink()) {
                    throw new RuntimeException('Refusing symbolic link: '.$path);
                }
                if ($entry->isDir()) {
                    continue;
                }
                if (! $entry->isFile()) {
                    throw new RuntimeException('Source is not a regular file: '.$path);
                }

                $target = $destination.substr($path, strlen($source) + 1);
                $this->assertSafeDirectory(dirname($target));
                if (is_link($target)) {
                    throw new RuntimeException('Refusing symbolic link: '.$target);
                }
                if ($files->exists($target) && ! $files->isFile($target)) {
                    throw new RuntimeException('Destination is not a regular file: '.$target);
                }
                if ($files->isFile($target)) {
                    if ($files->get($target) === $files->get($path)) {
                        continue;
                    }
                    if (! $this->option('force')) {
                        $conflicts[] = $target;
                    }
                }
                $pending[$target] = $path;
            }

            if ($conflicts !== []) {
                foreach ($conflicts as $conflict) {
                    $this->error('Existing file differs: '.$conflict);
                }
                $this->error('No files were published. Use --force to replace these files.');

                return self::FAILURE;
            }

            foreach ($pending as $target => $path) {
                $this->line(($this->option('dry-run') ? 'Would publish: ' : 'Publishing: ').$target);
                if (! $this->option('dry-run')) {
                    $files->ensureDirectoryExists(dirname($target));
                    if (! $files->copy($path, $target)) {
                        throw new RuntimeException('Unable to copy frontend file: '.$target);
                    }
                }
            }
            $this->info(count($pending).' frontend files '.($this->option('dry-run') ? 'would be published.' : 'published.'));

            return self::SUCCESS;
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }

    private function normalizedDirectory(string $path): string
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            $path = str_replace('\\', '/', $path);
        }
        $parts = [];
        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.') {
                continue;
            }
            if ($part === '..') {
                if ($parts !== [] && ! (DIRECTORY_SEPARATOR === '\\' && count($parts) === 1 && preg_match('/^[A-Za-z]:$/', $parts[0]))) {
                    array_pop($parts);
                }
            } else {
                $parts[] = $part;
            }
        }
        $prefix = str_starts_with($path, '/') ? '/' : '';
        if (DIRECTORY_SEPARATOR === '\\' && str_starts_with($path, '//')) {
            $prefix = '//';
        }
        $path = $prefix.implode('/', $parts);
        if (preg_match('/^[A-Za-z]:$/', $path)) {
            $path .= '/';
        }
        $this->assertSafeDirectory($path);
        $suffix = [];
        while (! is_dir($path)) {
            $parent = dirname($path);
            if ($parent === $path) {
                throw new RuntimeException('Unable to resolve frontend directory: '.$path);
            }
            array_unshift($suffix, basename($path));
            $path = $parent;
        }
        $resolved = realpath($path);
        if ($resolved === false) {
            throw new RuntimeException('Unable to resolve frontend directory: '.$path);
        }
        if (DIRECTORY_SEPARATOR === '\\') {
            $resolved = str_replace('\\', '/', $resolved);
        }
        $directory = rtrim($resolved, '/').'/'.implode('/', $suffix);
        $directory = rtrim($directory, '/').'/';

        return $directory;
    }

    private function containsDirectory(string $ancestor, string $directory): bool
    {
        $identity = is_dir($ancestor) ? stat($ancestor) : false;
        if ($identity === false) {
            return false;
        }
        $directory = rtrim($directory, '/') ?: '/';
        while (true) {
            $current = is_dir($directory) ? stat($directory) : false;
            if ($current !== false && $current['dev'] === $identity['dev'] && $current['ino'] === $identity['ino']) {
                return true;
            }
            $parent = dirname($directory);
            if ($parent === $directory) {
                return false;
            }
            $directory = $parent;
        }
    }

    private function assertSafeDirectory(string $path): void
    {
        $path = rtrim($path, DIRECTORY_SEPARATOR === '\\' ? '/\\' : '/') ?: DIRECTORY_SEPARATOR;
        while (true) {
            if (is_link($path)) {
                throw new RuntimeException('Refusing symbolic link: '.$path);
            }
            if (file_exists($path) && ! is_dir($path)) {
                throw new RuntimeException('Expected a directory: '.$path);
            }
            $parent = dirname($path);
            if ($parent === $path) {
                break;
            }
            $path = $parent;
        }
    }
}
