<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures\Compatibility\Services;

use Illuminate\Contracts\Routing\ResponseFactory;
use Illuminate\Http\Response;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\HeaderUtils;

/**
 * Creates safe inline or attachment HTTP responses from verified render output.
 *
 * @api
 */
final readonly class TemplateResponseFactory
{
    public function __construct(private ResponseFactory $responses) {}

    /**
     * Create an inline response suitable for browser display.
     *
     * @param  array<string, string>  $headers
     * @param  array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}  $rendered
     */
    public function inline(
        array $rendered,
        array $headers = [],
    ): Response {
        return $this->response($rendered, 'inline', $headers);
    }

    /**
     * Create an attachment response using the suggested safe filename.
     *
     * @param  array<string, string>  $headers
     * @param  array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}  $rendered
     */
    public function download(
        array $rendered,
        array $headers = [],
    ): Response {
        if ($rendered['suggested_filename'] === null) {
            throw new InvalidArgumentException(
                'A rendered template requires a suggested filename for download.',
            );
        }

        return $this->response($rendered, 'attachment', $headers);
    }

    /**
     * @param  array<string, string>  $headers
     * @param  array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}  $rendered
     */
    private function response(
        array $rendered,
        string $disposition,
        array $headers,
    ): Response {
        foreach ($headers as $name => $value) {
            if (preg_match('/^[A-Za-z0-9-]+$/', $name) !== 1
                || preg_match('/[\\r\\n]/', $value) === 1) {
                throw new InvalidArgumentException(
                    'Template response headers must be safe strings.',
                );
            }
        }

        $protected = [
            'Cache-Control' => 'private, no-cache, no-store, must-revalidate, max-age=0',
            'Content-Type' => $rendered['mime_type'],
            'Content-Length' => (string) $rendered['byte_size'],
            'ETag' => '"'.$rendered['checksum'].'"',
            'Expires' => '0',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ];

        if ($rendered['suggested_filename'] !== null) {
            $protected['Content-Disposition'] = HeaderUtils::makeDisposition(
                $disposition,
                $rendered['suggested_filename'],
            );
        }

        return $this->responses->make(
            $rendered['content'],
            200,
            [...$headers, ...$protected],
        );
    }
}
