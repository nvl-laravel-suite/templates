<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Nvl\Support\Ownership\ValueObjects\OwnershipJobEnvelope;
use Nvl\Templates\Exceptions\RenderUnavailable as GoneHttpException;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;
use Nvl\Templates\Tests\Support\MigratesInMemorySqlite;

final class RenderQueueTest extends TestCase
{
    use MigratesInMemorySqlite;

    protected function setUp(): void
    {
        parent::setUp();
        $this->migrateInMemorySqlite();
        config()->set('nvl-templates.rendering.queue.enabled', true);
        Storage::fake('local');
    }

    private function accepted(): TemplateRender
    {
        $api = app(Templates::class);
        $template = $api->createTemplate('queue', 'Queue');
        $draft = $api->saveDraft($template->id, Documents::standalone(), 0);
        $revision = $api->publish($template->id, $draft->version);

        return $api->renders()->accept($revision->id, facts: ['code' => 'PRIVATE-CODE'], idempotencyKey: 'queue-key');
    }

    public function test_dispatch_waits_for_the_outer_commit_and_serializes_only_identifiers(): void
    {
        Bus::fake();
        DB::beginTransaction();
        $request = $this->accepted();
        app(Templates::class)->renders()->dispatch($request->id);
        Bus::assertNothingDispatched();
        DB::commit();
        Bus::assertDispatched(RenderTemplateJob::class, function ($job) use ($request): bool {
            self::assertStringNotContainsString('PRIVATE-CODE', serialize($job));

            return $job->renderId === $request->id && $job->scope === 'app' && $job->generation === 1;
        });
    }

    public function test_rolling_back_acceptance_does_not_dispatch_a_job(): void
    {
        Bus::fake();
        DB::beginTransaction();
        $request = $this->accepted();
        app(Templates::class)->renders()->dispatch($request->id);
        DB::rollBack();
        Bus::assertNothingDispatched();
        self::assertSame(0, TemplateRender::query()->count());
    }

    public function test_recovery_does_not_enqueue_held_acceptances_or_interrupt_a_live_lease(): void
    {
        Bus::fake();
        $request = $this->accepted();
        $renders = app(Templates::class)->renders();
        self::assertSame(0, $renders->recover());
        $request->update(['status' => 'processing', 'processing_token' => (string) Str::uuid(), 'lease_expires_at' => now()->addMinute()]);
        self::assertSame(0, $renders->recover());
        Bus::assertNothingDispatched();
    }

    public function test_expired_acceptances_cannot_execute_before_the_pruner_runs(): void
    {
        $request = $this->accepted();
        $this->travel(8)->days();
        $expired = app(Templates::class)->renders()->process($request->id);
        self::assertSame('expired', $expired->status);
        self::assertSame(0, $expired->attempts);
        self::assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_a_failed_broker_handoff_leaves_acceptance_recoverable_without_leaking_errors(): void
    {
        $request = $this->accepted();
        Bus::shouldReceive('dispatch')->once()->andThrow(new \RuntimeException('secret://broker-password'));
        $renders = app(Templates::class)->renders();
        $renders->dispatch($request->id);
        self::assertSame('dispatch_unavailable', $renders->get($request->id)->error);
        Bus::fake();
        self::assertSame(1, $renders->recover());
        Bus::assertDispatched(RenderTemplateJob::class);
    }

    public function test_recovery_fences_expired_lease_deliveries_and_completes_the_same_snapshot(): void
    {
        $request = $this->accepted();
        $request->update(['status' => 'processing', 'attempts' => 1, 'generation' => 3,
            'processing_token' => (string) Str::uuid(), 'lease_expires_at' => now()->subSecond()]);
        Bus::fake();
        $renders = app(Templates::class)->renders();
        self::assertSame(1, $renders->recover());
        $current = $renders->get($request->id);
        self::assertGreaterThan(3, $current->generation);
        (new RenderTemplateJob($request->id, 'app', 3, OwnershipJobEnvelope::fromArray($request->snapshot['execution']['ownership'])))->handle();
        self::assertSame('pending', $renders->get($request->id)->status);
        (new RenderTemplateJob($request->id, 'app', $current->generation, OwnershipJobEnvelope::fromArray($request->snapshot['execution']['ownership'])))->handle();
        self::assertSame('completed', $renders->get($request->id)->status);
        self::assertSame(2, $renders->get($request->id)->attempts);
        self::assertStringContainsString('PRIVATE-CODE', $renders->result($request->id)->html);
    }

    public function test_expiration_removes_private_payloads_and_output_but_retains_the_idempotency_tombstone(): void
    {
        $request = $this->accepted();
        $renders = app(Templates::class)->renders();
        $renders->process($request->id);
        $this->travel(8)->days();
        self::assertSame(1, $renders->prune());
        $expired = $renders->get($request->id);
        self::assertSame('expired', $expired->status);
        self::assertNull($expired->snapshot);
        self::assertNull($expired->result);
        self::assertSame('queue-key', $expired->idempotency_key);
        self::assertSame([], Storage::disk('local')->allFiles());
        $this->expectException(GoneHttpException::class);
        $renders->result($request->id);
    }
}
