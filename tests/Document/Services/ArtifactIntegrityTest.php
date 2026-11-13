<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Services;

use Closure;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Providers\LocaleServiceProvider;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Drivers\Compiler\LocalNodeCompiler;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateDraft;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Services\TemplateFamilies;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\Tests\Support\MigratesInMemorySqlite;
use Nvl\Translatable\Providers\TranslatableServiceProvider;
use Orchestra\Testbench\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class ArtifactIntegrityTest extends TestCase
{
    use MigratesInMemorySqlite;

    protected function getPackageProviders($app): array
    {
        return [LocaleServiceProvider::class, TranslatableServiceProvider::class, TemplatesServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite.database', ':memory:');
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->app->instance(TemplateAuthorization::class, new class implements TemplateAuthorization
        {
            public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void {}
        });
        $this->migrateInMemorySqlite();
    }

    #[DataProvider('browserEngines')]
    public function test_plain_binding_variants_keep_the_pinned_artifacts_without_a_server_compiler(string $browserEngine): void
    {
        [$template, $source] = $this->variant(false);
        $source = $this->withBrowserArtifacts($source, $browserEngine);
        $renderer = app(TemplateRenderer::class);
        $data = ['facts' => ['code' => 'TRUSTED'], 'inputs' => ['message' => 'Customer value'], 'settings' => ['textSize' => 18]];

        $preview = $renderer->preview($template->id, $source, $data, SystemActor::Background);
        self::assertStringContainsString('TRUSTED', $preview['html']);
        self::assertStringContainsString('Customer value', $preview['html']);
        self::assertStringContainsString('font-size:18px', $preview['html']);
        self::assertSame('Experience voucher', $preview['subject']);
        self::assertSame('Your voucher is ready.', $preview['text']);
        self::assertStringNotContainsString('Unapproved', $preview['html'].$preview['css']);

        $templates = app(TemplateLifecycle::class);
        $draft = $templates->saveDraft($template->id, $source, 0, SystemActor::Background);
        $release = $templates->publish($template->id, $draft->version, SystemActor::Background);
        self::assertSame('bindings', $release->document['artifacts']['engine']);
        self::assertSame($preview, array_replace($renderer->render($release->id, $data, SystemActor::Background), ['revisionId' => 'preview']));
    }

    #[DataProvider('publicationOperations')]
    public function test_a_browser_artifact_cannot_publish_or_preview_structure_without_a_trusted_compiler(string $operation): void
    {
        [$template, $source] = $this->variant(true);
        $source = $this->withBrowserArtifacts($source);
        $templates = app(TemplateLifecycle::class);
        $draft = $templates->saveDraft($template->id, $source, 0, SystemActor::Background);
        self::assertSame(1, $draft->version, 'Raw structural drafts remain saveable before server compilation is configured.');

        $this->assertCompilerRequired(fn () => $operation === 'preview'
            ? app(TemplateRenderer::class)->preview($template->id, $source, ['facts' => ['code' => 'TRUSTED']], SystemActor::Background)
            : $templates->publish($template->id, $draft->version, SystemActor::Background));

        self::assertSame(0, TemplateRevision::query()->count());
        self::assertNull($template->fresh()?->current_revision_id);
        self::assertSame($source, TemplateDraft::query()->where('template_id', $template->id)->sole()->document);
    }

    /** @return iterable<string,array{string}> */
    public static function publicationOperations(): iterable
    {
        yield 'server preview' => ['preview'];
        yield 'publication' => ['publish'];
    }

    #[DataProvider('browserEngines')]
    public function test_trusted_compilation_rebuilds_the_allowed_variant_and_preserves_family_sidecars(string $browserEngine): void
    {
        [$template, $source] = $this->variant(true);
        $source = $this->withBrowserArtifacts($source, $browserEngine);
        $this->useBundledCompiler();
        $templates = app(TemplateLifecycle::class);
        $draft = $templates->saveDraft($template->id, $source, 0, SystemActor::Background);
        try {
            $release = $templates->publish($template->id, $draft->version, SystemActor::Background);
        } catch (ValidationException $error) {
            self::fail('The browser artifact engine changed the authoritative compilation path: '.json_encode($error->errors(), JSON_THROW_ON_ERROR));
        }
        $output = app(TemplateRenderer::class)->render($release->id, [
            'facts' => ['code' => 'TRUSTED'], 'inputs' => ['message' => 'Customer value'], 'settings' => ['textSize' => 18],
        ], SystemActor::Background);

        self::assertStringContainsString('TRUSTED', $output['html']);
        self::assertStringContainsString('Customer value', $output['html']);
        self::assertStringContainsString('font-weight:bold', $output['html']);
        self::assertStringContainsString('font-size:18px', $output['html']);
        self::assertStringContainsString('<title>Variant</title>', $output['html']);
        self::assertSame('Experience voucher', $output['subject']);
        self::assertSame('Your voucher is ready.', $output['text']);
        self::assertStringNotContainsString('Unapproved', $output['html'].$output['css']);
        self::assertSame('shared', $release->document['artifacts']['engine']);
        self::assertSame('shared', $release->document['rendering']['engine']);
        self::assertSame($source, $release->source, 'The raw family pin and deltas remain the authored authority.');
    }

    /** @return iterable<string,array{string}> */
    public static function browserEngines(): iterable
    {
        yield 'binding artifact hint' => ['bindings'];
        yield 'shared artifact hint' => ['shared'];
    }

    public function test_a_browser_engine_downgrade_cannot_replace_an_unchanged_shared_family(): void
    {
        $this->useBundledCompiler();
        [$template, $source] = $this->variant(false, shared: true);
        $source = $this->withBrowserArtifacts($source, 'bindings');
        $templates = app(TemplateLifecycle::class);
        $draft = $templates->saveDraft($template->id, $source, 0, SystemActor::Background);
        $release = $templates->publish($template->id, $draft->version, SystemActor::Background);
        $output = app(TemplateRenderer::class)->render($release->id, ['facts' => ['code' => 'TRUSTED']], SystemActor::Background);

        self::assertStringContainsString('TRUSTED', $output['html']);
        self::assertStringNotContainsString('Unapproved', $output['html'].$output['css']);
        self::assertSame('Experience voucher', $output['subject']);
        self::assertSame('Your voucher is ready.', $output['text']);
        self::assertSame('shared', $release->document['artifacts']['engine']);
    }

    public function test_stale_browser_stamps_still_reject_before_a_draft_is_saved(): void
    {
        [$template, $source] = $this->variant(true);
        $source = $this->withBrowserArtifacts($source);
        $source['source']['overrides']['variations']['weight']['value'] = 'normal';

        try {
            app(TemplateLifecycle::class)->saveDraft($template->id, $source, 0, SystemActor::Background);
            self::fail('A stale browser stamp was accepted.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('compiled', $error->errors());
        }
        self::assertSame(0, TemplateDraft::query()->count());
    }

    public function test_standalone_authors_keep_their_explicit_binding_html(): void
    {
        $templates = app(TemplateLifecycle::class);
        $template = $templates->create(['key' => 'standalone', 'name' => 'Standalone'], SystemActor::Background);
        $source = $this->document();
        $source['artifacts']['html'] = '<p>Standalone authored output</p>';
        $draft = $templates->saveDraft($template->id, $source, 0, SystemActor::Background);
        $release = $templates->publish($template->id, $draft->version, SystemActor::Background);
        $output = app(TemplateRenderer::class)->render($release->id, ['facts' => ['code' => 'TRUSTED']], SystemActor::Background);

        self::assertStringContainsString('Standalone authored output', $output['html']);
        self::assertSame('bindings', $release->document['artifacts']['engine']);
    }

    /** @return array{Template,array<array-key,mixed>} */
    private function variant(bool $structural, bool $shared = false): array
    {
        $families = app(TemplateFamilies::class);
        $family = $families->create(['key' => 'family', 'name' => 'Family'], SystemActor::Background);
        $document = $this->document();
        if ($shared) {
            $document['rendering']['engine'] = $document['artifacts']['engine'] = 'shared';
        }
        $families->publish($family->id, $document, 0, SystemActor::Background);
        $template = app(TemplateLifecycle::class)->create(['key' => 'variant', 'name' => 'Variant', 'groupId' => $family->id], SystemActor::Background);
        $source = ['format' => 'template-document', 'schemaVersion' => 1, 'target' => 'document', 'source' => [
            'mode' => 'group-variant', 'group' => ['id' => $family->id, 'revision' => 1],
            'overrides' => $structural ? ['variations' => ['weight' => ['kind' => 'node-style', 'value' => 'bold']]] : [],
        ]];

        return [$template, $source];
    }

    /** @return array<array-key,mixed> */
    private function document(): array
    {
        $source = json_decode(file_get_contents(dirname(__DIR__, 2).'/Support/Fixtures/bindings.json'), true, flags: JSON_THROW_ON_ERROR);
        $source['variationPoints'] = [['id' => 'weight', 'label' => 'Message weight', 'kind' => 'node-style', 'nodeId' => 'message', 'property' => 'font-weight', 'schema' => ['type' => 'string', 'enum' => ['normal', 'bold']]]];

        return $source;
    }

    /** @param array<array-key,mixed> $source
     * @return array<array-key,mixed> */
    private function withBrowserArtifacts(array $source, string $engine = 'bindings'): array
    {
        $source['compiled'] = ['sourceKey' => json_encode($source, JSON_THROW_ON_ERROR), 'artifacts' => [
            'engine' => $engine, 'html' => '<p>Unapproved replacement output</p>', 'css' => 'p{color:red}',
            'bindings' => [], 'subject' => 'Unapproved subject', 'text' => 'Unapproved text',
        ]];

        return $source;
    }

    private function useBundledCompiler(): void
    {
        config()->set('nvl-templates.compiler.driver', LocalNodeCompiler::class);
        config()->set('nvl-templates.compiler.command', ['node', dirname(__DIR__, 3).'/resources/runtime/renderer.mjs']);
    }

    private function assertCompilerRequired(Closure $operation): void
    {
        try {
            $operation();
        } catch (ValidationException $error) {
            self::assertArrayHasKey('compiled', $error->errors());

            return;
        }
        self::fail('Browser artifacts replaced the trusted compiler required for a structural family variant.');
    }
}
