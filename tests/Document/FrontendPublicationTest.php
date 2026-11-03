<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document;

use Illuminate\Filesystem\Filesystem;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class FrontendPublicationTest extends TestCase
{
    private string $sandbox;

    protected function getPackageProviders($app): array
    {
        return [LocaleServiceProvider::class, TranslatableServiceProvider::class, TemplatesServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $this->sandbox = realpath(sys_get_temp_dir()).'/nvl-template-publication-'.bin2hex(random_bytes(8));
        (new Filesystem)->ensureDirectoryExists($this->sandbox.'/config');
        $app->setBasePath($this->sandbox);
        $app->useConfigPath($this->sandbox.'/config');
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite.database', ':memory:');
    }

    protected function tearDown(): void
    {
        try {
            if (isset($this->sandbox)) {
                (new Filesystem)->deleteDirectory($this->sandbox);
            }
        } finally {
            parent::tearDown();
        }
    }

    public function test_both_default_configs_name_the_final_component_directory(): void
    {
        foreach (['config', 'resources/config'] as $directory) {
            $config = require dirname(__DIR__, 2).'/'.$directory.'/nvl-templates.php';
            self::assertSame(resource_path('js/components/template-maker'), $config['frontend']['path']);
        }
    }

    public function test_published_config_can_choose_an_exact_app_relative_component_directory(): void
    {
        $this->artisan('vendor:publish', ['--tag' => 'nvl-templates-config', '--no-interaction' => true])->assertSuccessful();
        $path = config_path('nvl-templates.php');
        self::assertFileExists($path);
        $config = require $path;
        $config['frontend']['path'] = 'resources/js/features/correspondence';
        file_put_contents($path, '<?php return '.var_export($config, true).';');
        $this->app['config']->set('nvl-templates', require $path);

        $this->artisan('nvl:templates:frontend:publish')->assertSuccessful();

        $destination = resource_path('js/features/correspondence');
        $this->assertCompletePublication($destination);
        self::assertDirectoryDoesNotExist($destination.'/template-maker');
    }

    public function test_published_migrations_keep_timestamp_updates_and_document_bytes(): void
    {
        $this->travelTo('2031-01-02 03:04:05 UTC');
        $this->artisan('vendor:publish', ['--tag' => 'nvl-templates-migrations', '--no-interaction' => true])->assertSuccessful();

        $files = (new Filesystem)->files(database_path('migrations'));
        self::assertSame([
            '2031_01_02_030406_nvl_templates_create_document_graph.php',
            '2031_01_02_030407_nvl_templates_add_family_workflows.php',
            '2031_01_02_030408_nvl_templates_add_render_execution.php',
        ], array_map(static fn ($file): string => $file->getFilename(), $files));
        foreach ($files as $file) {
            $sources = glob(dirname(__DIR__, 2).'/database/document-migrations/*'.substr($file->getFilename(), 18));
            self::assertCount(1, $sources);
            self::assertSame(file_get_contents($sources[0]), $file->getContents());
        }
    }

    public function test_absolute_destination_receives_the_complete_tree_directly_and_can_be_republished(): void
    {
        $destination = $this->destination();
        $this->artisan('nvl:templates:frontend:publish')->assertSuccessful();
        $this->assertCompletePublication($destination);
        $this->artisan('nvl:templates:frontend:publish')->expectsOutput('0 frontend files published.')->assertSuccessful();
    }

    public function test_posix_drive_shaped_paths_stay_relative_to_the_app(): void
    {
        if (DIRECTORY_SEPARATOR !== '/') {
            self::markTestSkipped('Drive prefixes are absolute only on Windows.');
        }
        config(['nvl-templates.frontend.path' => 'C:/custom-builder']);
        $this->artisan('nvl:templates:frontend:publish', ['--dry-run' => true])
            ->expectsOutputToContain(base_path('C:/custom-builder/index.ts'))
            ->assertSuccessful();
        self::assertDirectoryDoesNotExist(base_path('C:'));
    }

    public function test_dry_run_does_not_create_the_destination(): void
    {
        $destination = $this->destination();
        $this->artisan('nvl:templates:frontend:publish', ['--dry-run' => true])->assertSuccessful();
        self::assertDirectoryDoesNotExist($destination);
    }

    public function test_conflict_preflight_preserves_local_edits_and_does_not_write_other_pending_files(): void
    {
        $destination = $this->destination();
        $this->artisan('nvl:templates:frontend:publish')->assertSuccessful();
        file_put_contents($destination.'/index.ts', 'local application edit');
        unlink($destination.'/template-renderer.ts');

        $this->artisan('nvl:templates:frontend:publish')->assertFailed();

        self::assertSame('local application edit', file_get_contents($destination.'/index.ts'));
        self::assertFileDoesNotExist($destination.'/template-renderer.ts');
    }

    public function test_dot_segments_cannot_bypass_conflict_preflight_through_a_missing_parent(): void
    {
        $destination = $this->destination();
        $this->artisan('nvl:templates:frontend:publish')->assertSuccessful();
        file_put_contents($destination.'/index.ts', 'local application edit');
        unlink($destination.'/template-renderer.ts');
        config(['nvl-templates.frontend.path' => $this->sandbox.'/missing-parent/../custom-builder']);

        $this->artisan('nvl:templates:frontend:publish')->assertFailed();

        self::assertSame('local application edit', file_get_contents($destination.'/index.ts'));
        self::assertFileDoesNotExist($destination.'/template-renderer.ts');
        self::assertDirectoryDoesNotExist($this->sandbox.'/missing-parent');
    }

    public function test_force_replaces_differing_files_without_removing_host_extensions(): void
    {
        $destination = $this->destination();
        $this->artisan('nvl:templates:frontend:publish')->assertSuccessful();
        file_put_contents($destination.'/index.ts', 'local application edit');
        file_put_contents($destination.'/host-extension.ts', 'preserve me');

        $this->artisan('nvl:templates:frontend:publish', ['--force' => true])->assertSuccessful();

        self::assertSame(file_get_contents($this->source().'/index.ts'), file_get_contents($destination.'/index.ts'));
        self::assertSame('preserve me', file_get_contents($destination.'/host-extension.ts'));
    }

    public function test_a_directory_in_place_of_a_target_file_is_rejected_before_writes(): void
    {
        $destination = $this->destination();
        (new Filesystem)->ensureDirectoryExists($destination.'/index.ts');
        $this->artisan('nvl:templates:frontend:publish', ['--force' => true])->assertFailed();
        self::assertFileDoesNotExist($destination.'/styles.css');
    }

    public function test_a_symlink_in_place_of_a_target_file_is_never_followed_even_with_force(): void
    {
        $destination = $this->destination();
        (new Filesystem)->ensureDirectoryExists($destination);
        $outside = $this->sandbox.'/private.txt';
        file_put_contents($outside, 'preserve me');
        symlink($outside, $destination.'/index.ts');

        $this->artisan('nvl:templates:frontend:publish', ['--force' => true])->assertFailed();

        self::assertSame('preserve me', file_get_contents($outside));
        self::assertFileDoesNotExist($destination.'/styles.css');
    }

    public function test_a_symlinked_destination_ancestor_is_rejected(): void
    {
        (new Filesystem)->ensureDirectoryExists($this->sandbox.'/actual');
        symlink($this->sandbox.'/actual', $this->sandbox.'/linked');
        config(['nvl-templates.frontend.path' => $this->sandbox.'/linked/builder']);
        $this->artisan('nvl:templates:frontend:publish')->assertFailed();
        self::assertDirectoryDoesNotExist($this->sandbox.'/actual/builder');
    }

    public function test_missing_parent_and_dot_segments_cannot_hide_a_symlinked_ancestor(): void
    {
        (new Filesystem)->ensureDirectoryExists($this->sandbox.'/actual');
        symlink($this->sandbox.'/actual', $this->sandbox.'/linked');
        config(['nvl-templates.frontend.path' => $this->sandbox.'/missing-parent/../linked/builder']);

        $this->artisan('nvl:templates:frontend:publish', ['--dry-run' => true, '--force' => true])->assertFailed();

        self::assertDirectoryDoesNotExist($this->sandbox.'/actual/builder');
        self::assertDirectoryDoesNotExist($this->sandbox.'/missing-parent');
    }

    #[DataProvider('overlappingDestinations')]
    public function test_source_overlap_is_rejected_including_dot_segments(string $kind): void
    {
        $source = $this->source();
        $destination = match ($kind) {
            'equal' => $source,
            'descendant' => $source.'/publication-must-not-exist',
            'ancestor' => dirname($source),
            'dot-segments' => $source.'/../template-maker/publication-must-not-exist',
            'case-alias' => dirname($source).'/TEMPLATE-MAKER/publication-must-not-exist',
            'posix-backslashes' => $source.'/..\\..\\publication-must-not-exist',
            'posix-drive-dot-segments' => $source.'/../C:/../template-maker/publication-must-not-exist',
        };
        if ($kind === 'case-alias' && ! is_dir(dirname($source).'/TEMPLATE-MAKER')) {
            self::markTestSkipped('Case aliases are only applicable on case-insensitive filesystems.');
        }
        if (str_starts_with($kind, 'posix-') && DIRECTORY_SEPARATOR !== '/') {
            self::markTestSkipped('Literal backslash filenames are only applicable on POSIX.');
        }
        config(['nvl-templates.frontend.path' => $destination]);
        $this->artisan('nvl:templates:frontend:publish', ['--dry-run' => true, '--force' => true])->assertFailed();
        self::assertDirectoryDoesNotExist($source.'/publication-must-not-exist');
    }

    public static function overlappingDestinations(): array
    {
        return [['equal'], ['descendant'], ['ancestor'], ['dot-segments'], ['case-alias'], ['posix-backslashes'], ['posix-drive-dot-segments']];
    }

    #[DataProvider('invalidDestinations')]
    public function test_invalid_configured_destinations_are_rejected(mixed $destination): void
    {
        config(['nvl-templates.frontend.path' => $destination]);
        $this->artisan('nvl:templates:frontend:publish')->assertFailed();
    }

    public static function invalidDestinations(): array
    {
        return [[null], [''], ['  '], [false], [['path']], ["a\0b"]];
    }

    private function destination(): string
    {
        $destination = $this->sandbox.'/custom-builder';
        config(['nvl-templates.frontend.path' => $destination]);

        return $destination;
    }

    private function source(): string
    {
        return dirname(__DIR__, 2).'/resources/js/template-maker';
    }

    private function assertCompletePublication(string $destination): void
    {
        $source = $this->source();
        $files = (new Filesystem)->allFiles($source);
        self::assertNotEmpty($files);
        foreach ($files as $file) {
            $target = $destination.'/'.$file->getRelativePathname();
            self::assertFileExists($target);
            self::assertSame(hash_file('sha256', $file->getPathname()), hash_file('sha256', $target), $file->getRelativePathname());
        }
        self::assertCount(count($files), (new Filesystem)->allFiles($destination));
    }
}
