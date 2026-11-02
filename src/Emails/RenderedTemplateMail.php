<?php

declare(strict_types=1);

namespace Nvl\Templates\Emails;

use DOMDocument;
use finfo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Message;
use Illuminate\Support\HtmlString;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Rendering\EmailProfile;
use Nvl\Templates\Rendering\RenderedDocument;
use Symfony\Component\Mime\Part\DataPart;

/**
 * Adapt finalized native output to Laravel Mail without dispatching delivery.
 *
 * @api
 */
final class RenderedTemplateMail extends Mailable
{
    use Queueable;

    /** @var list<array{cid: string, name: string, mimeType: string, bytes: string}> */
    private array $inlineParts = [];

    private readonly RenderedDocument $rendered;

    /** @param array<array-key,mixed> $rendered Finalized result from TemplateRenderer or RenderRequests. */
    public function __construct(array $rendered)
    {
        $this->rendered = $rendered = RenderedDocument::fromArray($rendered);
        if ($rendered->css !== '' || trim($rendered->html) === '' || ! is_string($rendered->subject) || trim($rendered->subject) === ''
            || mb_strlen($rendered->subject) > 998 || preg_match('/[\r\n\x00]/', $rendered->subject)) {
            $this->invalid('Use finalized email HTML and a valid single-line subject.');
        }
        app(EmailProfile::class)->artifact($rendered->html);
        $total = strlen($rendered->html) + strlen($rendered->subject) + strlen($rendered->text ?? '');
        $maximum = config('nvl-templates.limits.output_bytes');
        if (! is_int($maximum) || $maximum < 1 || $total > $maximum) {
            $this->invalid('The complete email exceeds the configured output limit.');
        }
        $ids = [];
        $mime = new finfo(FILEINFO_MIME_TYPE);
        foreach ($rendered->inlineAssets as $asset) {
            if (strlen($asset['cid']) > 191
                || ! preg_match('/\A[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\z/', $asset['cid']) || isset($ids[$asset['cid']])
                || $asset['name'] === ''
                || ! in_array($asset['mimeType'], ['image/png', 'image/jpeg', 'image/gif'], true)) {
                $this->invalid('Inline email assets require unique safe CIDs and supported image metadata.');
            }
            $bytes = base64_decode($asset['content'], true);
            if (! is_string($bytes) || $bytes === '' || $mime->buffer($bytes) !== $asset['mimeType']) {
                $this->invalid('Inline email image bytes do not match their MIME type.');
            }
            $total += strlen($bytes);
            if ($total > $maximum) {
                $this->invalid('The complete email exceeds the configured output limit.');
            }
            $ids[$asset['cid']] = true;
            $name = mb_substr(preg_replace('/[\\\\\/\x00-\x1f\x7f]/', '_', $asset['name']) ?? '', 0, 255);
            $this->inlineParts[] = ['cid' => $asset['cid'], 'name' => $name, 'mimeType' => $asset['mimeType'], 'bytes' => $bytes];
        }
        if ($total > $maximum) {
            $this->invalid('The complete email exceeds the configured output limit.');
        }
        $dom = new DOMDocument;
        $prior = libxml_use_internal_errors(true);
        try {
            $dom->loadHTML($rendered->html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
            foreach ($dom->getElementsByTagName('img') as $image) {
                $source = $image->getAttribute('src');
                if (str_starts_with(strtolower($source), 'cid:') && ! isset($ids[substr($source, 4)])) {
                    $this->invalid('Every CID image must have its matching inline attachment.');
                }
            }
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($prior);
        }
        $this->subject($rendered->subject);
    }

    /** @return array{html: HtmlString, text?: HtmlString} */
    protected function buildView(): array
    {
        $views = ['html' => new HtmlString($this->rendered->html)];
        if ($this->rendered->text !== null) {
            $views['text'] = new HtmlString($this->rendered->text);
        }

        return $views;
    }

    /** @param Message $message */
    protected function buildAttachments($message): static
    {
        parent::buildAttachments($message);
        foreach ($this->inlineParts as $asset) {
            $part = (new DataPart($asset['bytes'], $asset['name'], $asset['mimeType']))->asInline()->setContentId($asset['cid']);
            $message->getSymfonyMessage()->addPart($part);
        }

        return $this;
    }

    private function invalid(string $message): never
    {
        throw ValidationException::withMessages(['email' => [$message]]);
    }
}
