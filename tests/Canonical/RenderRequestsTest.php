<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Nvl\Templates\Exceptions\RenderConflict;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;

final class RenderRequestsTest extends TestCase
{
    use RefreshDatabase;

    private function revision(): string
    {
        $api = app(Templates::class);
        $template = $api->createTemplate('request', 'Request');
        $draft = $api->saveDraft($template->id, Documents::standalone(), 0);

        return $api->publish($template->id, $draft->version)->id;
    }

    public function test_acceptance_freezes_resolved_values_and_encrypts_the_snapshot(): void
    {
        $request = app(Templates::class)->renders()->accept($this->revision(), facts: ['code' => 'PRIVATE-CODE'], inputs: ['message' => 'Private message']);

        self::assertSame('pending', $request->status);
        self::assertSame('Private message', $request->snapshot['prepared']['data']['inputs']['message']);
        self::assertSame(16, $request->snapshot['prepared']['data']['settings']['fontSize']);
        self::assertStringNotContainsString('PRIVATE-CODE', DB::table(config('nvl-templates.tables.renders'))->where('id', $request->id)->value('snapshot'));
        self::assertArrayNotHasKey('snapshot', $request->toArray());
        self::assertSame(0, $request->attempts);
    }

    public function test_idempotent_replays_reuse_one_request_and_changed_payloads_conflict(): void
    {
        $renders = app(Templates::class)->renders();
        $revision = $this->revision();
        $first = $renders->accept($revision, facts: ['code' => 'ABC'], idempotencyKey: 'voucher-1');
        $same = $renders->accept($revision, facts: ['code' => 'ABC'], settings: ['fontSize' => 16], idempotencyKey: 'voucher-1');
        self::assertSame($first->id, $same->id);
        self::assertSame(1, TemplateRender::query()->count());

        $this->expectException(RenderConflict::class);
        $renders->accept($revision, facts: ['code' => 'CHANGED'], idempotencyKey: 'voucher-1');
    }

    public function test_acceptance_checks_runtime_schema_and_current_release_authorization(): void
    {
        $revision = $this->revision();
        Gate::define('templates.render', fn () => false);

        $this->expectException(AuthorizationException::class);
        app(Templates::class)->renders()->accept($revision, facts: ['code' => 'ABC']);
    }

    public function test_scope_is_part_of_the_request_identity_and_lookup_boundary(): void
    {
        $renders = app(Templates::class)->renders();
        $first = $renders->accept($this->revision(), facts: ['code' => 'ABC'], idempotencyKey: 'same-key');
        config()->set('nvl-templates.scope', 'second-app');
        $second = $renders->accept($this->revision(), facts: ['code' => 'ABC'], idempotencyKey: 'same-key');
        self::assertNotSame($first->id, $second->id);
        self::assertSame(1, TemplateRender::query()->count());
        $this->expectException(ModelNotFoundException::class);
        $renders->get($first->id);
    }

    public function test_host_request_identity_freezes_business_fields_outside_the_template_values(): void
    {
        $requests = app(Templates::class)->renders();
        $revision = $this->revision();
        $identity = hash('sha256', 'envelope-one');
        $first = $requests->accept($revision, facts: ['code' => 'ABC'], idempotencyKey: 'business-key', requestIdentity: $identity);
        self::assertSame($first->id, $requests->accept($revision, facts: ['code' => 'ABC'], idempotencyKey: 'business-key', requestIdentity: $identity)->id);
        $this->expectException(RenderConflict::class);
        $requests->accept($revision, facts: ['code' => 'ABC'], idempotencyKey: 'business-key', requestIdentity: hash('sha256', 'envelope-two'));
    }
}
