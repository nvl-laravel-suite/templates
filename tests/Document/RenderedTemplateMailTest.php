<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Emails\RenderedTemplateMail;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Tests\CanonicalTestCase;
use Nvl\Templates\Tests\Support\DocumentClient;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class RenderedTemplateMailTest extends CanonicalTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
    }

    private function renderedEmail(): array
    {
        Storage::fake('local');
        $api = app(DocumentClient::class);
        $asset = app(TemplateAssets::class)->upload(UploadedFile::fake()->createWithContent('Лого.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')), $this->actor());
        $document = Documents::standalone('Подарък {{literal}}');
        $document['content']['logo'] = $asset->id;
        $document['dataSchema']['properties']['content']['properties']['logo'] = ['type' => 'string'];
        $document['artifacts']['html'] = str_replace('</body>', '<img src="{{logo}}" alt="Logo"></body>', $document['artifacts']['html']);
        $document['artifacts']['bindings'][] = ['id' => 'logo', 'path' => 'content.logo', 'kind' => 'image'];
        $document['artifacts']['css'] = 'h1{color:#123456}@media screen and (max-width:620px){h1{font-size:20px!important}}';
        $template = $api->createTemplate('native-mail', 'Native mail');
        $draft = $api->saveDraft($template->id, $document, 0);
        $revision = $api->publish($template->id, $draft->version);

        return $api->render($revision->id, facts: ['code' => 'MAIL'], inputs: ['message' => '<b>Enjoy</b> {{literal}}'])->toArray();
    }

    public function test_native_mail_preserves_final_html_plain_text_cids_and_normal_host_attachments(): void
    {
        config()->set('mail.default', 'array');
        config()->set('mail.mailers.array', ['transport' => 'array']);
        $result = $this->renderedEmail();
        $mail = new RenderedTemplateMail($result);
        $transport = Mail::mailer()->getSymfonyTransport();
        self::assertCount(0, $transport->messages());
        $mail = unserialize(serialize($mail));
        $mail->from('sender@example.com')->to('recipient@example.com')->attachData('receipt', 'note.txt', ['mime' => 'text/plain']);
        $sent = Mail::send($mail);
        $message = $sent->getSymfonySentMessage()->getOriginalMessage();
        self::assertSame($result['html'], $message->getHtmlBody());
        self::assertSame($result['text'], $message->getTextBody());
        self::assertSame('Подарък {{literal}}', $message->getSubject());
        self::assertStringContainsString('&lt;b&gt;Enjoy&lt;/b&gt; {{literal}}', $message->getHtmlBody());
        self::assertStringContainsString('multipart/alternative', $message->toString());
        self::assertCount(2, $message->getAttachments());
        $inline = array_values(array_filter($message->getAttachments(), fn ($part) => $part->getDisposition() === 'inline'));
        self::assertCount(1, $inline);
        self::assertSame($result['inlineAssets'][0]['cid'], $inline[0]->getContentId());
        self::assertSame('image', $inline[0]->getMediaType());
        self::assertStringContainsString('cid:'.$inline[0]->getContentId(), $message->getHtmlBody());
        self::assertCount(1, $transport->messages());
    }

    #[DataProvider('invalidResults')]
    public function test_unfinished_or_inconsistent_email_output_is_rejected_before_delivery(string $html, string $css, ?string $subject, array $assets): void
    {
        $this->expectException(ValidationException::class);
        new RenderedTemplateMail(['html' => $html, 'css' => $css, 'subject' => $subject, 'text' => 'Plain', 'revisionId' => 'revision', 'checksum' => 'checksum', 'inlineAssets' => $assets]);
    }

    public function test_oversized_email_without_inline_assets_is_rejected(): void
    {
        config(['nvl-templates.limits.output_bytes' => 64]);
        $this->expectException(ValidationException::class);
        new RenderedTemplateMail(['html' => '<p>'.str_repeat('x', 128).'</p>', 'css' => '', 'subject' => 'Mail', 'text' => null, 'revisionId' => 'revision', 'checksum' => 'checksum', 'inlineAssets' => []]);
    }

    public static function invalidResults(): iterable
    {
        yield 'external CSS was not finalized' => ['<p>Mail</p>', 'p{color:red}', 'Mail', []];
        yield 'missing subject' => ['<p>Mail</p>', '', null, []];
        yield 'header injection' => ['<p>Mail</p>', '', "Bad\r\nBcc: attacker@example.com", []];
        yield 'missing CID attachment' => ['<img src="cid:missing@assets" alt="Logo">', '', 'Mail', []];
        yield 'malformed attachment bytes' => ['<img src="cid:bad@assets" alt="Logo">', '', 'Mail', [['cid' => 'bad@assets', 'name' => 'logo.png', 'mimeType' => 'image/png', 'content' => 'not-base64']]];
    }
}
