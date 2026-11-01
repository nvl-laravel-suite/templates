<?php

declare(strict_types=1);
use Illuminate\Support\Facades\File;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Services\PdfTemporaryDirectoryResolver;
use Nvl\Templates\Services\TemplateRenderer;
use Nvl\Templates\Template as RenderableTemplate;
use Nvl\Templates\Tests\Fixtures\Compatibility\Support\PdfConfig\EngineConfig;

it('renders actual PDF bytes through a native absolute temporary directory without escaping its root', function (): void {
    $base = storage_path('app/template-path-pdf-'.str()->uuid());
    $root = $base.DIRECTORY_SEPARATOR.'allowed';
    File::ensureDirectoryExists($root);
    $input = DIRECTORY_SEPARATOR === '\\'
        ? str_replace('\\', '/', $root).'\\nested/work'
        : $root.'/nested/work';
    config()->set([
        'nvl-templates.pdf.temp_path' => $input,
        'nvl-templates.pdf.allowed_temp_roots' => [$root],
    ]);

    try {
        $result = app(TemplateRenderer::class)->render(new RenderableTemplate(
            key: 'native-absolute-pdf-path',
            view: 'template-tests::pdf',
            data: ['name' => 'Canonical PDF path'],
            options: ['renderer' => 'pdf', 'locale' => 'en', 'subject' => 'Native path document', 'filename' => 'native-path.pdf', 'pdf' => (new EngineConfig)->setTempDir($input)->toPdfOptions(), 'rendererOptions' => []],
        ), [], [], SystemActor::Background);

        expect($result['content'])->toStartWith('%PDF-')
            ->and(rtrim($result['content']))->toEndWith('%%EOF')
            ->and($result['mime_type'])->toBe('application/pdf')
            ->and($result['byte_size'])->toBe(strlen($result['content']))
            ->and($result['checksum'])->toBe(hash('sha256', $result['content']))
            ->and($result['suggested_filename'])->toBe('native-path.pdf')
            ->and(app(PdfTemporaryDirectoryResolver::class)->resolve())->toBe(realpath($root.'/nested/work'))
            ->and(fn () => app(PdfTemporaryDirectoryResolver::class)->resolve($root.'/../outside'))
            ->toThrow(InvalidArgumentException::class, 'outside its allowed roots')
            ->and(File::exists($base.DIRECTORY_SEPARATOR.'outside'))->toBeFalse();
    } finally {
        File::deleteDirectory($base);
    }
});

it('retains a supplied shared workspace and its cache after rendering callbacks exit', function (): void {
    $root = storage_path('framework/testing/template-shared-workspace-'.str()->uuid());
    File::ensureDirectoryExists($root);
    File::put($root.'/keep', 'shared cache');
    config(['nvl-templates.pdf.temp_path' => $root]);
    try {
        $directories = app(PdfTemporaryDirectoryResolver::class);
        expect($directories->withDirectory(fn (string $directory): string => $directory))->toBe(realpath($root));
        expect(fn () => $directories->withDirectory(static fn (string $directory) => throw new RuntimeException('Failed render.')))->toThrow(RuntimeException::class);
        expect(File::get($root.'/keep'))->toBe('shared cache');
    } finally {
        File::deleteDirectory($root);
    }
});
