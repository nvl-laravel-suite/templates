<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Nvl\Media\Models\Media;
use Nvl\Templates\Contracts\DocumentCompiler;
use Nvl\Templates\Exceptions\RetryableRenderException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;

final class RenderExecutionTest extends TestCase
{
    use RefreshDatabase;

    private function accepted(?DocumentCompiler $driver = null): TemplateRender
    {
        Storage::fake('local');
        $document = Documents::standalone();
        if ($driver) {
            app()->instance('execution.compiler', $driver);
            config()->set('nvl-templates.compiler.driver', 'execution.compiler');
            config()->set('nvl-templates.compiler.identity', 'test-build-1');
            $document['artifacts']['engine'] = 'shared';
        }
        $api = app(Templates::class);
        $template = $api->createTemplate('execution', 'Execution');
        $draft = $api->saveDraft($template->id, $document, 0);
        $revision = $api->publish($template->id, $draft->version);

        return $api->renders()->accept($revision->id, facts: ['code' => 'ACCEPTED'], inputs: ['message' => 'Frozen message']);
    }

    public function test_execution_retains_the_result_and_duplicate_execution_does_not_render_again(): void
    {
        $accepted = $this->accepted();
        $renders = app(Templates::class)->renders();
        $done = $renders->process($accepted->id);
        self::assertSame('completed', $done->status);
        self::assertSame(1, $done->attempts);
        self::assertStringContainsString('Frozen message', $renders->result($done->id)->html);
        self::assertSame($renders->result($done->id)->checksum, $renders->result($done->id)->checksum);
        self::assertSame(1, $renders->process($accepted->id)->attempts);
        self::assertSame(1, Media::query()->count());
        self::assertNotNull(Media::query()->find($done->result['mediaId']));
        self::assertNotNull($done->expires_at);
    }

    public function test_new_publications_do_not_change_an_accepted_render(): void
    {
        $accepted = $this->accepted();
        $api = app(Templates::class);
        $template = Template::query()->firstOrFail();
        $draft = $api->saveDraft($template->id, Documents::standalone('Changed later'), 1);
        $api->publish($template->id, $draft->version);
        $api->renders()->process($accepted->id);
        $result = $api->renders()->result($accepted->id);
        self::assertSame($accepted->template_revision_id, $result->revisionId);
        self::assertStringContainsString('An experience for you', $result->html);
        self::assertStringNotContainsString('Changed later', $result->html);
    }

    public function test_revocation_is_terminal_and_does_not_write_an_artifact(): void
    {
        $accepted = $this->accepted();
        Template::query()->firstOrFail()->update(['status' => 'revoked']);
        $failed = app(Templates::class)->renders()->process($accepted->id);
        self::assertSame('failed', $failed->status);
        self::assertSame('invalid_render', $failed->error);
        self::assertNull($failed->result);
        self::assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_transient_failures_retry_the_same_snapshot_after_the_backoff(): void
    {
        $driver = new class implements DocumentCompiler
        {
            public int $calls = 0;

            public function compile(array $document, array $data, array $assets = []): array
            {
                if (++$this->calls === 1) {
                    throw new RetryableRenderException('compiler_unavailable');
                }

                return ['html' => '<p>'.$data['facts']['code'].'</p>', 'css' => ''];
            }
        };
        $accepted = $this->accepted($driver);
        $renders = app(Templates::class)->renders();
        self::assertSame('retrying', $renders->process($accepted->id)->status);
        self::assertSame(1, $renders->process($accepted->id)->attempts);
        $this->travel(11)->seconds();
        self::assertSame('completed', $renders->process($accepted->id)->status);
        self::assertSame(2, $driver->calls);
        self::assertStringContainsString('ACCEPTED', $renders->result($accepted->id)->html);
    }

    public function test_a_stale_processor_cannot_publish_or_leave_its_output_behind(): void
    {
        $driver = new class implements DocumentCompiler
        {
            public ?\Closure $during = null;

            public function compile(array $document, array $data, array $assets = []): array
            {
                ($this->during)();

                return ['html' => '<p>Stale</p>', 'css' => ''];
            }
        };
        $accepted = $this->accepted($driver);
        $driver->during = fn () => TemplateRender::query()->whereKey($accepted->id)->update(['generation' => 2, 'status' => 'pending', 'processing_token' => null]);
        $current = app(Templates::class)->renders()->process($accepted->id);
        self::assertSame('pending', $current->status);
        self::assertSame(2, $current->generation);
        self::assertNull($current->result);
        self::assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_private_output_read_checks_the_current_read_grant(): void
    {
        $request = $this->accepted();
        $renders = app(Templates::class)->renders();
        $renders->process($request->id);
        Gate::define('templates.read', fn () => false);
        $this->expectException(AuthorizationException::class);
        $renders->result($request->id);
    }
}
