<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;

final class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_host_authorization_is_required_for_management(): void
    {
        Gate::define('templates.manage', fn (?Authenticatable $user) => false);
        $this->expectException(AuthorizationException::class);
        app(Templates::class)->createTemplate('forbidden', 'Forbidden');
    }

    public function test_render_permission_is_rechecked_on_each_operation(): void
    {
        $api = app(Templates::class);
        $t = $api->createTemplate('booking', 'Booking');
        $d = $api->saveDraft($t->id, Documents::standalone(), 0);
        $r = $api->publish($t->id, $d->version);
        Gate::define('templates.render', fn (?Authenticatable $user) => false);
        $this->expectException(AuthorizationException::class);
        $api->render($r->id, facts: ['code' => 'ABC']);
    }

    public function test_revoked_template_does_not_render_an_existing_release(): void
    {
        $api = app(Templates::class);
        $t = $api->createTemplate('booking', 'Booking');
        $d = $api->saveDraft($t->id, Documents::standalone(), 0);
        $r = $api->publish($t->id, $d->version);
        $t->update(['status' => 'revoked']);
        $this->expectException(ValidationException::class);
        $api->render($r->id, facts: ['code' => 'ABC']);
    }
}
