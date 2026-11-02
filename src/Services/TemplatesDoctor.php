<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use InvalidArgumentException;
use Nvl\Media\Services\MediaModelRegistry;
use Nvl\Support\Ownership\Contracts\OwnershipReadiness;
use Nvl\Support\Schema\SchemaIdentities;
use Nvl\Support\Schema\SchemaShape;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Support\Compiler;
use Nvl\Templates\Support\Pdf;
use Nvl\Templates\Support\Scope;
use Throwable;

/**
 * Read-only native installation diagnostics; no principal admission or domain writes.
 *
 * @internal
 */
final readonly class TemplatesDoctor
{
    public function __construct(
        private TemplateModelRegistry $models,
        private TemplateAuthorization $authorization,
        private OwnershipReadiness $ownership,
    ) {}

    /** @return array{scope:string,healthy:bool,checks:array<string,bool>} */
    public function inspect(string $scope = 'all'): array
    {
        if (! in_array($scope, ['all', 'core', 'database'], true)) {
            throw new InvalidArgumentException('Templates Doctor scope must be all, core, or database.');
        }
        $checks = [];
        if ($scope !== 'database') {
            $checks['authorization.configured'] = ! $this->authorization instanceof ConfiguredTemplateAuthorization;
            $checks['limits'] = $this->limits();
            $disk = config('nvl-templates.media.disk') ?? config('nvl-media.private_disk');
            $checks['media.disk'] = is_string($disk) && $disk !== '' && is_array(config('filesystems.disks.'.$disk));
            $checks['compiler.configured'] = config('nvl-templates.compiler.driver') === null || Compiler::configured() !== null;
            $checks['pdf.configured'] = config('nvl-templates.pdf.driver') === null || Pdf::configured() !== null;
            $root = dirname(__DIR__, 2);
            $checks['frontend.bundle'] = is_file($root.'/resources/frontend-manifest.json')
                && is_file($root.'/resources/js/template-maker/index.ts') && is_file($root.'/resources/runtime/renderer.mjs');
        }
        if ($scope !== 'core') {
            $checks = [...$checks, ...$this->database()];
        }

        return ['scope' => $scope, 'healthy' => ! in_array(false, $checks, true), 'checks' => $checks];
    }

    private function limits(): bool
    {
        foreach (['document_bytes', 'output_bytes', 'preview_bytes', 'bindings', 'depth'] as $name) {
            $value = config('nvl-templates.limits.'.$name);
            if (! is_int($value) || $value < 1) {
                return false;
            }
        }

        return true;
    }

    /** @return array<string,bool> */
    private function database(): array
    {
        try {
            $model = $this->models->newInstance();
            $connection = $model->getConnection();
            $schema = $connection->getSchemaBuilder();
            $checks = ['media.same_connection' => $connection === MediaModelRegistry::newInstance()->getConnection()];
            $tables = SchemaIdentities::package('templates')['tables'] ?? [];
            $checks['database.document_contract'] = isset($tables['drafts'], $tables['group_revisions'], $tables['family_changes']);
            foreach ($tables as $key => $table) {
                try {
                    $name = Scope::table($key);
                    if (! $schema->hasTable($name)) {
                        $checks['database.'.$key] = false;

                        continue;
                    }
                    SchemaShape::assertCompatible($schema, $name, $table['columns'], $table['keys'], $table['foreign_keys']);
                    $checks['database.'.$key] = true;
                } catch (Throwable) {
                    $checks['database.'.$key] = false;
                }
            }
            if ($model::ownershipDefinition()->strategy !== 'unscoped') {
                try {
                    $this->ownership->assertActive('templates.templates');
                    $checks['ownership.active'] = true;
                } catch (Throwable) {
                    $checks['ownership.active'] = false;
                }
            }

            return $checks;
        } catch (Throwable) {
            return ['database.source' => false];
        }
    }
}
