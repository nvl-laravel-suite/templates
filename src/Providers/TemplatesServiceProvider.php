<?php

declare(strict_types=1);

namespace Nvl\Templates\Providers;

use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;
use Nvl\Media\Providers\MediaServiceProvider;
use Nvl\Ownership\Services\OwnershipAdoptionRegistry;
use Nvl\Support\Doctor\PackageDoctorContributor;
use Nvl\Support\OwnerRegistry;
use Nvl\Support\Ownership\Contracts\OwnershipIntegratedProvider;
use Nvl\Support\Ownership\Services\OwnershipResourceRegistry;
use Nvl\Support\Providers\SupportServiceProvider;
use Nvl\Support\Traits\MergesPackageConfiguration;
use Nvl\Templates\Console\Commands\PruneTemplateRenders;
use Nvl\Templates\Console\Commands\PublishTemplateFrontend;
use Nvl\Templates\Console\Commands\RecoverTemplateRenders;
use Nvl\Templates\Console\Commands\TemplatesDoctorCommand;
use Nvl\Templates\Contracts\ContextProvider;
use Nvl\Templates\Contracts\DnsResolver;
use Nvl\Templates\Contracts\RenderExecutionContext;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Ownership\TemplatesAdoptionAdapter;
use Nvl\Templates\Ownership\TemplatesResourceRegistrar;
use Nvl\Templates\Services\ConfiguredTemplateAuthorization;
use Nvl\Templates\Services\EmptyContextProvider;
use Nvl\Templates\Services\NativeDnsResolver;
use Nvl\Templates\Services\NativeRenderExecutionContext;
use Nvl\Templates\Services\TemplateModelRegistry;
use Nvl\Templates\Services\TemplateOperation;
use Nvl\Templates\Services\TemplatesDoctor;

/** Registers native document services, Media owners and opt-in publishable frontend. */
final class TemplatesServiceProvider extends ServiceProvider implements OwnershipIntegratedProvider
{
    use MergesPackageConfiguration;

    public function register(): void
    {
        $this->app->register(SupportServiceProvider::class);
        PackageDoctorContributor::register($this->app, 'nvl/templates', fn (): array => PackageDoctorContributor::booleanChecks(
            $this->app->make(TemplatesDoctor::class)->inspect()['checks'], 'nvl:templates:doctor',
        ));
        $this->app->register(MediaServiceProvider::class);
        $this->mergePackageConfiguration(__DIR__.'/../../config/nvl-templates.php', 'templates');
        $this->app->singleton(TemplateModelRegistry::class);
        $this->app->booting(fn () => $this->app->make(TemplateModelRegistry::class)->prepare());
        $this->app->scoped(TemplateOperation::class);
        $policy = config('nvl-templates.authorization.class', ConfiguredTemplateAuthorization::class);
        if (! is_string($policy) || ! is_a($policy, TemplateAuthorization::class, true)) {
            throw new InvalidArgumentException('Templates authorization must implement TemplateAuthorization.');
        }
        $this->app->bindIf(TemplateAuthorization::class, $policy);
        $this->app->bindIf(ContextProvider::class, function (Application $app): ContextProvider {
            $binding = config('nvl-templates.context_provider') ?: EmptyContextProvider::class;
            if (! is_string($binding)) {
                throw new InvalidArgumentException('Templates context_provider must name a container binding.');
            }
            $service = $app->make($binding);
            if (! $service instanceof ContextProvider) {
                throw new InvalidArgumentException('Templates context_provider must implement ContextProvider.');
            }

            return $service;
        });
        $this->app->bindIf(DnsResolver::class, NativeDnsResolver::class);
        $this->app->bindIf(RenderExecutionContext::class, function (Application $app): RenderExecutionContext {
            $binding = config('nvl-templates.render_context') ?: NativeRenderExecutionContext::class;
            if (! is_string($binding)) {
                throw new InvalidArgumentException('Templates render_context must name a container binding.');
            }
            $service = $app->make($binding);
            if (! $service instanceof RenderExecutionContext) {
                throw new InvalidArgumentException('Templates render_context must implement RenderExecutionContext.');
            }

            return $service;
        });
    }

    public function boot(OwnershipResourceRegistry $resources, OwnerRegistry $owners): void
    {
        $this->app->make(TemplatesResourceRegistrar::class)->register($resources);
        if ($this->app->bound(OwnershipAdoptionRegistry::class)) {
            $this->app->make(OwnershipAdoptionRegistry::class)->register('templates', TemplatesAdoptionAdapter::class);
        }
        $owners->registerPackage('nvl-template-asset', TemplateAsset::class, package: 'templates');
        $owners->registerPackage('nvl-template-render', TemplateRender::class, package: 'templates');
        $root = dirname(__DIR__, 2);
        if (config('nvl-templates.migrations.enabled', true)) {
            $this->loadMigrationsFrom($root.'/database/document-migrations');
        }
        $this->publishes([$root.'/resources/config/nvl-templates.php' => config_path('nvl-templates.php')], 'nvl-templates-config');
        $this->publishesMigrations([$root.'/database/document-migrations' => database_path('migrations')], 'nvl-templates-migrations');
        $this->publishes([$root.'/resources/boost/skills' => base_path('.agents/skills')], 'nvl-templates-skills');
        if ($this->app->runningInConsole()) {
            $this->commands([TemplatesDoctorCommand::class, RecoverTemplateRenders::class, PruneTemplateRenders::class, PublishTemplateFrontend::class]);
        }
    }
}
