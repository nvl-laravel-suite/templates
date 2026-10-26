<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Compatibility\Pdf;

use Illuminate\Filesystem\Filesystem;
use Illuminate\Http\Response;
use InvalidArgumentException;
use Nvl\Templates\Services\SafeFilesystemPathResolver;
use Nvl\Templates\Tests\Fixtures\Compatibility\Pdf\Contracts\GeneratedPdfInterface;
use Nvl\Templates\Tests\Fixtures\Compatibility\Services\TemplateResponseFactory;
use RuntimeException;
use Throwable;

/**
 * Immutable verified PDF bytes with safe response and atomic local persistence helpers.
 */
final readonly class GeneratedPdf implements GeneratedPdfInterface
{
    /** @var array<string, string> */
    private const CACHE_HEADERS = [
        'Cache-Control' => 'private, no-cache, no-store, must-revalidate, max-age=0',
        'Pragma' => 'no-cache',
        'Expires' => '0',
    ];

    /** Native Templates operation.
     * @param  array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}  $rendered
     */
    public function __construct(
        private array $rendered,
        private TemplateResponseFactory $responses,
        private Filesystem $files,
        private SafeFilesystemPathResolver $paths,
    ) {}

    public function display(): Response
    {
        return $this->responses->inline($this->rendered, self::CACHE_HEADERS);
    }

    public function download(string $filename = 'document.pdf'): Response
    {
        return $this->responses->download(
            $this->renamed($filename),
            self::CACHE_HEADERS,
        );
    }

    public function save(string $path): string
    {
        $roots = config(
            'nvl-templates.rendering.output.allowed_local_roots',
            [storage_path()],
        );

        if (! is_array($roots)) {
            throw new InvalidArgumentException(
                'Template output allowed roots must be an array.',
            );
        }

        $path = $this->paths->file(
            $path,
            array_values($roots),
            requiredExtension: 'pdf',
            createParent: true,
            description: 'Generated PDF path',
        );
        $temporary = $path.'.'.bin2hex(random_bytes(8)).'.tmp';

        try {
            $written = file_put_contents($temporary, $this->rendered['content'], LOCK_EX);

            if ($written !== $this->rendered['byte_size']
                || ! chmod($temporary, 0600)
                || ! rename($temporary, $path)) {
                throw new RuntimeException('Generated PDF could not be saved atomically.');
            }
        } catch (Throwable $exception) {
            if (is_file($temporary)) {
                $this->files->delete($temporary);
            }

            throw new RuntimeException(
                'Generated PDF could not be saved atomically.',
                0,
                $exception,
            );
        }

        return $path;
    }

    public function getContent(): string
    {
        return $this->rendered['content'];
    }

    public function withFilename(string $filename): self
    {
        return new self(
            $this->renamed($filename),
            $this->responses,
            $this->files,
            $this->paths,
        );
    }

    /** Native Templates operation.
     * @return array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}
     */
    private function renamed(string $filename): array
    {
        $filename = basename($filename);
        $filename = str_ends_with(strtolower($filename), '.pdf')
            ? $filename
            : $filename.'.pdf';

        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,190}$/D', $filename) !== 1
            || str_contains($filename, '..')) {
            throw new InvalidArgumentException('Generated PDF filename is invalid.');
        }

        return ['subject' => $this->rendered['subject'], 'suggested_filename' => $filename, 'content' => $this->rendered['content'], 'mime_type' => $this->rendered['mime_type'], 'renderer' => $this->rendered['renderer'], 'byte_size' => $this->rendered['byte_size'], 'checksum' => $this->rendered['checksum']];
    }
}
