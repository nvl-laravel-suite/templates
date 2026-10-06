<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\View\Factory;
use Illuminate\Support\Facades\Schema;
use Mpdf\Mpdf;
use Nvl\Content\Content;
use Nvl\Support\Config\PackageOptions;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Data\TemplateActorData;
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Rendering\MpdfTemplateRenderer;
use Nvl\Templates\Rendering\UnavailablePdfTemplateRenderer;
use Nvl\Templates\Support\TemplatesConfiguration;
use Nvl\Templates\Support\TemplatesSchemaContract;

/**
 * Performs non-mutating core, database, route, and queue diagnostics.
 */
final class TemplatesDoctor
{
    /** Initialize the package-owned inspection dependencies. */
    public function __construct(
        private TemplateAuthorization $authorization,
        private TemplateDefinitionRegistry $definitions,
        private TemplateRendererRegistry $renderers,
        private TemplateOwnerRegistry $owners,
        private PdfTemporaryDirectoryResolver $temporaryDirectories,
        private Factory $views,
        private Content $content,
    ) {}

    /**
     * Inspect package readiness without rendering a command or changing state.
     *
     * @return array<string, mixed>
     */
    public function inspect(string $scope = 'all'): array
    {
        $authorization = $this->authorization;
        $definitions = $this->definitions;
        $renderers = $this->renderers;
        $owners = $this->owners;
        $temporaryDirectories = $this->temporaryDirectories;
        $views = $this->views;
        $content = $this->content;

        $canonicalJson = new CanonicalJson;
        $required = [];
        $registeredRenderers = array_keys($renderers->all());
        $pdfSelected = $this->builtInPdfSelected($definitions, $renderers);
        $pdfAvailable = (new TemplatePdfDependencyGuard)->available();

        if ($scope === 'all' || $scope === 'core') {
            $required = [
                ...$required,
                ...$this->coreChecks(
                    $definitions,
                    $registeredRenderers,
                    $temporaryDirectories,
                    $views,
                ),
            ];
        }

        if ($scope === 'all' || $scope === 'database') {
            $required = [
                ...$required,
                ...$this->databaseChecks($definitions, $content, $canonicalJson),
            ];
        }

        $checks = [
            'scope' => $scope,
            ...$required,
            'authorization' => $authorization::class,
            'renderers' => $registeredRenderers,
            'definitions' => array_keys($definitions->all()),
            'owners' => $owners->aliases(),
            'management_routes' => (bool) config(
                'nvl-templates.routes.management.enabled',
                false,
            ),
            'render_routes' => (bool) config(
                'nvl-templates.routes.render.enabled',
                false,
            ),
            'queue' => PackageOptions::queueName('templates'),
            'pdf.version' => $pdfAvailable ? Mpdf::VERSION : null,
            'dependencies.pdf' => [
                'severity' => $pdfSelected ? 'error' : 'info',
                'passed' => ! $pdfSelected || $pdfAvailable,
                'message' => $pdfSelected
                    ? ($pdfAvailable ? 'The selected built-in PDF renderer dependencies are available.' : 'Install mpdf/mpdf:^8.3.0 and its extensions before selecting the built-in PDF renderer.')
                    : 'The built-in PDF capability is inactive; mPDF is optional.',
            ],
            'pdf.remote_assets' => (bool) config(
                'nvl-templates.pdf.remote_assets.enabled',
                false,
            ),
        ];
        $healthy = ! in_array(false, $required, true) && (! $pdfSelected || $pdfAvailable);
        $checks['healthy'] = $healthy;

        return $checks;
    }

    /**
     * @param  list<string>  $registeredRenderers
     * @return array<string, bool>
     */
    private function coreChecks(
        TemplateDefinitionRegistry $definitions,
        array $registeredRenderers,
        PdfTemporaryDirectoryResolver $temporaryDirectories,
        Factory $views,
    ): array {
        $defaultRenderer = config('nvl-templates.default_renderer', 'blade');
        $pdfSelected = $this->builtInPdfSelected($definitions, $this->renderers);

        return [
            'renderer.default' => is_string($defaultRenderer)
                && in_array($defaultRenderer, $registeredRenderers, true),
            'renderer.blade' => in_array('blade', $registeredRenderers, true),
            'renderer.pdf' => ! $pdfSelected || in_array('pdf', $registeredRenderers, true),
            'view.default.blade' => $this->configuredDefaultViewExists($views, 'blade'),
            'view.default.pdf' => ! $pdfSelected || $this->configuredDefaultViewExists($views, 'pdf'),
            'views.definitions' => $this->definitionViewsExist($definitions, $views),
            'pdf.temp_path' => ! $pdfSelected || $temporaryDirectories->isSafe(),
            'limits' => $this->limitsAreValid(),
        ];
    }

    /** Identify actual selections of the built-in PDF implementation without resolving renderers. */
    private function builtInPdfSelected(TemplateDefinitionRegistry $definitions, TemplateRendererRegistry $renderers): bool
    {
        $selected = [config('nvl-templates.default_renderer', 'blade')];
        foreach ($definitions->all() as $definition) {
            $selected[] = $definition->renderer;
        }
        $classes = $renderers->all();
        foreach ($selected as $alias) {
            if (is_string($alias) && in_array($classes[$alias] ?? null, [MpdfTemplateRenderer::class, UnavailablePdfTemplateRenderer::class], true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, bool>
     */
    private function databaseChecks(
        TemplateDefinitionRegistry $definitions,
        Content $content,
        CanonicalJson $canonicalJson,
    ): array {
        $schema = Schema::connection(TemplatesConfiguration::connection());
        $checks = [];

        foreach (array_keys(TemplatesSchemaContract::tables()) as $key) {
            $table = TemplatesConfiguration::table($key);
            $logicalKey = match ($key) {
                TemplatesTables::get(TemplatesTables::Templates) => 'templates',
                TemplatesTables::get(TemplatesTables::I18n) => 'templates_i18n',
                TemplatesTables::get(TemplatesTables::Versions) => 'template_versions',
                TemplatesTables::get(TemplatesTables::Assignments) => 'template_assignments',
                TemplatesTables::get(TemplatesTables::Renders) => 'template_renders',
                TemplatesTables::get(TemplatesTables::TenantGrants) => 'template_tenant_grants',
                TemplatesTables::get(TemplatesTables::TenantGrantLocks) => 'template_tenant_grant_locks',
                default => $key,
            };
            $checks["table.{$logicalKey}"] = $schema->hasTable($table);
            $issues = $checks["table.{$logicalKey}"]
                ? TemplatesSchemaContract::issues($schema, $key)
                : ['columns' => ['table missing'], 'indexes' => ['table missing'], 'constraints' => ['table missing']];
            $checks["columns.{$logicalKey}.canonical"] = $issues['columns'] === [];
            $checks["indexes.{$logicalKey}.canonical"] = $issues['indexes'] === [];
            $checks["constraints.{$logicalKey}.canonical"] = $issues['constraints'] === [];
        }

        $renderTable = TemplatesConfiguration::table(TemplatesTables::get(TemplatesTables::Renders));
        $checks['columns.template_renders.durable'] = $checks['table.template_renders']
            && $schema->hasColumns($renderTable, [
                'processing_token',
                'lease_expires_at',
                'failed_at',
                'profile',
                'settings',
                'dispatch_generation',
            ]);
        $tablesHealthy = ! in_array(false, $checks, true);
        $checks['definitions.synchronized'] = $tablesHealthy
            && $this->definitionsAreSynchronized($definitions, $canonicalJson);
        $checks['definitions.content'] = $this->contentDefinitionsAreRegistered(
            $definitions,
            $content,
        );
        $checks['queue.configuration'] = $this->queueConfigurationIsValid();
        $checks['queue.retry_after'] = $this->queueRetryAfterIsSafe();
        $checks['output.disk'] = $this->outputDiskIsConfigured();

        return $checks;
    }

    private function limitsAreValid(): bool
    {
        foreach ([
            'schema_bytes',
            'schema_depth',
            'schema_items',
            'data_bytes',
            'data_depth',
            'data_items',
            'renderer_options_bytes',
            'renderer_options_depth',
            'renderer_options_items',
            'payload_bytes',
            'payload_depth',
            'payload_items',
            'settings_bytes',
            'metadata_bytes',
            'per_page',
            'maximum_per_page',
            'output_bytes',
        ] as $key) {
            $value = config("nvl-templates.limits.{$key}");

            if (! is_int($value) || $value < 1) {
                return false;
            }
        }

        $perPage = config('nvl-templates.limits.per_page');
        $maximumPerPage = config('nvl-templates.limits.maximum_per_page');

        return is_int($perPage)
            && is_int($maximumPerPage)
            && $perPage <= $maximumPerPage;
    }

    private function configuredDefaultViewExists(
        Factory $views,
        string $renderer,
    ): bool {
        $view = config("nvl-templates.views.defaults.{$renderer}");

        return is_string($view) && $views->exists($view);
    }

    private function definitionViewsExist(
        TemplateDefinitionRegistry $definitions,
        Factory $views,
    ): bool {
        foreach ($definitions->all() as $definition) {
            if (! $views->exists($definition->view)) {
                return false;
            }
        }

        return true;
    }

    private function contentDefinitionsAreRegistered(
        TemplateDefinitionRegistry $definitions,
        Content $content,
    ): bool {
        $available = $content->definitions(
            TemplateActorData::system()->contentActor(),
        )->pluck('key')->all();

        foreach ($definitions->all() as $definition) {
            foreach ($definition->allowedContentDefinitions as $key) {
                if (! in_array($key, $available, true)) {
                    return false;
                }
            }
        }

        return true;
    }

    private function definitionsAreSynchronized(
        TemplateDefinitionRegistry $definitions,
        CanonicalJson $canonicalJson,
    ): bool {
        $registered = $definitions->all();
        $stored = Template::query()->get()->keyBy('key');

        foreach ($registered as $key => $definition) {
            $template = $stored->get($key);

            if (! $template instanceof Template
                || $template->renderer !== $definition->renderer
                || $canonicalJson->digest($template->schema)
                    !== $canonicalJson->digest($definition->schema)
                || $template->status === TemplateStatus::Archived) {
                return false;
            }
        }

        foreach ($stored as $key => $template) {
            if (! array_key_exists((string) $key, $registered)
                && $template->status !== TemplateStatus::Archived) {
                return false;
            }
        }

        return true;
    }

    private function queueConfigurationIsValid(): bool
    {
        $tries = config('nvl-templates.rendering.tries');
        $timeout = config('nvl-templates.rendering.timeout');
        $lease = config('nvl-templates.rendering.lease_seconds');
        $uniqueFor = config('nvl-templates.rendering.unique_for');
        $pendingRecovery = config('nvl-templates.rendering.pending_recovery_seconds');
        $batchSize = config('nvl-templates.rendering.recovery_batch_size');
        $backoff = config('nvl-templates.rendering.backoff');

        if (! is_int($tries)
            || $tries < 1
            || ! is_int($timeout)
            || $timeout < 1
            || ! is_int($lease)
            || $lease <= $timeout
            || ! is_int($uniqueFor)
            || $uniqueFor < $lease
            || ! is_int($pendingRecovery)
            || $pendingRecovery <= $uniqueFor
            || ! is_int($batchSize)
            || $batchSize < 1
            || ! is_array($backoff)
            || $backoff === []) {
            return false;
        }

        foreach ($backoff as $delay) {
            if (! is_int($delay) || $delay < 1) {
                return false;
            }
        }

        return true;
    }

    private function queueRetryAfterIsSafe(): bool
    {
        $connection = PackageOptions::queueConnection('templates');

        $retryAfter = config("queue.connections.{$connection}.retry_after");
        $timeout = config('nvl-templates.rendering.timeout');

        return $retryAfter === null
            || (is_int($retryAfter)
                && is_int($timeout)
                && $retryAfter > $timeout);
    }

    private function outputDiskIsConfigured(): bool
    {
        if (! (bool) config('nvl-templates.rendering.output.persist', true)) {
            return true;
        }

        $disk = config('nvl-templates.rendering.output.disk');

        return is_string($disk)
            && $disk !== ''
            && is_array(config("filesystems.disks.{$disk}"));
    }
}
