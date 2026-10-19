<?php

declare(strict_types=1);
use Illuminate\Contracts\Console\Kernel;
use Nvl\Content\Providers\ContentServiceProvider;
use Nvl\Data\Providers\DataServiceProvider;
use Nvl\Filterable\Providers\FilterableServiceProvider;
use Nvl\Media\Providers\MediaServiceProvider;
use Nvl\Ownership\Providers\OwnershipServiceProvider;
use Nvl\Ownership\Services\OwnershipRunner;
use Nvl\Support\Ownership\Contracts\OwnershipContext;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Support\Providers\SupportServiceProvider;
use Nvl\Templates\Actions\CreateTemplateVersionAction;
use Nvl\Templates\Data\Mutations\CreateTemplateVersionData;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Tests\Fixtures\OwnershipActor;
use Nvl\Templates\Tests\Fixtures\OwnershipCompany;
use Nvl\Templates\Tests\Fixtures\OwnershipWorkerProvider;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\Foundation\Application;

require dirname(__DIR__, 5).'/vendor/autoload.php';
$source = json_decode($argv[1], true, flags: JSON_THROW_ON_ERROR);
$options = json_decode($argv[2], true, flags: JSON_THROW_ON_ERROR);
if (! is_array($source) || ($source['driver'] ?? null) !== 'pgsql'
    || ! is_string($source['database'] ?? null) || preg_match('/^nvl_own_test_[a-z0-9_]+$/D', $source['database']) !== 1
    || ! is_array($options) || ! is_string($options['root'] ?? null)) {
    throw new RuntimeException('Template workers require a dedicated native persistence source.');
}
$sourceConfiguration = [];
foreach ($source as $sourceKey => $sourceValue) {
    if (! is_string($sourceKey)) {
        throw new RuntimeException('Native source configuration requires named keys.');
    }
    $sourceConfiguration[$sourceKey] = $sourceValue;
}
OwnershipWorkerProvider::$source = $sourceConfiguration;
OwnershipWorkerProvider::$root = $options['root'];
$app = Application::create(options: ['load_environment_variables' => false, 'extra' => ['dont-discover' => ['*'], 'providers' => [
    LocaleServiceProvider::class, SupportServiceProvider::class,
    DataServiceProvider::class, FilterableServiceProvider::class,
    TranslatableServiceProvider::class, OwnershipServiceProvider::class,
    MediaServiceProvider::class, ContentServiceProvider::class,
    TemplatesServiceProvider::class, OwnershipWorkerProvider::class,
]]]);
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();
if (($options['mode'] ?? 'queue') === 'version') {
    if (! is_string($options['ready'] ?? null) || ! is_string($options['gate'] ?? null) || ! is_string($options['template'] ?? null)) {
        throw new RuntimeException('Invalid native race options.');
    }
    file_put_contents($options['ready'], 'ready');
    $deadline = microtime(true) + 15;
    while (file_get_contents($options['gate']) !== 'go') {
        if (microtime(true) > $deadline) {
            throw new RuntimeException('Template race barrier timed out.');
        }usleep(10000);
    }
    $version = $app->make(OwnershipRunner::class)->run(OwnershipCompany::findOrFail(7), OwnershipActor::firstOrFail(), fn () => $app->make(CreateTemplateVersionAction::class)->execute($options['template'], CreateTemplateVersionData::from(['metadata' => []]), TemplateActorData::system()));
    fwrite(STDOUT, (string) $version->version);
} else {
    $status = $kernel->call('queue:work', ['connection' => 'database', '--stop-when-empty' => true, '--sleep' => 0, '--tries' => 1, '--timeout' => 10, '--force' => true, '--no-interaction' => true]);
    if ($status !== 0) {
        fwrite(STDERR, $kernel->output());
        exit($status);
    }
    fwrite(STDOUT, $app->make(OwnershipContext::class)->snapshot()->mode->value);
}
