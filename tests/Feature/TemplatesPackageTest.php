<?php

declare(strict_types=1);
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use Nvl\Content\Enums\ContentMutationMode;
use Nvl\Content\Enums\ContentStatus;
use Nvl\Content\Models\ContentBlock;
use Nvl\Content\Services\ContentBlocks;
use Nvl\Content\Services\ContentDefinitions;
use Nvl\Content\Services\ContentPlacements;
use Nvl\Content\Services\ContentSnapshotService;
use Nvl\Media\Enums\MediaLifecycleStatus;
use Nvl\Media\Enums\MediaType;
use Nvl\Media\Enums\MediaVisibility;
use Nvl\Media\Models\Media;
use Nvl\Media\Models\MediaAssociation;
use Nvl\Media\Services\MediaPathResolver;
use Nvl\Media\Services\MediaReader;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Definitions\Tables\TemplatesTables;
use Nvl\Templates\Enums\PdfOrientation;
use Nvl\Templates\Enums\PdfPageSize;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Enums\TemplateRenderStatus;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Enums\TemplateVersionStatus;
use Nvl\Templates\Exceptions\StaleTemplateException;
use Nvl\Templates\Exceptions\TemplateResolutionException;
use Nvl\Templates\Exceptions\TemplatesException;
use Nvl\Templates\Jobs\RenderTemplateJob;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Services\CanonicalJson;
use Nvl\Templates\Services\ConfiguredTemplatePayloadValidator;
use Nvl\Templates\Services\MediaTemplateAssetRegistry;
use Nvl\Templates\Services\MediaTemplateAssetResolver;
use Nvl\Templates\Services\NullTemplateAssetResolver;
use Nvl\Templates\Services\PdfAssetFetcher;
use Nvl\Templates\Services\PdfHtmlGuard;
use Nvl\Templates\Services\PdfTemporaryDirectoryResolver;
use Nvl\Templates\Services\SafeFilesystemPathResolver;
use Nvl\Templates\Services\StoredTemplateRenderResolver;
use Nvl\Templates\Services\TemplateAdoptionManifest;
use Nvl\Templates\Services\TemplateAdoptionSchema;
use Nvl\Templates\Services\TemplateAssignments;
use Nvl\Templates\Services\TemplateContentGuard;
use Nvl\Templates\Services\TemplateImporter;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateReader;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\Services\TemplatesDoctor;
use Nvl\Templates\Template as RenderableTemplate;
use Nvl\Templates\Tests\Fixtures\Compatibility\Html\HtmlPayload;
use Nvl\Templates\Tests\Fixtures\Compatibility\Pdf\Options\PdfOptions as CompatiblePdfOptions;
use Nvl\Templates\Tests\Fixtures\Compatibility\Pdf\PdfService;
use Nvl\Templates\Tests\Fixtures\Compatibility\Services\TemplateResponseFactory;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\HeaderFooterData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\Data\PageNumberingData;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\EngineConfig;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\TemplateActorFactory;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\TemplatesRouteConfiguration;
use Nvl\Templates\Tests\Fixtures\Data\TemplateManagementData;
use Nvl\Templates\Tests\Fixtures\Data\TemplateRenderData;
use Nvl\Templates\Tests\Fixtures\Http\Controllers\TemplateRenderController;
use Nvl\Templates\Tests\Fixtures\TestClassPdfTemplate;
use Nvl\Templates\Tests\Fixtures\TestTemplateOwner;

/**
 * @param  array<string, mixed>  $values
 * @param  array<string, array<string, mixed>>  $translations
 * @return array{0: TemplateVersion, 1: ContentBlock}
 */
function createComposedTemplateVersion(
    Template $template,
    Authenticatable|SystemActor $actor,
    array $values,
    array $translations,
): array {
    $version = app(TemplateLifecycle::class)->createVersion(
        $template,
        ['metadata' => []],
        $actor,
    );
    $block = app(ContentBlocks::class)->create(
        [
            'definition' => 'template-copy',
            'key' => "template-version-{$version->id}",
            'values' => $values,
            'translations' => $translations,
        ],
        SystemActor::Background,
    );
    app(ContentPlacements::class)->place(
        $block,
        $version,
        TemplateVersion::CONTENT_GROUP,
        [
            'key' => 'body',
            'region' => 'main',
        ],
        SystemActor::Background,
    );

    return [$version, $block];
}

beforeEach(function (): void {
    Storage::fake('public');
    app(ContentDefinitions::class)->sync(SystemActor::Background);
});

it('preserves the reusable class-template API over the verified PDF pipeline', function (): void {
    $localAssetPath = storage_path('app/template-tests/logo.png');
    File::ensureDirectoryExists(dirname($localAssetPath));
    File::put(
        $localAssetPath,
        (string) base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            true,
        ),
    );
    $template = app(TestClassPdfTemplate::class)
        ->setLanguage('bg')
        ->withFallbackLanguage('en')
        ->setData(['recipientName' => 'Ada'])
        ->withContent(['heading' => 'Statement'])
        ->setOption('reference', 'REF-100')
        ->addAsset('logo', $localAssetPath)
        ->setHeaderHtml('<p>Verified header</p>');
    $html = $template->render();
    $pdf = $template->generate();
    $download = $pdf->download('statement.pdf');
    $path = $template->save('statement.pdf');
    $confinedPath = $template->save('../confined-statement.pdf');
    $storedPath = $template
        ->setOption('storage_disk', 'public')
        ->saveToStorage('../stored-statement.txt');

    try {
        expect($html['html'])->toContain('lang="bg"')
            ->and($html['html'])->toContain('Statement')
            ->and($html['html'])->toContain('Ada')
            ->and($html['html'])->toContain('REF-100')
            ->and($pdf->getContent())->toStartWith('%PDF-')
            ->and($download->headers->get('content-disposition'))
            ->toContain('attachment; filename=statement.pdf')
            ->and($download->headers->get('cache-control'))
            ->toContain('no-store')
            ->and($path)->toEndWith('/template-tests/statement.pdf')
            ->and(File::exists($path))->toBeTrue()
            ->and($confinedPath)->toEndWith('/template-tests/confined-statement.pdf')
            ->and(File::exists($confinedPath))->toBeTrue()
            ->and($storedPath)->toBe('template-tests/stored-statement.txt.pdf');
        Storage::disk('public')->assertExists($storedPath);
    } finally {
        File::delete([$path, $confinedPath, $localAssetPath]);
    }
});

it('fails closed for unsafe class-template assets and PDF diagnostics', function (): void {
    $template = app(TestClassPdfTemplate::class);
    $outsideAssetPath = sys_get_temp_dir().'/nvl-template-outside-'.str()->uuid().'.png';
    File::put(
        $outsideAssetPath,
        (string) base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            true,
        ),
    );

    try {
        expect(fn () => $template->addUrlAsset(
            'remote',
            'https://untrusted.invalid/image.png',
        ))->toThrow(InvalidArgumentException::class)
            ->and(fn () => $template->addAsset('outside', $outsideAssetPath))
            ->toThrow(InvalidArgumentException::class);
    } finally {
        File::delete($outsideAssetPath);
    }

    $template
        ->setData(['recipientName' => 'Ada'])
        ->withContent(['heading' => 'Statement'])
        ->addInlineAsset(
            'logo',
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        );
    $template->getConfig()->showImageErrors = true;

    expect(fn () => $template->generate())
        ->toThrow(InvalidArgumentException::class);

    $template->getConfig()->showImageErrors = false;
    $template->getConfig()->setTempDir('/outside-allowed-template-root');

    expect(fn () => $template->generate())
        ->toThrow(InvalidArgumentException::class);
});

it('places class-template page numbering in the requested header or footer', function (): void {
    $top = (new EngineConfig)
        ->setHeaderFooter(new HeaderFooterData(
            headerHtml: '<p>Header</p>',
            footerHtml: '<p>Footer</p>',
        ))
        ->setPageNumbering(new PageNumberingData(
            enabled: true,
            position: 'top-right',
        ))
        ->toPdfOptions();
    $bottom = (new EngineConfig)
        ->setPageNumbering(new PageNumberingData(
            enabled: true,
            position: 'bottom-center',
        ))
        ->toPdfOptions();

    expect($top['headerHtml'])->toContain('Header', '{PAGENO}/{nbpg}')
        ->and($top['footerHtml'])->toBe('<p>Footer</p>')
        ->and($bottom['headerHtml'])->toBeNull()
        ->and($bottom['footerHtml'])->toContain('{PAGENO}/{nbpg}');
});

it('installs its composition schema with management routes disabled', function (): void {
    expect(Schema::hasTable(TemplatesTables::Templates))->toBeTrue()
        ->and(Schema::hasTable(TemplatesTables::I18n))->toBeTrue()
        ->and(Schema::hasTable(TemplatesTables::Versions))->toBeTrue()
        ->and(Schema::hasColumn(TemplatesTables::Versions, 'content_snapshot'))->toBeTrue()
        ->and(Schema::hasTable(TemplatesTables::Assignments))->toBeTrue()
        ->and(Schema::hasTable(TemplatesTables::Renders))->toBeTrue()
        ->and(Schema::hasTable('template_versions_i18n'))->toBeFalse()
        ->and(Schema::hasTable('template_assets'))->toBeFalse()
        ->and(Route::has('nvl.templates.management.index'))->toBeFalse()
        ->and(Route::has('nvl.templates.render.execute'))->toBeFalse();

    $this->artisan('nvl:templates:sync')->assertSuccessful();
    $inactive = Template::query()->where('key', 'welcome')->firstOrFail();
    $inactive = app(TemplateLifecycle::class)->update(
        $inactive,
        ['metadata' => [], 'translations' => [], 'status' => TemplateStatus::Inactive, 'expected_revision' => $inactive->revision],
        SystemActor::Background,
    );
    $this->artisan('nvl:templates:sync')->assertSuccessful();
    $orphan = Template::query()->create([
        'key' => 'removed-definition',
        'renderer' => 'test',
        'status' => TemplateStatus::Active,
        'schema' => [],
    ]);
    $this->artisan('nvl:templates:sync', [
        '--dry-run' => true,
        '--format' => 'json',
    ])->assertSuccessful()->expectsOutputToContain('"operation": "archive"');
    expect($orphan->refresh()->status)->toBe(TemplateStatus::Active);
    $this->artisan('nvl:templates:sync')->assertSuccessful();
    expect($orphan->refresh()->status)->toBe(TemplateStatus::Archived)
        ->and($inactive->refresh()->status)->toBe(TemplateStatus::Inactive);

    $publishedMigrationPath = realpath(__DIR__.'/../../database/migrations');
    $publishableMigrationPaths = array_map(
        static fn (mixed $path): string|false => is_string($path) ? realpath($path) : false,
        array_keys(ServiceProvider::pathsToPublish(
            TemplatesServiceProvider::class,
            'nvl-templates-migrations',
        )),
    );

    expect($publishedMigrationPath)->toBeString()
        ->and($publishableMigrationPaths)->toContain($publishedMigrationPath);

    $status = Artisan::call('nvl:templates:doctor', ['--strict' => true, '--format' => 'json']);
    $diagnostics = Artisan::output();
    $this->assertSame(0, $status, $diagnostics);
    expect($diagnostics)->toContain('"pdf.version"');

    config()->set([
        'nvl-templates.rendering.output.persist' => false,
        'nvl-templates.rendering.output.disk' => 'missing-disk',
    ]);
    $this->artisan('nvl:templates:doctor', [
        '--scope' => 'database',
        '--strict' => true,
        '--format' => 'json',
    ])->assertSuccessful()->expectsOutputToContain('"output.disk": true');
});

it('keeps logical diagnostic keys stable for a consumer table override', function (): void {
    config()->set('nvl-templates.tables.templates', 'host_template_library');

    $checks = app(TemplatesDoctor::class)->inspect('database');

    expect(TemplatesTables::get(TemplatesTables::Templates))->toBe('host_template_library')
        ->and($checks)->toHaveKeys([
            'table.templates',
            'columns.templates.canonical',
            'indexes.templates.canonical',
            'constraints.templates.canonical',
        ])
        ->not->toHaveKey('table.host_template_library')
        ->and($checks['table.templates'])->toBeFalse();
});

it('fails closed for unowned canonical tables and reports missing named indexes', function (): void {
    $creator = '2026_07_27_100001_nvl_templates_create_templates_table';
    $record = DB::table('migrations')->where('migration', $creator)->first();
    expect($record)->not->toBeNull();
    DB::table('migrations')->where('migration', $creator)->delete();
    $preflight = require __DIR__.'/../../database/migrations/2026_07_27_100000_nvl_templates_assert_template_schema_compatibility.php';
    $exception = null;

    try {
        $preflight->up();
    } catch (Throwable $throwable) {
        $exception = $throwable;
    } finally {
        DB::table('migrations')->insert((array) $record);
    }

    expect($exception)->toBeInstanceOf(LogicException::class)
        ->and($exception?->getMessage())->toContain('already exists without package creator');

    Schema::table(TemplatesTables::Templates, function (Blueprint $table): void {
        $table->dropIndex('templates_status_updated_idx');
    });

    try {
        $this->artisan('nvl:templates:doctor', [
            '--scope' => 'database',
            '--strict' => true,
            '--format' => 'json',
        ])->assertFailed()
            ->expectsOutputToContain('"indexes.templates.canonical": false');
    } finally {
        Schema::table(TemplatesTables::Templates, function (Blueprint $table): void {
            $table->index(['status', 'updated_at'], 'templates_status_updated_idx');
        });
    }
});

it('honors configured pagination and loads complete management aggregates', function (): void {
    config()->set('nvl-templates.limits.per_page', 1);
    $actor = SystemActor::Background;
    $welcome = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'],
        $actor,
    );
    app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'PDF report']], 'key' => 'pdf-report'],
        $actor,
    );
    $page = app(TemplateReader::class)->paginate([], $actor);
    $aggregate = app(TemplateReader::class)->get($welcome, $actor);

    expect($page->total())->toBe(2)
        ->and($page->perPage())->toBe(1)
        ->and($page->items())->toHaveCount(1)
        ->and($aggregate->relationLoaded('translations'))->toBeTrue()
        ->and($aggregate->relationLoaded('versions'))->toBeTrue()
        ->and($aggregate->relationLoaded('assignments'))->toBeTrue();
});

it('keeps localized template list queries independent of result size', function (): void {
    $actor = SystemActor::Background;
    $create = static function (int $index): void {
        $template = Template::query()->create([
            'key' => "query-template-{$index}",
            'renderer' => 'test',
            'status' => TemplateStatus::Active,
            'schema' => [],
        ]);
        $template->translations()->create([
            'locale' => 'en',
            'title' => "Query template {$index}",
        ]);
    };
    $measure = static function () use ($actor): int {
        DB::flushQueryLog();
        DB::enableQueryLog();

        $page = app(TemplateReader::class)->paginate(
            [],
            $actor,
            100,
        );
        $protectedQueries = static fn (): array => array_values(array_filter(DB::getQueryLog(), static fn (array $query): bool => preg_match('/^select .* from ["`]?nvl_templates_/i', $query['query']) === 1));
        $queryCount = count($protectedQueries());
        expect($queryCount)->toBeGreaterThan(0);

        foreach ($page->items() as $template) {
            $template->translations->count();
        }

        expect($protectedQueries())->toHaveCount($queryCount);
        DB::disableQueryLog();

        return $queryCount;
    };

    $create(1);
    $singleQueryCount = $measure();

    foreach (range(2, 25) as $index) {
        $create($index);
    }

    $populatedQueryCount = $measure();

    expect($singleQueryCount)->toBeLessThanOrEqual(3)
        ->and($populatedQueryCount)->toBe($singleQueryCount);
});

it('renders a directly constructed template through the same core pipeline', function (): void {
    $template = new RenderableTemplate(
        key: 'direct-example',
        view: 'template-tests::core',
        data: ['message' => '<script>alert("unsafe")</script>'],
        options: ['renderer' => 'blade', 'locale' => 'EN_us', 'subject' => 'Direct template', 'filename' => 'direct-example.html', 'pdf' => null, 'rendererOptions' => []],
        schema: [
            'type' => 'object',
            'properties' => [
                'message' => ['type' => 'string', 'maxLength' => 200],
            ],
            'required' => ['message'],
            'additionalProperties' => false,
        ],
        settings: ['tone' => 'formal'],
    );
    $result = app(TemplateRenderer::class)->render($template, [], [], SystemActor::Background);
    $response = app(TemplateResponseFactory::class)->download($result);
    $defaultView = app(TemplateRenderer::class)->render(new RenderableTemplate(
        key: 'default-view',
        data: ['content' => '<strong>Escaped</strong>'],
        options: ['renderer' => null, 'locale' => 'en', 'subject' => null, 'filename' => null, 'pdf' => null, 'rendererOptions' => []],
    ), [], [], SystemActor::Background);

    expect($result['renderer'])->toBe('blade')
        ->and($result['mime_type'])->toBe('text/html; charset=UTF-8')
        ->and($result['suggested_filename'])->toBe('direct-example.html')
        ->and($result['byte_size'])->toBe(strlen($result['content']))
        ->and($result['checksum'])->toBe(hash('sha256', $result['content']))
        ->and($result['content'])->toContain('lang="en-us"')
        ->and($result['content'])->toContain('&lt;script&gt;')
        ->and($result['content'])->not->toContain('<script>')
        ->and($result['content'])->toContain('formal')
        ->and($response->headers->get('content-type'))
        ->toBe('text/html; charset=UTF-8')
        ->and($response->headers->get('content-disposition'))
        ->toContain('attachment; filename=direct-example.html')
        ->and($response->headers->get('etag'))
        ->toBe('"'.$result['checksum'].'"')
        ->and($defaultView['content'])->toContain('&lt;strong&gt;Escaped&lt;/strong&gt;')
        ->and($defaultView['content'])->not->toContain('<strong>Escaped</strong>');
});

it('publishes the bundled Blade foundations to a guarded custom path', function (): void {
    $root = sys_get_temp_dir().'/nvl-templates-views-'.str()->uuid();
    File::ensureDirectoryExists($root);
    config()->set('nvl-templates.views.allowed_publish_roots', [$root]);

    try {
        $this->artisan('nvl:templates:views:publish', [
            '--path' => $root.'/documents',
        ])->assertSuccessful();

        expect(File::exists($root.'/documents/html/document.blade.php'))->toBeTrue()
            ->and(File::exists($root.'/documents/pdf/document.blade.php'))->toBeTrue()
            ->and(File::exists($root.'/documents/components/page-break.blade.php'))
            ->toBeTrue();

        expect(fn () => $this->artisan('nvl:templates:views:publish', [
            '--path' => dirname($root).'/escaped',
        ]))->toThrow(InvalidArgumentException::class);
    } finally {
        File::deleteDirectory($root);
    }
});

it('publishes and queues an immutable localized content composition', function (): void {
    Queue::fake();
    $actor = SystemActor::Background;
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'],
        $actor,
    );
    [$version, $block] = createComposedTemplateVersion(
        $template,
        $actor,
        [],
        ['en' => ['text' => 'Welcome', 'subject' => 'Hello']],
    );
    $version = app(TemplateLifecycle::class)->publishVersion(
        $version,
        $version->revision,
        $actor,
    );
    $result = app(TemplateRenderer::class)->render(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']]['payload'],
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']],
        $actor);
    $queued = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'welcome-ada', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']],
        $actor,
    );
    $same = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'welcome-ada', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']],
        $actor,
    );
    app(ContentBlocks::class)->update(
        $block,
        [
            'expected_revision' => $block->revision,
            'mode' => ContentMutationMode::Patch,
            'translations' => ['en' => ['text' => 'Changed after publication']],
        ],
        SystemActor::Background,
    );
    $snapshotResult = app(TemplateRenderer::class)->render(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']]['payload'],
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']],
        $actor);

    expect($version->status)->toBe(TemplateVersionStatus::Published)
        ->and($template->renderer)->toBe('test')
        ->and($template->schema)->toHaveKey('name')
        ->and($version->content_hash)->toHaveLength(64)
        ->and($result['content'])->toBe('Welcome:Ada')
        ->and($result['subject'])->toBe('Hello')
        ->and($snapshotResult['content'])->toBe('Welcome:Ada')
        ->and($queued->id)->toBe($same->id);
    Queue::assertPushed(RenderTemplateJob::class, 1);
});

it('enforces optimistic concurrency and published version immutability', function (): void {
    $actor = SystemActor::Background;
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'],
        $actor,
    );
    $updatedTemplate = app(TemplateLifecycle::class)->update(
        $template,
        ['metadata' => [], 'translations' => ['en' => ['title' => 'Updated welcome']], 'status' => TemplateStatus::Active, 'expected_revision' => $template->revision],
        $actor,
    );

    expect($updatedTemplate->revision)->toBe(2)
        ->and($updatedTemplate->getTranslation('en')?->getAttribute('title'))
        ->toBe('Updated welcome')
        ->and(TemplateManagementData::fromModel($updatedTemplate)->toArray())
        ->toHaveKeys(['id', 'key', 'translations', 'versions', 'assignments']);

    expect(fn () => app(TemplateLifecycle::class)->update(
        $updatedTemplate,
        ['metadata' => [], 'translations' => ['en' => ['title' => 'Stale']], 'status' => TemplateStatus::Active, 'expected_revision' => 1],
        $actor,
    ))->toThrow(StaleTemplateException::class);

    [$version] = createComposedTemplateVersion(
        $updatedTemplate,
        $actor,
        [],
        ['en' => ['text' => 'Original']],
    );
    $draft = app(TemplateLifecycle::class)->updateVersion(
        $version,
        ['metadata' => ['campaign' => 'welcome'], 'expected_revision' => $version->revision],
        $actor,
    );
    $published = app(TemplateLifecycle::class)->publishVersion(
        $draft,
        $draft->revision,
        $actor,
    );

    expect(fn () => app(TemplateLifecycle::class)->updateVersion(
        $published,
        ['metadata' => ['campaign' => 'forbidden'], 'expected_revision' => $published->revision],
        $actor,
    ))->toThrow(InvalidArgumentException::class)
        ->and(fn () => app(TemplateLifecycle::class)->publishVersion(
            $published,
            $published->revision,
            $actor,
        ))->toThrow(InvalidArgumentException::class);

    $publishedRevision = $published->revision;
    [$nextVersion] = createComposedTemplateVersion(
        $updatedTemplate,
        $actor,
        [],
        ['en' => ['text' => 'Replacement']],
    );
    $replacement = app(TemplateLifecycle::class)->publishVersion(
        $nextVersion,
        $nextVersion->revision,
        $actor,
    );

    expect($published->refresh()->status)->toBe(TemplateVersionStatus::Retired)
        ->and($published->revision)->toBe($publishedRevision + 1)
        ->and($replacement->status)->toBe(TemplateVersionStatus::Published)
        ->and(fn () => app(TemplateLifecycle::class)->publishVersion(
            $published,
            $published->revision,
            $actor,
        ))->toThrow(InvalidArgumentException::class);
});

it('assigns templates to registered owners with exact revisions', function (): void {
    $actor = SystemActor::Background;
    $owner = TestTemplateOwner::query()->create(['name' => 'Ada']);
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'],
        $actor,
    );
    $assignment = app(TemplateAssignments::class)->assign(
        $template,
        ['profile' => 'default', 'versionId' => null, 'settings' => ['tone' => 'friendly'], 'expected_revision' => 0, 'ownerType' => 'member', 'ownerId' => $owner->id],
        $actor,
    );
    $updated = app(TemplateAssignments::class)->assign(
        $template,
        ['profile' => 'default', 'versionId' => null, 'settings' => ['tone' => 'formal'], 'expected_revision' => $assignment->revision, 'ownerType' => 'member', 'ownerId' => $owner->id],
        $actor,
    );

    expect($updated->revision)->toBe(2)
        ->and($updated->settings)->toBe(['tone' => 'formal']);

    expect(fn () => app(TemplateAssignments::class)->unassign(
        $updated,
        1,
        $actor,
    ))->toThrow(StaleTemplateException::class);

    expect(app(TemplateAssignments::class)->unassign(
        $updated,
        $updated->revision,
        $actor,
    ))->toBeTrue();
});

it('authorizes every caller-selected stored render scope', function (): void {
    Queue::fake();
    $system = SystemActor::Background;
    $owner = TestTemplateOwner::query()->create(['name' => 'Ada']);
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'],
        $system,
    );
    [$version] = createComposedTemplateVersion(
        $template,
        $system,
        [],
        ['en' => ['text' => 'Welcome']],
    );
    app(TemplateLifecycle::class)->publishVersion(
        $version,
        $version->revision,
        $system,
    );
    app(TemplateAssignments::class)->assign(
        $template,
        ['profile' => 'default', 'versionId' => null, 'settings' => ['tone' => 'friendly'], 'expected_revision' => 0, 'ownerType' => 'member', 'ownerId' => $owner->id],
        $system,
    );
    app()->instance(TemplateAuthorization::class, new class implements TemplateAuthorization
    {
        public function authorize(
            TemplateAbility $ability,
            Authenticatable|SystemActor $actor,
            array $context = [],
        ): void {
            if ($ability === TemplateAbility::Render
                && ($context['owner_type'] ?? null) === 'member'
                && ($context['owner_id'] ?? null) === $actor->id
                && ($context['profile'] ?? null) === 'default'
                && array_key_exists('version_id', $context)
                && is_bool($context['queued'] ?? null)) {
                return;
            }

            throw new AuthorizationException('The requested template render scope is forbidden.');
        }
    });
    $ownerActor = templateTestActor($owner->id);
    $request = ['ownerType' => 'member', 'ownerId' => $owner->id, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'authorized-owner-render', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']];

    expect(app(TemplateRenderer::class)->render(
        $template,
        $request['payload'],
        $request,
        $ownerActor)['content'])->toBe('Welcome:Ada')
        ->and(app(TemplateRenderer::class)->queue(
            $template,
            $request,
            $ownerActor,
        )->status)->toBe(TemplateRenderStatus::Pending)
        ->and(fn () => app(TemplateRenderer::class)->render(
            $template,
            $request['payload'],
            $request,
            templateTestActor((string) str()->uuid())))->toThrow(AuthorizationException::class);
});

it('uses canonical render requests and processes queued output idempotently', function (): void {
    Queue::fake();
    config()->set([
        'nvl-templates.rendering.output.persist' => false,
        'nvl-templates.rendering.store_payload' => false,
    ]);
    $actor = SystemActor::Background;
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'],
        $actor,
    );
    [$version] = createComposedTemplateVersion(
        $template,
        $actor,
        [],
        ['en' => ['text' => 'Welcome']],
    );
    app(TemplateLifecycle::class)->publishVersion($version, $version->revision, $actor);
    $render = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'welcome-ada', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada', 'options' => ['b' => 2, 'a' => 1]]],
        $actor,
    );
    $same = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'welcome-ada', 'download' => false, 'locale' => 'en', 'payload' => ['options' => ['a' => 1, 'b' => 2], 'name' => 'Ada']],
        $actor,
    );

    expect($same->id)->toBe($render->id)
        ->and(app(CanonicalJson::class)->digest(['b' => 2, 'a' => 1]))
        ->toBe(app(CanonicalJson::class)->digest(['a' => 1, 'b' => 2]));

    expect(fn () => app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'welcome-ada', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Grace']],
        $actor,
    ))->toThrow(TemplatesException::class);

    $completed = app(TemplateRenderer::class)->process($render);
    $again = app(TemplateRenderer::class)->process($completed);
    $terminal = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'terminal-render', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Terminal']],
        $actor,
    );
    (new RenderTemplateJob(
        $terminal->id,
        $terminal->dispatch_generation,
    ))->failed(new RuntimeException('Terminal failure.'));

    expect($completed->status)->toBe(TemplateRenderStatus::Completed)
        ->and($completed->payload)->toBeNull()
        ->and($again->id)->toBe($completed->id)
        ->and($again->attempts)->toBe(1)
        ->and($terminal->refresh()->status)->toBe(TemplateRenderStatus::Failed)
        ->and($terminal->payload)->toBeNull()
        ->and($terminal->settings)->toBeNull();
});

it('applies durable render job policies and records processing failures', function (): void {
    Queue::fake();
    config()->set('nvl-templates.rendering.output.persist', false);
    $actor = SystemActor::Background;
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'],
        $actor,
    );
    [$version] = createComposedTemplateVersion(
        $template,
        $actor,
        [],
        ['en' => ['text' => 'Welcome']],
    );
    app(TemplateLifecycle::class)->publishVersion($version, $version->revision, $actor);
    $render = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'job-success', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']],
        $actor,
    );
    config()->set('nvl-templates.rendering.backoff', 'invalid');
    $job = new RenderTemplateJob($render->id, $render->dispatch_generation);

    expect($job->uniqueId())->toBe($render->id.':'.$render->dispatch_generation)
        ->and($job->backoff())->toBe([10, 30, 90]);

    config()->set('nvl-templates.rendering.backoff', [0, 'later']);
    expect($job->backoff())->toBe([10, 30, 90]);

    config()->set([
        'nvl-templates.rendering.backoff' => [7, 20],
        'nvl-templates.rendering.lease_seconds' => 30,
    ]);
    expect($job->middleware())->toHaveCount(1);

    $job->handle(app(TemplateRenderer::class));

    $failed = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'job-failure', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Grace']],
        $actor,
    );
    $failed->version()->update(['status' => TemplateVersionStatus::Draft]);

    expect($render->refresh()->status)->toBe(TemplateRenderStatus::Completed)
        ->and(fn () => app(TemplateRenderer::class)->process($failed))
        ->toThrow(TemplateResolutionException::class)
        ->and($failed->refresh()->status)->toBe(TemplateRenderStatus::Failed)
        ->and($failed->failure)->toContain('immutable published version');
});

it('uses Content media fields instead of a template asset table', function (): void {
    $actor = SystemActor::Background;
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'],
        $actor,
    );
    $media = Media::factory()->create([
        'mime_type' => 'image/png',
        'extension' => 'png',
        'type' => MediaType::IMAGE,
        'is_public' => true,
        'visibility' => MediaVisibility::Public,
        'status' => MediaLifecycleStatus::Available,
    ]);
    Storage::disk('public')->put(app(MediaPathResolver::class)->mediaPath($media), 'logo');
    [$version, $block] = createComposedTemplateVersion(
        $template,
        $actor,
        ['logo' => $media->id],
        ['en' => ['text' => 'Welcome']],
    );
    $published = app(TemplateLifecycle::class)->publishVersion(
        $version,
        $version->revision,
        $actor,
    );
    $snapshot = $published->content_snapshot;

    expect($snapshot)->toBeArray();

    $composition = app(ContentSnapshotService::class)->render(
        $snapshot,
        'en',
        SystemActor::Background,
    );

    expect(MediaAssociation::query()->where('associable_id', $block->id)->count())->toBe(1)
        ->and(app(TemplateContentGuard::class)->compositionValue($composition, 'body.logo'))->toBeArray()->toHaveKey('id');
});

it('resolves revision-aware class-template aliases through NVL Media', function (): void {
    $media = Media::factory()->create([
        'mime_type' => 'image/png',
        'extension' => 'png',
        'type' => MediaType::IMAGE,
        'is_public' => true,
        'visibility' => MediaVisibility::Public,
        'status' => MediaLifecycleStatus::Available,
        'revision' => 3,
    ]);
    $path = app(MediaPathResolver::class)->mediaPath($media);
    Storage::disk('public')->put(
        $path,
        (string) base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            true,
        ),
    );
    $absolutePath = Storage::disk('public')->path($path);
    config()->set(
        'nvl-templates.compatibility.assets.allowed_local_roots',
        [dirname($absolutePath, 3)],
    );
    $registry = app(MediaTemplateAssetRegistry::class);
    $registry->register(['scope' => 'document', 'type' => 'logo', 'variation' => '', 'delivery' => 'path', 'expected_revision' => 3, 'key' => 'brand-logo', 'mediaId' => $media->id]);
    $registry->register(['scope' => 'default', 'type' => 'image', 'variation' => '', 'delivery' => 'path', 'expected_revision' => 2, 'key' => 'stale-logo', 'mediaId' => $media->id]);
    $registry->registerAdoptionAliases(['legacy-logo' => $media->id]);
    $resolver = app(MediaTemplateAssetResolver::class);

    expect($resolver->resolve('brand-logo', SystemActor::Background))->toBe($absolutePath)
        ->and($resolver->scope('document', SystemActor::Background, 'logo'))
        ->toBe(['brand-logo' => $absolutePath])
        ->and($resolver->scope('adoption', SystemActor::Background))
        ->toBe(['legacy-logo' => $absolutePath])
        ->and($resolver->resolve('unknown', SystemActor::Background))->toBeNull()
        ->and(fn () => $resolver->resolve('stale-logo', SystemActor::Background))
        ->toThrow(TemplateResolutionException::class);
});

it('fails closed across template Media alias registration and resolution', function (): void {
    $registry = app(MediaTemplateAssetRegistry::class);
    $registered = ['scope' => 'default', 'type' => 'image', 'variation' => '', 'delivery' => 'path', 'expected_revision' => null, 'key' => 'registered-logo', 'mediaId' => 'registered-media'];
    $registry->register($registered);

    expect(fn () => $registry->register($registered))
        ->toThrow(InvalidArgumentException::class)
        ->and(fn () => $registry->register(['scope' => 'default', 'type' => 'image', 'variation' => '', 'delivery' => 'path', 'expected_revision' => null, 'key' => 'blank-media', 'mediaId' => ' ']))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $registry->register(['scope' => 'bad scope', 'type' => 'image', 'variation' => '', 'delivery' => 'path', 'expected_revision' => null, 'key' => 'invalid-scope', 'mediaId' => 'media']))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $registry->register(['scope' => 'default', 'type' => 'image', 'variation' => 'Bad!', 'delivery' => 'path', 'expected_revision' => null, 'key' => 'invalid-variation', 'mediaId' => 'media']))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $registry->register(['scope' => 'default', 'type' => 'image', 'variation' => '', 'delivery' => 'stream', 'expected_revision' => null, 'key' => 'invalid-delivery', 'mediaId' => 'media']))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $registry->register(['scope' => 'default', 'type' => 'image', 'variation' => '', 'delivery' => 'path', 'expected_revision' => 0, 'key' => 'invalid-revision', 'mediaId' => 'media']))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $registry->registerAdoptionAliases(['legacy' => 42]))
        ->toThrow(InvalidArgumentException::class)
        ->and($registry->all())->toHaveKey('registered-logo');

    $resolver = app(MediaTemplateAssetResolver::class);
    $registry->register(['scope' => 'default', 'type' => 'image', 'variation' => '', 'delivery' => 'path', 'expected_revision' => null, 'key' => 'missing-media', 'mediaId' => (string) str()->uuid()]);

    expect(fn () => $resolver->resolve('missing-media', SystemActor::Background))
        ->toThrow(TemplateResolutionException::class);

    $media = Media::factory()->create([
        'mime_type' => 'image/png',
        'extension' => 'png',
        'type' => MediaType::IMAGE,
        'is_public' => true,
        'visibility' => MediaVisibility::Public,
        'status' => MediaLifecycleStatus::Available,
        'revision' => 2,
    ]);
    Storage::disk('public')->put(app(MediaPathResolver::class)->mediaPath($media), 'logo');
    config()->set([
        'filesystems.disks.public.url' => null,
        'nvl-templates.pdf.remote_assets.enabled' => true,
        'nvl-templates.pdf.remote_assets.allow_http' => true,
        'nvl-templates.pdf.remote_assets.allowed_hosts' => ['localhost'],
    ]);
    url()->forceRootUrl('http://localhost');
    $registry->register(['scope' => 'default', 'type' => 'image', 'variation' => 'thumbnail', 'delivery' => 'path', 'expected_revision' => null, 'key' => 'missing-variation', 'mediaId' => $media->id]);
    $registry->register(['scope' => 'default', 'type' => 'image', 'variation' => '', 'delivery' => 'url', 'expected_revision' => null, 'key' => 'public-url', 'mediaId' => $media->id]);

    expect(fn () => $resolver->resolve('missing-variation', SystemActor::Background))
        ->toThrow(TemplateResolutionException::class)
        ->and(fn () => $resolver->resolve('public-url', SystemActor::Background))
        ->toThrow(TemplateResolutionException::class);

    $nullResolver = new NullTemplateAssetResolver;

    expect($nullResolver->resolve('anything', SystemActor::Background))->toBeNull()
        ->and($nullResolver->scope('anything', SystemActor::Background))->toBe([]);
});

it('plans prepares applies and reconciles an idempotent staged adoption manifest', function (): void {
    $manifestPath = storage_path('framework/testing/templates-adoption.json');

    try {
        Schema::create('legacy_template_assets', function (Blueprint $table): void {
            $table->id();
            $table->string('alias');
            $table->index('alias', 'template_assets_alias_index');
        });
        $media = Media::factory()->create([
            'status' => MediaLifecycleStatus::Available,
            'revision' => 4,
        ]);
        File::ensureDirectoryExists(dirname($manifestPath));
        File::put($manifestPath, (string) json_encode([
            'version' => 1,
            'staging_tables' => ['legacy_template_assets'],
            'legacy_asset_count' => 1,
            'templates' => [[
                'legacy_key' => 'legacy-welcome',
                'key' => 'welcome',
                'translations' => [
                    'en' => ['title' => 'Adopted welcome'],
                    'bg' => ['title' => 'Приветствие'],
                ],
            ]],
            'content' => [[
                'legacy_key' => 'legacy-welcome-copy',
                'legacy_scope' => 'legacy-global',
                'legacy_scope_key' => 'legacy',
                'definition' => 'template-copy',
                'key' => 'welcome-copy',
                'scope' => 'global',
                'scope_key' => '*',
                'translations' => [
                    'en' => ['text' => 'Adopted copy'],
                    'bg' => ['text' => 'Приет текст'],
                ],
                'publish' => true,
            ]],
            'assets' => [[
                'legacy_alias' => 'legacy-logo',
                'key' => 'adopted-logo',
                'media_id' => $media->id,
                'scope' => 'document',
                'type' => 'logo',
                'expected_revision' => 4,
            ]],
        ], JSON_THROW_ON_ERROR));

        $this->artisan('nvl:templates:adopt', [
            'manifest' => $manifestPath,
            '--format' => 'json',
        ])->assertSuccessful()
            ->expectsOutputToContain('"mode": "plan"');
        expect(collect(Schema::getIndexes('legacy_template_assets'))->pluck('name'))
            ->toContain('template_assets_alias_index');

        $this->artisan('nvl:templates:adopt', [
            'manifest' => $manifestPath,
            '--prepare' => true,
            '--format' => 'json',
        ])->assertSuccessful()
            ->expectsOutputToContain('"operation": "dropped"');

        expect(collect(Schema::getIndexes('legacy_template_assets'))->pluck('name'))
            ->not->toContain('template_assets_alias_index')
            ->and(Template::query()->where('key', 'welcome')->count())->toBe(0);

        $this->artisan('nvl:templates:adopt', [
            'manifest' => $manifestPath,
            '--apply' => true,
            '--format' => 'json',
        ])->assertSuccessful()
            ->expectsOutputToContain('"healthy": true');

        expect(Template::query()->where('key', 'welcome')->count())->toBe(1)
            ->and(ContentBlock::query()
                ->where('scope', 'global')
                ->where('scope_key', '*')
                ->where('key', 'welcome-copy')
                ->where('status', ContentStatus::Published->value)
                ->count())->toBe(1)
            ->and(app(MediaTemplateAssetRegistry::class)->get('adopted-logo')['mediaId'])
            ->toBe($media->id);

        $this->artisan('nvl:templates:adopt', [
            'manifest' => $manifestPath,
            '--apply' => true,
            '--format' => 'json',
        ])->assertSuccessful()
            ->expectsOutputToContain('"unchanged": 1');
    } finally {
        Schema::dropIfExists('legacy_template_assets');
        File::delete($manifestPath);
    }
});

it('rejects malformed adoption manifests before mutating consumer data', function (): void {
    $manifests = app(TemplateAdoptionManifest::class);
    $valid = [
        'version' => 1,
        'staging_tables' => [],
        'legacy_asset_count' => 0,
        'templates' => [],
        'content' => [],
        'assets' => [],
    ];
    $invalidTopLevelManifests = [
        [...$valid, 'unknown' => true],
        [...$valid, 'version' => 2],
        [...$valid, 'staging_connection' => ' '],
        [...$valid, 'staging_tables' => ['table' => 'legacy_templates']],
        [...$valid, 'staging_tables' => ['unsafe-table']],
        [...$valid, 'templates' => ['template' => []]],
        [...$valid, 'templates' => [[]]],
        [...$valid, 'legacy_asset_count' => -1],
        [...$valid, 'legacy_asset_count' => 1],
    ];

    foreach ($invalidTopLevelManifests as $manifest) {
        expect(fn () => $manifests->normalize($manifest))
            ->toThrow(InvalidArgumentException::class);
    }

    config()->set('nvl-templates.adoption.maximum_records', 0);
    expect(fn () => $manifests->normalize($valid))
        ->toThrow(InvalidArgumentException::class);

    config()->set('nvl-templates.adoption.maximum_records', 1);
    expect(fn () => $manifests->normalize([
        ...$valid,
        'templates' => [
            ['legacy_key' => 'first'],
            ['legacy_key' => 'second'],
        ],
    ]))->toThrow(InvalidArgumentException::class);
    config()->set('nvl-templates.adoption.maximum_records', 10_000);

    $template = [
        'legacy_key' => 'legacy-welcome',
        'key' => 'welcome',
        'status' => 'active',
        'metadata' => [],
        'translations' => ['en' => ['title' => 'Welcome']],
    ];
    $invalidTemplates = [
        [...$template, 'unexpected' => true],
        [...$template, 'legacy_key' => ' '],
        [...$template, 'status' => 'unsupported'],
        [...$template, 'status' => 1],
        [...$template, 'metadata' => ['not-an-object']],
        [...$template, 'metadata' => [1 => 'not-a-string-key']],
        [...$template, 'translations' => ['en' => ['title' => '']]],
        [...$template, 'translations' => ['en' => [
            'title' => 'Welcome',
            'description' => 42,
        ]]],
    ];

    foreach ($invalidTemplates as $item) {
        expect(fn () => $manifests->normalize([
            ...$valid,
            'templates' => [$item],
        ]))->toThrow(InvalidArgumentException::class);
    }

    expect(fn () => $manifests->normalize([
        ...$valid,
        'templates' => [$template, $template],
    ]))->toThrow(InvalidArgumentException::class);

    $content = [
        'legacy_key' => 'legacy-copy',
        'legacy_scope' => 'legacy-global',
        'legacy_scope_key' => 'legacy',
        'definition' => 'template-copy',
        'key' => 'welcome-copy',
        'scope' => 'global',
        'scope_key' => '*',
        'visibility' => 'public',
        'publish' => true,
    ];

    expect(fn () => $manifests->normalize([
        ...$valid,
        'content' => [[...$content, 'visibility' => 'unsupported']],
    ]))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $manifests->normalize([
            ...$valid,
            'content' => [[...$content, 'publish' => 'yes']],
        ]))->toThrow(InvalidArgumentException::class);

    $media = Media::factory()->create([
        'status' => MediaLifecycleStatus::Available,
        'revision' => 2,
    ]);
    $asset = [
        'legacy_alias' => 'legacy-logo',
        'key' => 'logo',
        'media_id' => $media->id,
        'expected_revision' => 2,
    ];

    expect(fn () => $manifests->normalize([
        ...$valid,
        'legacy_asset_count' => 1,
        'assets' => [[...$asset, 'expected_revision' => 0]],
    ]))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $manifests->normalize([
            ...$valid,
            'legacy_asset_count' => 1,
            'assets' => [[...$asset, 'media_id' => (string) str()->uuid()]],
        ]))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $manifests->normalize([
            ...$valid,
            'legacy_asset_count' => 1,
            'assets' => [[...$asset, 'expected_revision' => 1]],
        ]))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $manifests->normalize([
            ...$valid,
            'legacy_asset_count' => 1,
            'assets' => [[...$asset, 'variation' => 'thumbnail']],
        ]))->toThrow(InvalidArgumentException::class);
});

it('renders a bounded source-controlled PDF and validates its payload schema', function (): void {
    $actor = SystemActor::Background;
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'PDF report']], 'key' => 'pdf-report'],
        $actor,
    );
    [$version] = createComposedTemplateVersion(
        $template,
        $actor,
        [],
        ['en' => ['heading' => 'Account report', 'subject' => 'Report']],
    );
    app(TemplateLifecycle::class)->publishVersion($version, $version->revision, $actor);
    $result = app(TemplateRenderer::class)->render(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']]['payload'],
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']],
        $actor);

    expect($result['mime_type'])->toBe('application/pdf')
        ->and($result['subject'])->toBe('Report')
        ->and($result['suggested_filename'])->toBe('report.pdf')
        ->and(str_starts_with($result['content'], '%PDF-'))->toBeTrue();

    $direct = app(TemplateRenderer::class)->render(new RenderableTemplate(
        key: 'direct-pdf',
        data: ['content' => 'Grace'],
        options: ['renderer' => 'pdf', 'locale' => 'en', 'subject' => 'Direct PDF', 'filename' => 'direct.pdf', 'pdf' => ['pageSize' => PdfPageSize::A5, 'orientation' => PdfOrientation::Landscape, 'margins' => ['left' => 10, 'right' => 10, 'top' => null, 'bottom' => null, 'header' => null, 'footer' => null], 'defaultFont' => null, 'defaultFontSize' => null, 'dpi' => null, 'imageDpi' => null, 'imageQuality' => null, 'showImageErrors' => null, 'temporaryDirectory' => null, 'title' => null, 'author' => null, 'creator' => null, 'subject' => null, 'keywords' => null, 'headerView' => 'nvl-templates::pdf.header', 'headerHtml' => null, 'headerData' => ['header' => 'Internal'], 'footerView' => 'nvl-templates::pdf.footer', 'footerHtml' => null, 'footerData' => [], 'watermark' => 'DRAFT', 'watermarkOpacity' => 0.08, 'compress' => true, 'pdfa' => null, 'pdfaAuto' => null, 'protectionPermissions' => [], 'userPassword' => null, 'ownerPassword' => null], 'rendererOptions' => []],
    ), [], [], SystemActor::Background);

    expect($direct['mime_type'])->toBe('application/pdf')
        ->and($direct['suggested_filename'])->toBe('direct.pdf')
        ->and($direct['byte_size'])->toBe(strlen($direct['content']))
        ->and(str_starts_with($direct['content'], '%PDF-'))->toBeTrue();

    $forbiddenTemporaryPath = sys_get_temp_dir().'/nvl-templates-forbidden-'.str()->uuid();
    config()->set('nvl-templates.pdf.temp_path', $forbiddenTemporaryPath);

    expect(fn () => app(PdfTemporaryDirectoryResolver::class)->resolve())
        ->toThrow(InvalidArgumentException::class)
        ->and(File::exists($forbiddenTemporaryPath))->toBeFalse();

    expect(fn () => app(TemplateRenderer::class)->render(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['unknown' => true]]['payload'],
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['unknown' => true]],
        $actor))->toThrow(TemplateResolutionException::class);

    expect(fn () => app(PdfHtmlGuard::class)->validate(
        '<img src="https://assets.example.test/logo.png">',
    ))->toThrow(InvalidArgumentException::class);

    expect(fn () => app(PdfHtmlGuard::class)->validate(
        '<img src=" https://assets.example.test/logo.png ">',
    ))->toThrow(InvalidArgumentException::class);

    expect(fn () => app(PdfHtmlGuard::class)->validate(
        '<style>body { background: url("\\68 ttps://assets.example.test/logo.png"); }</style>',
    ))->toThrow(InvalidArgumentException::class);

    expect(fn () => app(PdfHtmlGuard::class)->validate(
        '<style>@import "safe.css";</style>',
    ))->toThrow(InvalidArgumentException::class);

    expect(fn () => app(PdfHtmlGuard::class)->validate(
        '<img src="data:image/png;base64,'.base64_encode('<svg/>').'">',
    ))->toThrow(InvalidArgumentException::class);

    config()->set([
        'nvl-templates.pdf.remote_assets.enabled' => true,
        'nvl-templates.pdf.remote_assets.allowed_hosts' => ['assets.example.test'],
    ]);
    app(PdfHtmlGuard::class)->validate(
        '<div style="background-image: url( https://assets.example.test/logo.png )"></div>',
    );

    expect(fn () => app(PdfHtmlGuard::class)->validate(
        '<img src="https://assets.example.test:8443/logo.png">',
    ))->toThrow(InvalidArgumentException::class);
});

it('rejects non-JSON values and unsupported schema or route configuration', function (): void {
    $guard = app(TemplateContentGuard::class);
    $validator = app(ConfiguredTemplatePayloadValidator::class);

    expect(fn () => $guard->payload(['object' => new stdClass]))
        ->toThrow(InvalidArgumentException::class)
        ->and(fn () => $guard->payload([['name' => 'Ada']]))
        ->toThrow(InvalidArgumentException::class)
        ->and(fn () => $validator->validateSchema([
            'type' => 'object',
            'properties' => [
                'name' => ['type' => 'string', 'pattern' => '^Ada$'],
            ],
        ]))
        ->toThrow(InvalidArgumentException::class);

    config()->set('nvl-templates.routes.render.middleware', []);

    expect(fn () => TemplatesRouteConfiguration::middleware('render'))
        ->toThrow(InvalidArgumentException::class);
});

it('rejects ancestor symlink escapes and inline SVG assets', function (): void {
    $allowedRoot = sys_get_temp_dir().'/nvl-templates-allowed-'.str()->uuid();
    $outsideRoot = sys_get_temp_dir().'/nvl-templates-outside-'.str()->uuid();
    $link = $allowedRoot.'/linked';
    File::ensureDirectoryExists($allowedRoot);
    File::ensureDirectoryExists($outsideRoot);

    if (! function_exists('symlink') || ! symlink($outsideRoot, $link)) {
        $this->markTestSkipped('The filesystem does not support symbolic links.');
    }

    config()->set('nvl-templates.rendering.output.allowed_local_roots', [$allowedRoot]);

    try {
        expect(fn () => app(SafeFilesystemPathResolver::class)->file(
            $link.'/nested/report.pdf',
            [$allowedRoot],
            createParent: true,
            requiredExtension: 'pdf',
        ))->toThrow(InvalidArgumentException::class)
            ->and(File::exists($outsideRoot.'/nested'))->toBeFalse()
            ->and(fn () => app(TestClassPdfTemplate::class)->addInlineAsset(
                'logo',
                'data:image/svg+xml;base64,'.base64_encode('<svg/>'),
            ))->toThrow(InvalidArgumentException::class)
            ->and(fn () => app(TestClassPdfTemplate::class)->addInlineAsset(
                'logo',
                'data:image/png;base64,'.base64_encode('<svg/>'),
            ))->toThrow(InvalidArgumentException::class);
    } finally {
        if (is_link($link)) {
            unlink($link);
        }

        File::deleteDirectory($allowedRoot);
        File::deleteDirectory($outsideRoot);
    }
});

it('snapshots queued assignment settings and recovers expired render leases', function (): void {
    Queue::fake();
    config()->set('nvl-templates.rendering.output.persist', false);
    $actor = SystemActor::Background;
    $owner = TestTemplateOwner::query()->create(['name' => 'Ada']);
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'],
        $actor,
    );
    [$version] = createComposedTemplateVersion(
        $template,
        $actor,
        [],
        ['en' => ['text' => 'Welcome']],
    );
    app(TemplateLifecycle::class)->publishVersion($version, $version->revision, $actor);
    $assignment = app(TemplateAssignments::class)->assign(
        $template,
        ['profile' => 'default', 'versionId' => null, 'settings' => ['tone' => 'friendly'], 'expected_revision' => 0, 'ownerType' => 'member', 'ownerId' => $owner->id],
        $actor,
    );
    $render = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => 'member', 'ownerId' => $owner->id, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'durable-friendly', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']],
        $actor,
    );
    $updatedAssignment = app(TemplateAssignments::class)->assign(
        $template,
        ['profile' => 'default', 'versionId' => null, 'settings' => ['tone' => 'formal'], 'expected_revision' => $assignment->revision, 'ownerType' => 'member', 'ownerId' => $owner->id],
        $actor,
    );
    app(TemplateAssignments::class)->unassign(
        $updatedAssignment,
        $updatedAssignment->revision,
        $actor,
    );
    $resolved = app(StoredTemplateRenderResolver::class)->resolveDurable($render->refresh());
    $completed = app(TemplateRenderer::class)->process($render);
    $recoverable = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'recoverable-render', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Grace']],
        $actor,
    );
    $stalePending = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'stale-pending-render', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Lin']],
        $actor,
    );
    $oldJob = new RenderTemplateJob(
        $recoverable->id,
        $recoverable->dispatch_generation,
    );
    $recoverable->forceFill([
        'status' => TemplateRenderStatus::Processing,
        'processing_token' => $oldJob->processingToken,
        'lease_expires_at' => now()->subSecond(),
    ])->save();
    $this->travel(661)->seconds();
    $recovered = app(TemplateRenderer::class)->recover(SystemActor::Background);
    $oldJob->failed(new RuntimeException('Superseded delivery failed.'));

    expect($render->profile)->toBe('default')
        ->and($render->settings)->toBe(['tone' => 'friendly'])
        ->and($render->assignment()->exists())->toBeFalse()
        ->and($resolved['renderable']->settings)->toBe(['tone' => 'friendly'])
        ->and($completed->status)->toBe(TemplateRenderStatus::Completed)
        ->and($recovered->modelKeys())->toHaveCount(2)
        ->and($recovered->modelKeys())->toContain($recoverable->id, $stalePending->id)
        ->and($recoverable->refresh()->status)->toBe(TemplateRenderStatus::Pending)
        ->and($recoverable->dispatch_generation)->toBe(1)
        ->and($recoverable->processing_token)->toBeNull()
        ->and($recoverable->lease_expires_at)->toBeNull()
        ->and($stalePending->refresh()->status)->toBe(TemplateRenderStatus::Pending)
        ->and($stalePending->dispatch_generation)->toBe(1);
    Queue::assertPushed(
        RenderTemplateJob::class,
        fn (RenderTemplateJob $job): bool => $job->renderId === $stalePending->id
            && $job->dispatchGeneration === 1,
    );
});

it('scopes render history to its requester and exposes only transport-safe facts', function (): void {
    app()->instance(TemplateAuthorization::class, new class implements TemplateAuthorization
    {
        public function authorize(
            TemplateAbility $ability,
            Authenticatable|SystemActor $actor,
            array $context = [],
        ): void {}
    });
    Queue::fake();
    $actor = templateTestActor((string) str()->uuid());
    $otherActor = templateTestActor((string) str()->uuid());
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'],
        SystemActor::Background,
    );
    [$version] = createComposedTemplateVersion(
        $template,
        SystemActor::Background,
        [],
        ['en' => ['text' => 'Welcome']],
    );
    app(TemplateLifecycle::class)->publishVersion(
        $version,
        $version->revision,
        SystemActor::Background,
    );
    $render = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'owned-render', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']],
        $actor,
    );
    $page = app(TemplateReader::class)->renders(
        [],
        $actor,
    );
    $transport = TemplateRenderData::fromModel(
        app(TemplateReader::class)->getRender($render, $actor),
    )->toArray();
    $request = Request::create('/renders/'.$render->id);
    $request->setUserResolver(
        static fn () => $actor,
    );
    $response = app(TemplateRenderController::class)->show(
        $request,
        $render,
        app(TemplateActorFactory::class),
        app(TemplateReader::class),
    );

    expect($page->total())->toBe(1)
        ->and($page->items()[0]->id)->toBe($render->id)
        ->and($transport)->toHaveKeys([
            'id',
            'templateId',
            'templateVersionId',
            'locale',
            'profile',
            'status',
        ])
        ->and($transport)->not->toHaveKeys([
            'payload',
            'settings',
            'failure',
            'processingToken',
        ])
        ->and($response->headers->get('cache-control'))->toContain('no-store');

    expect(fn () => app(TemplateReader::class)->getRender($render, $otherActor))
        ->toThrow(AuthorizationException::class);
});

it('reloads render requester facts and media before disclosure', function (): void {
    app()->instance(TemplateAuthorization::class, new class implements TemplateAuthorization
    {
        public function authorize(
            TemplateAbility $ability,
            Authenticatable|SystemActor $actor,
            array $context = [],
        ): void {}
    });
    Queue::fake();
    $actor = templateTestActor('owner');
    $otherActor = templateTestActor('other');
    $system = SystemActor::Background;
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => [], 'key' => 'welcome'],
        $system,
    );
    [$version] = createComposedTemplateVersion(
        $template,
        $system,
        [],
        ['en' => ['text' => 'Welcome']],
    );
    app(TemplateLifecycle::class)->publishVersion($version, $version->revision, $system);
    $render = app(TemplateRenderer::class)->queue(
        $template,
        ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']],
        $actor,
    );
    $forged = clone $render;
    $forged->requested_by = $otherActor->id;

    expect(fn () => app(TemplateReader::class)->getRender($forged, $otherActor))
        ->toThrow(AuthorizationException::class);

    $render->setRelation('media', new EloquentCollection([
        new Media(['file_name' => 'forged.pdf']),
    ]));
    $resolved = app(TemplateReader::class)->getRender($render, $actor);

    expect($resolved)->not->toBe($render)
        ->and($resolved->media)->toBeEmpty();
});

it('uses persisted template state for both stored render entry points', function (string $action): void {
    Queue::fake();
    $actor = SystemActor::Background;
    $template = app(TemplateLifecycle::class)->create(
        ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => [], 'key' => 'welcome'],
        $actor,
    );
    [$version] = createComposedTemplateVersion(
        $template,
        $actor,
        [],
        ['en' => ['text' => 'Welcome']],
    );
    app(TemplateLifecycle::class)->publishVersion($version, $version->revision, $actor);
    app(TemplateLifecycle::class)->update($template, ['metadata' => [], 'translations' => [], 'status' => TemplateStatus::Archived, 'expected_revision' => $template->revision], $actor);

    expect($template->status)->toBe(TemplateStatus::Active)
        ->and(fn () => $action === 'render' ? app(TemplateRenderer::class)->render($template, ['name' => 'Ada'], ['locale' => 'en'], $actor) : app(TemplateRenderer::class)->queue(
            $template,
            ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']],
            $actor,
        ))->toThrow(TemplateResolutionException::class, 'is not active');
})->with([
    'synchronous' => 'render',
    'queued' => 'queue',
]);

it('checks relative PDF resources against local roots at the file read boundary', function (): void {
    $root = storage_path('framework/testing/template-relative-'.str()->uuid());
    $allowed = $root.'/allowed';
    $outside = $root.'/outside';
    File::ensureDirectoryExists($allowed);
    File::ensureDirectoryExists($outside);
    File::put($allowed.'/logo.png', base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    ));
    File::copy($allowed.'/logo.png', $outside.'/private.png');
    config()->set('nvl-templates.compatibility.assets.allowed_local_roots', [$allowed]);
    $workingDirectory = getcwd();
    chdir($root);

    try {
        $guard = app(PdfHtmlGuard::class);
        $guard->validate('<a href="#section">Jump</a><a href="details/report">Report</a>');
        $rendered = app(PdfService::class)->renderHtml(
            new HtmlPayload('<div style="background-image: url(allowed/logo.png)">Logo</div>'),
            new CompatiblePdfOptions,
        );

        expect($rendered->getContent())->toContain('/Subtype /Image')
            ->and(fn () => app(PdfService::class)->renderHtml(
                new HtmlPayload('<img src="outside/private.png">'),
                new CompatiblePdfOptions,
            ))
            ->toThrow(InvalidArgumentException::class)
            ->and(fn () => app(PdfService::class)->renderHtml(
                new HtmlPayload('<img src="missing.png">'),
                new CompatiblePdfOptions,
            ))
            ->toThrow(InvalidArgumentException::class);
    } finally {
        chdir($workingDirectory);
        File::deleteDirectory($root);
    }
});

it('guards nested PDF image reads after the source HTML has passed validation', function (): void {
    $root = storage_path('framework/testing/template-nested-'.str()->uuid());
    $allowed = $root.'/allowed';
    $outside = $root.'/outside';
    File::ensureDirectoryExists($allowed);
    File::ensureDirectoryExists($outside);
    File::put($outside.'/private.png', base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    ));
    File::put($allowed.'/image.svg', '<svg xmlns="http://www.w3.org/2000/svg" '
        .'xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10">'
        .'<image width="10" height="10" xlink:href="'.$outside.'/private.png"/></svg>');
    config()->set('nvl-templates.compatibility.assets.allowed_local_roots', [$allowed]);

    try {
        expect(fn () => app(PdfService::class)->renderHtml(
            new HtmlPayload('<img src="'.$allowed.'/image.svg">'),
            new CompatiblePdfOptions(new EngineConfig),
        ))->toThrow(InvalidArgumentException::class);
    } finally {
        File::deleteDirectory($root);
    }
});

it('enforces PDF remote asset policy at the actual nested fetch boundary', function (): void {
    Http::fake();
    $root = storage_path('framework/testing/template-nested-remote-'.str()->uuid());
    File::ensureDirectoryExists($root);
    File::put($root.'/image.svg', '<svg xmlns="http://www.w3.org/2000/svg" '
        .'xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10">'
        .'<image width="10" height="10" xlink:href="https://forbidden.example.test/private.png"/></svg>');
    config()->set([
        'nvl-templates.compatibility.assets.allowed_local_roots' => [$root],
        'nvl-templates.pdf.remote_assets.enabled' => true,
        'nvl-templates.pdf.remote_assets.allowed_hosts' => ['allowed.example.test'],
    ]);

    try {
        expect(fn () => app(PdfService::class)->renderHtml(
            new HtmlPayload('<img src="'.$root.'/image.svg">'),
            new CompatiblePdfOptions,
        ))->toThrow(InvalidArgumentException::class);
        Http::assertNothingSent();
    } finally {
        File::deleteDirectory($root);
    }
});

it('fetches allowed PDF assets with bounded bodies and no redirects', function (): void {
    config()->set([
        'nvl-templates.pdf.remote_assets.enabled' => true,
        'nvl-templates.pdf.remote_assets.allowed_hosts' => ['allowed.example.test'],
    ]);
    $png = base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    );
    Http::fake([
        'https://allowed.example.test/logo.png' => Http::response($png),
        'https://allowed.example.test/oversized' => Http::response('12345'),
        'https://allowed.example.test/redirect' => Http::response('', 302, [
            'Location' => 'https://forbidden.example.test/private.png',
        ]),
    ]);
    $rendered = app(PdfService::class)->renderHtml(
        new HtmlPayload('<img src="https://allowed.example.test/logo.png">'),
        new CompatiblePdfOptions,
    );
    expect($rendered->getContent())->toContain('/Subtype /Image');

    config()->set('nvl-templates.compatibility.assets.maximum_bytes', 4);
    $fetcher = app(PdfAssetFetcher::class);
    expect(fn () => $fetcher->fetchDataFromPath('https://allowed.example.test/oversized'))
        ->toThrow(TemplateResolutionException::class, 'byte limit')
        ->and(fn () => $fetcher->fetchDataFromPath('https://allowed.example.test/redirect'))
        ->toThrow(TemplateResolutionException::class, 'unsuccessful response')
        ->and(fn () => $fetcher->fetchDataFromPath('file:///tmp/private.png'))
        ->toThrow(InvalidArgumentException::class)
        ->and(fn () => $fetcher->fetchDataFromPath('https://allowed.example.test:8443/logo.png'))
        ->toThrow(InvalidArgumentException::class);
    Http::assertSentCount(3);
});

it('bounds aggregate PDF asset reads and resets the budget for each render', function (): void {
    config()->set([
        'nvl-templates.pdf.remote_assets.enabled' => true,
        'nvl-templates.pdf.remote_assets.allowed_hosts' => ['allowed.example.test'],
        'nvl-templates.pdf.assets.maximum_count' => 1,
        'nvl-templates.pdf.assets.maximum_total_bytes' => 4,
    ]);
    Http::fake(static fn () => Http::response('123'));
    $fetcher = app(PdfAssetFetcher::class);

    expect($fetcher->fetchDataFromPath('https://allowed.example.test/first'))->toBe('123')
        ->and(fn () => $fetcher->fetchDataFromPath('https://allowed.example.test/second'))
        ->toThrow(TemplateResolutionException::class, 'asset count');
    Http::assertSentCount(1);

    config()->set('nvl-templates.pdf.assets.maximum_count', 2);
    $fetcher = app(PdfAssetFetcher::class);
    $fetcher->fetchDataFromPath('https://allowed.example.test/first');
    expect(fn () => $fetcher->fetchDataFromPath('https://allowed.example.test/second'))
        ->toThrow(TemplateResolutionException::class, 'aggregate');
    $fetcher->beginRender();
    expect($fetcher->fetchDataFromPath('https://allowed.example.test/first'))->toBe('123');
});

it('preserves unique staging indexes while removing canonical name collisions', function (): void {
    try {
        Schema::create('adoption_unique_sources', function (Blueprint $table): void {
            $table->id();
            $table->string('alias');
            $table->string('code');
            $table->unique('alias', 'adoption_constraint_unique');
        });
        DB::statement('CREATE UNIQUE INDEX adoption_standalone_unique ON adoption_unique_sources (code)');
        DB::table('adoption_unique_sources')->insert(['alias' => 'logo', 'code' => 'brand']);
        $schema = app(TemplateAdoptionSchema::class);
        $operations = $schema->prepare(DB::connection()->getName(), ['adoption_unique_sources']);
        $inTx = DB::connection()->getPdo()->inTransaction();
        if ($inTx) {
            DB::connection()->getPdo()->exec('SAVEPOINT test_alias');
        }
        try {
            DB::table('adoption_unique_sources')->insert([
                'alias' => 'logo',
                'code' => 'different',
            ]);
        } catch (QueryException) {
            $duplicateAliasRejected = true;
            if ($inTx) {
                DB::connection()->getPdo()->exec('ROLLBACK TO SAVEPOINT test_alias');
            }
        }

        if ($inTx) {
            DB::connection()->getPdo()->exec('SAVEPOINT test_code');
        }
        try {
            DB::table('adoption_unique_sources')->insert([
                'alias' => 'different',
                'code' => 'brand',
            ]);
        } catch (QueryException) {
            $duplicateCodeRejected = true;
            if ($inTx) {
                DB::connection()->getPdo()->exec('ROLLBACK TO SAVEPOINT test_code');
            }
        }

        expect(array_column($operations, 'operation'))->toBe(['renamed', 'renamed'])
            ->and(collect(Schema::getIndexes('adoption_unique_sources'))->pluck('name'))
            ->not->toContain('adoption_constraint_unique')
            ->not->toContain('adoption_standalone_unique')
            ->and($duplicateAliasRejected)->toBeTrue()
            ->and($duplicateCodeRejected)->toBeTrue()
            ->and(DB::table('adoption_unique_sources')->count())->toBe(1)
            ->and($schema->prepare(DB::connection()->getName(), ['adoption_unique_sources']))->toBe([]);
    } finally {
        Schema::dropIfExists('adoption_unique_sources');
    }
});

it('keeps adoption preflight read-only for invalid scope and locale mappings', function (string $invalid): void {
    $manifest = [
        'version' => 1,
        'legacy_asset_count' => 0,
        'templates' => [[
            'legacy_key' => 'legacy-welcome',
            'key' => 'welcome',
            'translations' => ['en' => ['title' => 'Welcome']],
        ]],
        'content' => [[
            'legacy_key' => 'legacy-copy',
            'legacy_scope' => 'legacy-global',
            'legacy_scope_key' => 'legacy',
            'definition' => 'template-copy',
            'key' => 'adopted-copy',
            'scope' => 'global',
            'scope_key' => '*',
            'translations' => ['en' => ['text' => 'Welcome']],
        ]],
    ];

    if ($invalid === 'scope') {
        $manifest['content'][0]['scope'] = 'unknown';
    } else {
        $manifest['templates'][0]['translations'] = ['xx' => ['title' => 'Welcome']];
    }

    expect(fn () => app(TemplateImporter::class)->adopt($manifest, apply: true))
        ->toThrow(InvalidArgumentException::class)
        ->and(Template::query()->count())->toBe(0)
        ->and(ContentBlock::query()->count())->toBe(0);
})->with(['scope', 'locale']);

it('renders native host mapped TemplateVersion snapshots for immediate and durable requests', function (): void {
    $originalMap = Relation::morphMap();
    $hostMap = array_filter($originalMap, static fn (string $model): bool => $model !== TemplateVersion::class);
    Relation::morphMap(['host-template-version' => TemplateVersion::class] + $hostMap, false);
    try {
        Queue::fake();
        config()->set('nvl-templates.rendering.output.persist', false);
        $actor = SystemActor::Background;
        $template = app(TemplateLifecycle::class)->create(['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => ['en' => ['title' => 'Welcome']], 'key' => 'welcome'], $actor);
        [$version] = createComposedTemplateVersion($template, $actor, [], ['en' => ['text' => 'Native', 'subject' => 'Host identity']]);
        $version = app(TemplateLifecycle::class)->publishVersion($version, $version->revision, $actor);
        expect($version->content_snapshot['ownerType'])->toBe('host-template-version');
        $result = app(TemplateRenderer::class)->render($template, ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']]['payload'], ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']], $actor);
        $render = app(TemplateRenderer::class)->queue($template, ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => 'native-owner', 'download' => false, 'locale' => 'en', 'payload' => ['name' => 'Ada']], $actor);
        $durable = app(StoredTemplateRenderResolver::class)->resolveDurable($render);
        expect($result['content'])->toBe('Native:Ada')
            ->and($result['subject'])->toBe('Host identity')
            ->and($durable['version']->id)->toBe($version->id)
            ->and($durable['version']->content_snapshot['ownerType'])->toBe('host-template-version')
            ->and(Relation::morphMap())->toBe(['host-template-version' => TemplateVersion::class] + $hostMap);
    } finally {
        Relation::morphMap($originalMap, false);
    }
});

it('deletes an admitted template with its draft Content placements through the native lifecycle', function (): void {
    $actor = SystemActor::Background;
    $template = app(TemplateLifecycle::class)->create(['key' => 'welcome'], $actor);
    [$version] = createComposedTemplateVersion($template, $actor, [], ['en' => ['text' => 'Draft']]);
    expect($version->contentPlacements()->count())->toBe(1);
    app(TemplateLifecycle::class)->delete($template, $actor);
    expect(Template::query()->find($template->id))->toBeNull()
        ->and(TemplateVersion::query()->find($version->id))->toBeNull()
        ->and($version->contentPlacements()->count())->toBe(0);
});

it('persists verified queued output through the optional private Media adapter', function (): void {
    Queue::fake();
    config()->set('nvl-templates.rendering.output.persist', true);
    $actor = SystemActor::Background;
    $template = app(TemplateLifecycle::class)->create(['key' => 'welcome'], $actor);
    [$version] = createComposedTemplateVersion($template, $actor, [], ['en' => ['text' => 'Private']]);
    app(TemplateLifecycle::class)->publishVersion($version, $version->revision, $actor);
    $render = app(TemplateRenderer::class)->queue($template, ['locale' => 'en', 'payload' => ['name' => 'Ada']], $actor);
    $completed = app(TemplateRenderer::class)->process($render);
    expect($completed->status)->toBe(TemplateRenderStatus::Completed);
    $media = app(MediaReader::class)->slots($actor, $completed, ['output'])['output'];
    expect($media)->toHaveCount(1)->and($media[0]->is_public)->toBeFalse()
        ->and(Storage::disk($media[0]->disk)->get($media[0]->buildPath()))->toBe('Private:Ada');
});
