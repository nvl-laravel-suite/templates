<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Nvl\Content\Providers\ContentServiceProvider;
use Nvl\Filterable\Providers\FilterableServiceProvider;
use Nvl\Media\Contracts\MediaAuthorization;
use Nvl\Media\Providers\MediaServiceProvider;
use Nvl\Media\Services\MediaAccessService;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Rendering\BladeTemplateRenderer;
use Nvl\Templates\Rendering\MpdfTemplateRenderer;
use Nvl\Templates\Tests\Fixtures\AllowMediaAuthorization;
use Nvl\Templates\Tests\Fixtures\AllowTemplateAuthorization;
use Nvl\Templates\Tests\Fixtures\Compatibility\Pdf\Contracts\PdfServiceInterface;
use Nvl\Templates\Tests\Fixtures\Compatibility\Pdf\PdfService;
use Nvl\Templates\Tests\Fixtures\TestTemplateOwnerResolver;
use Nvl\Templates\Tests\Fixtures\TestTemplateRenderer;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;
use Spatie\LaravelData\LaravelDataServiceProvider as DataServiceProvider;

/**
 * Boots Templates and only its declared runtime dependencies.
 */
abstract class TestCase extends Orchestra
{
    use RefreshDatabase;

    /**
     * @return list<class-string>
     */
    protected function getPackageProviders($app): array
    {
        return [
            LocaleServiceProvider::class,
            DataServiceProvider::class,
            FilterableServiceProvider::class,
            TranslatableServiceProvider::class,
            MediaServiceProvider::class,
            ContentServiceProvider::class,
            TemplatesServiceProvider::class,
        ];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set([
            'cache.default' => 'array',
            'nvl-templates.integrations.content' => true,
            'nvl-templates.rendering.output.persist' => true,
            'nvl-templates.authorization.class' => AllowTemplateAuthorization::class,
            'filesystems.default' => 'public',
            'nvl-media.disk' => 'public',
            'nvl-media.routes.assets_enabled' => false,
            'nvl-content.media.enabled' => true,
            'nvl-content.authorization.callback' => static fn (): bool => true,
            'nvl-content.locales.available' => ['en', 'bg'],
            'nvl-translatable.locales' => ['en', 'bg'],
            'nvl-content.locales.required_on_publish' => ['en'],
            'nvl-content.definitions' => [
                'template-copy' => [
                    'name' => 'Template copy',
                    'category' => 'templates',
                    'version' => 1,
                    'allowed_regions' => ['main', 'header', 'footer'],
                    'schema' => [
                        'fields' => [
                            [
                                'key' => 'text',
                                'type' => 'text',
                                'label' => 'Text',
                                'localized' => true,
                            ],
                            [
                                'key' => 'heading',
                                'type' => 'text',
                                'label' => 'Heading',
                                'localized' => true,
                            ],
                            [
                                'key' => 'subject',
                                'type' => 'text',
                                'label' => 'Subject',
                                'localized' => true,
                            ],
                            [
                                'key' => 'logo',
                                'type' => 'media',
                                'label' => 'Logo',
                                'settings' => ['mime_types' => ['image/png']],
                            ],
                        ],
                    ],
                ],
            ],
            'nvl-templates.renderers' => [
                'blade' => BladeTemplateRenderer::class,
                'test' => TestTemplateRenderer::class,
                'pdf' => MpdfTemplateRenderer::class,
            ],
            'nvl-templates.definitions' => [
                'welcome' => [
                    'renderer' => 'test',
                    'view' => 'template-tests::core',
                    'profiles' => ['default'],
                    'schema' => ['name' => ['type' => 'string']],
                    'subject_path' => 'body.subject',
                    'required_regions' => ['main'],
                    'allowed_content_definitions' => ['template-copy'],
                ],
                'pdf-report' => [
                    'renderer' => 'pdf',
                    'view' => 'template-tests::pdf',
                    'profiles' => ['default'],
                    'schema' => [
                        'type' => 'object',
                        'properties' => [
                            'name' => [
                                'type' => 'string',
                                'minLength' => 1,
                                'maxLength' => 100,
                            ],
                        ],
                        'required' => ['name'],
                        'additionalProperties' => false,
                    ],
                    'renderer_options' => [
                        'page_size' => 'A4',
                        'orientation' => 'portrait',
                        'filename' => 'report.pdf',
                    ],
                    'subject_path' => 'body.subject',
                    'required_regions' => ['main'],
                    'allowed_content_definitions' => ['template-copy'],
                ],
            ],
            'nvl-templates.owners' => ['member' => TestTemplateOwnerResolver::class],
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->app->forgetInstance(MediaAccessService::class);
        $this->app->bind(PdfServiceInterface::class, PdfService::class);
        $this->app->bind(MediaAuthorization::class, AllowMediaAuthorization::class);
        $this->app->bind(TemplateAuthorization::class, AllowTemplateAuthorization::class);

        $this->app['view']->addNamespace(
            'template-tests',
            __DIR__.'/Fixtures/views',
        );
    }

    protected function defineDatabaseMigrationsAfterDatabaseRefreshed(): void
    {
        Schema::create('template_test_owners', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->timestamps();
        });
    }
}
