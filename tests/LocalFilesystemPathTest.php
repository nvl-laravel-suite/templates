<?php

declare(strict_types=1);

use Illuminate\Filesystem\Filesystem;
use Nvl\Templates\Services\SafeFilesystemPathResolver;
use Nvl\Templates\Support\LocalFilesystemPath;
use Nvl\Templates\Support\PdfConfig\EngineConfig;

it('normalizes a local Windows path without changing its drive', function (string $path, string $normalized): void {
    if (DIRECTORY_SEPARATOR !== '\\') {
        $this->markTestSkipped('Windows path semantics require Windows.');
    }

    expect(LocalFilesystemPath::normalize($path))->toBe($normalized);
})->with([
    ['C:\\Allowed\\leaf', 'C:\\Allowed\\leaf'],
    ['c:/Allowed\\leaf', 'C:\\Allowed\\leaf'],
    ['C:\\Allowed\\child\\..\\leaf', 'C:\\Allowed\\leaf'],
    ['C:\\Allowed\\.hidden', 'C:\\Allowed\\.hidden'],
    ['C:\\', 'C:\\'],
    ['D:/Unicode/лозе', 'D:\\Unicode\\лозе'],
    ['C:\\Allowed\\CON-offer.pdf', 'C:\\Allowed\\CON-offer.pdf'],
]);

it('refuses unsafe Windows path names before filesystem work', function (string $path): void {
    if (DIRECTORY_SEPARATOR !== '\\') {
        $this->markTestSkipped('Windows path semantics require Windows.');
    }

    expect(LocalFilesystemPath::normalize($path))->toBeNull();
})->with([
    'drive relative' => ['C:Allowed\\leaf'],
    'rooted without drive' => ['\\Allowed\\leaf'],
    'relative' => ['Allowed\\leaf'],
    'UNC' => ['\\\\server\\share\\leaf'],
    'extended namespace' => ['\\\\?\\C:\\Allowed\\leaf'],
    'device namespace' => ['\\\\.\\NUL'],
    'NUL character' => ["C:\\Allowed\\unsafe\0leaf"],
    'ADS file' => ['C:\\Allowed\\file.pdf:payload'],
    'ADS directory' => ['C:\\Allowed\\child:stream\\leaf'],
    'trailing period' => ['C:\\Allowed\\alias.'],
    'trailing space' => ['C:\\Allowed\\alias '],
    'leading space' => ['C:\\Allowed\\ alias'],
    'dot traversal alias' => ['C:\\Allowed\\.. \\leaf'],
    'control character' => ["C:\\Allowed\\unsafe\x1fleaf"],
    'wildcard' => ['C:\\Allowed\\*.pdf'],
    'quote' => ['C:\\Allowed\\quote".pdf'],
    'pipe' => ['C:\\Allowed\\a|b'],
]);

$devices = ['CON', 'PRN', 'AUX', 'NUL', 'CONIN$', 'CONOUT$'];
foreach (['COM', 'LPT'] as $prefix) {
    foreach ([...range(1, 9), '¹', '²', '³'] as $suffix) {
        $devices[] = $prefix.$suffix;
    }
}
$devicePaths = [];
foreach ($devices as $device) {
    foreach (['', '.pdf', '.tar.gz', ' .pdf'] as $extension) {
        $devicePaths[$device.$extension] = ['C:\\Allowed\\'.strtolower($device).$extension];
    }
}
it('refuses reserved Windows device basenames including extensions', function (string $path): void {
    if (DIRECTORY_SEPARATOR !== '\\') {
        $this->markTestSkipped('Windows path semantics require Windows.');
    }

    expect(LocalFilesystemPath::normalize($path))->toBeNull();
})->with($devicePaths);

it('retains native POSIX absolute path semantics', function (string $path, ?string $normalized): void {
    if (DIRECTORY_SEPARATOR !== '/') {
        $this->markTestSkipped('POSIX path semantics require POSIX.');
    }

    expect(LocalFilesystemPath::normalize($path))->toBe($normalized);
})->with([
    ['/', '/'],
    ['/allowed//child/../leaf', '/allowed/leaf'],
    ['/allowed/.hidden', '/allowed/.hidden'],
    ['/allowed/NUL:stream ', '/allowed/NUL:stream '],
    ['/allowed/back\\slash', '/allowed/back\\slash'],
    ['relative/leaf', null],
    ['C:\\allowed\\leaf', null],
    ["/allowed/unsafe\0leaf", null],
]);

/**
 * Exercise real filesystem boundaries beneath one disposable test directory.
 *
 * @param  Closure(SafeFilesystemPathResolver, string, string): void  $check
 */
function withTemplateFilesystemRoots(Closure $check): void
{
    $files = new Filesystem;
    $base = sys_get_temp_dir().DIRECTORY_SEPARATOR.'nvl-template-paths-'.bin2hex(random_bytes(8));
    $allowed = $base.DIRECTORY_SEPARATOR.'allowed';
    $outside = $base.DIRECTORY_SEPARATOR.'outside';
    $files->ensureDirectoryExists($allowed);
    $files->ensureDirectoryExists($outside);

    try {
        $check(new SafeFilesystemPathResolver($files), $allowed, $outside);
    } finally {
        $files->deleteDirectory($base);
    }
}

it('creates canonical allowed directories through the native filesystem resolver', function (): void {
    withTemplateFilesystemRoots(function (SafeFilesystemPathResolver $paths, string $allowed): void {
        $target = $allowed.DIRECTORY_SEPARATOR.'nested'.DIRECTORY_SEPARATOR.'work';
        $input = DIRECTORY_SEPARATOR === '\\'
            ? str_replace('\\', '/', $allowed).'\\nested/work'
            : $allowed.'/nested//work';

        $resolved = $paths->directory($input, [$allowed], create: true, writable: true);

        expect($resolved)->toBe(realpath($target))
            ->and(is_dir($resolved))->toBeTrue()
            ->and(is_writable($resolved))->toBeTrue();
    });
});

it('accepts a local drive root while retaining the requested volume', function (): void {
    if (DIRECTORY_SEPARATOR !== '\\') {
        $this->markTestSkipped('Windows drive roots require Windows.');
    }

    $root = substr((string) realpath(sys_get_temp_dir()), 0, 3);
    $paths = new SafeFilesystemPathResolver(new Filesystem);

    expect($paths->directory(str_replace('\\', '/', $root), [$root]))->toBe(strtoupper($root));
});

it('refuses a different Windows drive before filesystem creation', function (): void {
    if (DIRECTORY_SEPARATOR !== '\\') {
        $this->markTestSkipped('Windows drive containment requires Windows.');
    }

    withTemplateFilesystemRoots(function (SafeFilesystemPathResolver $paths, string $allowed): void {
        $otherDrive = strtoupper($allowed[0]) === 'Z' ? 'Y' : 'Z';
        $target = $otherDrive.substr($allowed, 1).DIRECTORY_SEPARATOR.'escape';

        expect(fn () => $paths->directory($target, [$allowed], create: true))
            ->toThrow(InvalidArgumentException::class, 'outside its allowed roots');
        expect(scandir($allowed))->toBe(['.', '..']);
    });
});

it('confines normalized traversal and refuses escaping or sibling-prefix roots before creation', function (): void {
    withTemplateFilesystemRoots(function (SafeFilesystemPathResolver $paths, string $allowed, string $outside): void {
        $inside = $paths->directory($allowed.'/child/../kept', [$allowed], create: true);
        $escaped = $allowed.'/../outside/escape';
        $sibling = $allowed.'-sibling/report.pdf';

        expect($inside)->toBe(realpath($allowed.DIRECTORY_SEPARATOR.'kept'))
            ->and(fn () => $paths->directory($escaped, [$allowed], create: true))
            ->toThrow(InvalidArgumentException::class, 'outside its allowed roots')
            ->and(fn () => $paths->file($sibling, [$allowed], createParent: true))
            ->toThrow(InvalidArgumentException::class, 'outside its allowed roots')
            ->and(file_exists($outside.DIRECTORY_SEPARATOR.'escape'))->toBeFalse()
            ->and(file_exists($allowed.'-sibling'))->toBeFalse();
    });
});

it('rejects invalid roots and preserves the existing-root requirement', function (): void {
    withTemplateFilesystemRoots(function (SafeFilesystemPathResolver $paths, string $allowed): void {
        expect(fn () => $paths->directory($allowed.'/leaf', []))
            ->toThrow(InvalidArgumentException::class, 'at least one allowed root')
            ->and(fn () => $paths->directory($allowed.'/leaf', ['relative']))
            ->toThrow(InvalidArgumentException::class, 'absolute safe path')
            ->and(fn () => $paths->directory($allowed.'/missing/leaf', [$allowed.'/missing'], create: true))
            ->toThrow(InvalidArgumentException::class, 'existing directory')
            ->and(file_exists($allowed.DIRECTORY_SEPARATOR.'missing'))->toBeFalse();
    });
});

it('rejects Windows device stream and alias targets before filesystem creation', function (string $leaf): void {
    if (DIRECTORY_SEPARATOR !== '\\') {
        $this->markTestSkipped('Windows aliases require Windows.');
    }

    withTemplateFilesystemRoots(function (SafeFilesystemPathResolver $paths, string $allowed) use ($leaf): void {
        expect(fn () => $paths->directory($allowed.DIRECTORY_SEPARATOR.$leaf, [$allowed], create: true))
            ->toThrow(InvalidArgumentException::class, 'absolute safe path');
        expect(scandir($allowed))->toBe(['.', '..']);
    });
})->with(['NUL.pdf', 'aux', 'file.pdf:stream', 'alias.', 'alias ', '.. ']);

it('resolves regular file targets and refuses a directory in their place', function (): void {
    withTemplateFilesystemRoots(function (SafeFilesystemPathResolver $paths, string $allowed): void {
        $target = $paths->file($allowed.'/reports/statement', [$allowed], requiredExtension: 'pdf', createParent: true);
        file_put_contents($target, 'known report bytes');

        expect($target)->toBe($allowed.DIRECTORY_SEPARATOR.'reports'.DIRECTORY_SEPARATOR.'statement.pdf')
            ->and(file_get_contents($target))->toBe('known report bytes')
            ->and($paths->file($target, [$allowed], requiredExtension: 'pdf'))->toBe($target)
            ->and(fn () => $paths->file($allowed.'/reports', [$allowed]))
            ->toThrow(InvalidArgumentException::class, 'regular non-symlink file');
    });
});

it('rejects regular files as existing directory ancestors before attempting creation', function (string $kind): void {
    withTemplateFilesystemRoots(function (SafeFilesystemPathResolver $paths, string $allowed) use ($kind): void {
        $blocker = $allowed.DIRECTORY_SEPARATOR.'regular-file';
        file_put_contents($blocker, 'preserved file bytes');

        $resolve = match ($kind) {
            'existing directory' => fn (): string => $paths->directory($blocker, [$allowed]),
            'existing directory with creation' => fn (): string => $paths->directory($blocker, [$allowed], create: true),
            'new directory' => fn (): string => $paths->directory($blocker.'/work', [$allowed], create: true),
            'new file' => fn (): string => $paths->file($blocker.'/report.pdf', [$allowed], createParent: true),
        };

        expect($resolve)->toThrow(InvalidArgumentException::class, 'non-directory existing ancestor')
            ->and(file_get_contents($blocker))->toBe('preserved file bytes');
    });
})->with(['existing directory', 'existing directory with creation', 'new directory', 'new file']);

it('rejects real symbolic link roots children and file targets', function (): void {
    if (! function_exists('symlink')) {
        $this->markTestSkipped('The filesystem does not provide genuine symbolic links.');
    }

    withTemplateFilesystemRoots(function (SafeFilesystemPathResolver $paths, string $allowed, string $outside): void {
        $rootLink = dirname($allowed).DIRECTORY_SEPARATOR.'root-link';
        $childLink = $allowed.DIRECTORY_SEPARATOR.'child-link';
        $fileLink = $allowed.DIRECTORY_SEPARATOR.'file-link.pdf';
        $outsideFile = $outside.DIRECTORY_SEPARATOR.'outside.pdf';
        file_put_contents($outsideFile, 'outside bytes');

        $createSymlink = static function (string $target, string $link): bool {
            $capabilityUnavailable = false;
            set_error_handler(static function (int $severity, string $message, string $file, int $line) use (&$capabilityUnavailable): bool {
                if ($severity === E_WARNING && in_array($message, [
                    'symlink(): Permission denied',
                    'symlink(): Operation not permitted',
                    'symlink(): Operation not supported',
                    'symlink(): Function not implemented',
                ], true)) {
                    $capabilityUnavailable = true;

                    return true;
                }

                throw new ErrorException($message, 0, $severity, $file, $line);
            });

            try {
                $created = symlink($target, $link);
            } finally {
                restore_error_handler();
            }

            if (! $created && ! $capabilityUnavailable) {
                throw new RuntimeException('Symbolic link creation failed without an expected capability error.');
            }

            return $created;
        };

        try {
            if (! $createSymlink($outside, $rootLink)
                || ! $createSymlink($outside, $childLink)
                || ! $createSymlink($outsideFile, $fileLink)) {
                $this->markTestSkipped('The filesystem does not permit genuine symbolic links.');
            }

            expect(fn () => $paths->directory($rootLink.'/work', [$rootLink], create: true))
                ->toThrow(InvalidArgumentException::class, 'root cannot be a symbolic link')
                ->and(fn () => $paths->directory($childLink.'/work', [$allowed], create: true))
                ->toThrow(InvalidArgumentException::class, 'symbolic link')
                ->and(fn () => $paths->file($fileLink, [$allowed]))
                ->toThrow(InvalidArgumentException::class, 'regular non-symlink file')
                ->and(file_exists($outside.DIRECTORY_SEPARATOR.'work'))->toBeFalse()
                ->and(file_get_contents($outsideFile))->toBe('outside bytes');
        } finally {
            foreach ([$fileLink, $childLink, $rootLink] as $link) {
                if (is_link($link)) {
                    unlink($link);
                }
            }
        }
    });
});

it('passes the native temporary directory spelling through fluent PDF options', function (): void {
    $path = DIRECTORY_SEPARATOR === '\\'
        ? 'c:/Safe templates\\nested/work'
        : '/safe templates/nested/work';
    $options = (new EngineConfig)->setTempDir($path)->toPdfOptions();

    expect($options->temporaryDirectory)->toBe($path);
});

it('refuses unsafe temporary directory spellings in the public fluent adapter', function (string $path): void {
    expect(fn () => (new EngineConfig)->setTempDir($path))->toThrow(InvalidArgumentException::class);
})->with([
    ['relative/work'],
    ["invalid\0path"],
    ['C:relative'],
    ['\\\\server\\share\\work'],
    ['\\\\?\\C:\\work'],
    ['C:\\work\\NUL.pdf'],
    ['C:\\work\\file.pdf:stream'],
]);
