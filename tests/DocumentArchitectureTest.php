<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests;

use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Content\Providers\ContentServiceProvider;
use Nvl\Media\Providers\MediaServiceProvider;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;

final class DocumentArchitectureTest extends TestCase
{
    protected function getPackageProviders($app): array
    {
        return [LocaleServiceProvider::class, TranslatableServiceProvider::class, MediaServiceProvider::class, TemplatesServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite.database', ':memory:');
        $app['config']->set('nvl-templates.integrations.content', false);
    }

    public function test_document_lifecycle_publishes_and_personalizes_without_a_code_definition_or_content(): void
    {
        $this->app->instance(TemplateAuthorization::class, new class implements TemplateAuthorization
        {
            public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void {}
        });
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $lifecycle = $this->app->make(TemplateLifecycle::class);
        $template = $lifecycle->create(['key' => 'document-native', 'name' => 'Document native'], SystemActor::Background);
        $document = json_decode(file_get_contents(__DIR__.'/Fixtures/document-bindings.json'), true, flags: JSON_THROW_ON_ERROR);
        $draft = $lifecycle->saveDraft($template->id, $document, 0, SystemActor::Background);
        $version = $lifecycle->publish($template->id, $draft->version, SystemActor::Background);
        $result = $this->app->make(TemplateRenderer::class)->render($version->id, [
            'facts' => ['code' => 'NVL-NATIVE'], 'inputs' => ['message' => 'Hello <native>'],
        ], SystemActor::Background);
        self::assertStringContainsString('Hello &lt;native&gt;', $result['html']);
        self::assertStringContainsString('NVL-NATIVE', $result['html']);
        self::assertFalse($this->app->providerIsLoaded(ContentServiceProvider::class));
    }
}
