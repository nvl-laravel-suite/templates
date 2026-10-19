<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Config\Repository;
use Illuminate\Contracts\View\Factory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\ServiceProvider;
use Nvl\Ownership\Contracts\OwnerAccess;
use Nvl\Support\Ownership\Exceptions\OwnershipViolation;
use Nvl\Support\Ownership\Services\OwnershipResourceRegistry;
use Nvl\Support\Ownership\ValueObjects\OwnershipResourceDefinition;

/** Reconstructs the exact producer graph in an independent native worker. */
final class OwnershipWorkerProvider extends ServiceProvider
{
    /** @var array<string,mixed> */
    public static array $source = [];

    public static string $root = '';

    public function register(): void
    {
        $this->app->make(Repository::class)->set([
            'database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'nvl-core.owners' => [OwnershipCompany::class, OwnershipActor::class],
            'nvl-ownership.enabled' => true, 'nvl-ownership.migrations.enabled' => false,
            'nvl-ownership.central_operations' => ['content-definitions', 'templates-maintain'],
            'nvl-tenancy.enabled' => false,
            'nvl-content.models.block' => OwnershipContentBlock::class,
            'nvl-content.ownership.owner_resources' => ['fixture.template-hosts', 'templates.versions'],
            'nvl-content.authorization.callback' => static fn (): bool => true,
            'nvl-content.locales.available' => ['en', 'bg'],
            'nvl-content.locales.required_on_publish' => ['en'],
            'nvl-content.owners' => ['subjects' => OwnershipTemplateHost::class],
            'nvl-content.definitions' => ['copy' => ['name' => 'Copy', 'version' => 1, 'allowed_regions' => ['main'], 'schema' => ['fields' => [['key' => 'text', 'type' => 'text', 'label' => 'Text', 'localized' => true]]]]],
            'nvl-templates.ownership.owner_resources' => ['member' => 'fixture.template-hosts'],
            'nvl-templates.models.template' => OwnershipTemplate::class,
            'nvl-templates.migrations.enabled' => false,
            'nvl-templates.authorization.callback' => static fn (): bool => true,
            'nvl-templates.owners' => ['member' => OwnershipTemplateOwnerResolver::class],
            'nvl-templates.renderers' => ['test' => TestTemplateRenderer::class],
            'nvl-templates.definitions' => ['welcome' => ['renderer' => 'test', 'view' => 'template-tests::core', 'profiles' => ['default'], 'schema' => ['name' => ['type' => 'string']], 'required_regions' => ['main'], 'allowed_content_definitions' => ['copy']]],
            'nvl-media.models.media' => OwnershipMedia::class,
            'nvl-media.migrations.enabled' => false,
            'nvl-translatable.locales' => ['en', 'bg'],
            'nvl-comments.moderation.new_status' => 'approved',
            'nvl-comments.mutation_lock.enabled' => false,
            'nvl-content.migrations.enabled' => false,
            'nvl-media.deduplication_lock.store' => 'array',
            'nvl-media.routes.api_enabled' => false,
            'auth.providers.users.model' => OwnershipActor::class,
        ]);
        $this->app->make(Repository::class)->set('nvl-templates.definitions.other', $this->app->make(Repository::class)->get('nvl-templates.definitions.welcome'));

        $this->app->make(Repository::class)->set([
            'database.connections.sqlite' => self::$source,
            'app.key' => 'base64:'.base64_encode(str_repeat('k', 32)),
            'queue.default' => 'database', 'nvl-templates.rendering.connection' => 'database',
            'queue.connections.database.connection' => 'sqlite',
            'queue.failed' => ['driver' => 'database-uuids', 'database' => 'sqlite', 'table' => 'failed_jobs'],
            'cache.default' => 'database', 'cache.stores.database.connection' => 'sqlite', 'cache.stores.database.lock_connection' => 'sqlite',
            'cache.stores.database.table' => 'cache', 'cache.stores.database.lock_table' => 'cache_locks',
            'filesystems.disks.local' => ['driver' => 'local', 'root' => self::$root, 'throw' => true],
            'nvl-templates.rendering.output.disk' => 'local',
        ]);
        $this->app->bind(OwnerAccess::class, static fn () => new class implements OwnerAccess
        {
            public function assertCanEnter(Authenticatable $actor, Model $owner): void
            {
                if (! $actor instanceof OwnershipActor || $actor->getAuthIdentifier() !== 1 || ! $owner instanceof OwnershipCompany) {
                    throw new OwnershipViolation;
                }
            }
        });
    }

    public function boot(): void
    {
        $this->app->make(Factory::class)->addNamespace('template-tests', __DIR__.'/views');
        $this->app->make(OwnershipResourceRegistry::class)->register(new OwnershipResourceDefinition('fixture.template-hosts', 'fixture', OwnershipTemplateHost::class, OwnershipTemplateHost::ownershipDefinition()));
    }
}
