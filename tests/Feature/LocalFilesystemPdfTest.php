<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;
use Nvl\Templates\Actions\RenderTemplateAction;
use Nvl\Templates\Data\TemplateOptions;
use Nvl\Templates\Services\PdfTemporaryDirectoryResolver;
use Nvl\Templates\Support\PdfConfig\EngineConfig;
use Nvl\Templates\Template as RenderableTemplate;

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
        $result = app(RenderTemplateAction::class)->execute(new RenderableTemplate(
            key: 'native-absolute-pdf-path',
            view: 'template-tests::pdf',
            data: ['name' => 'Canonical PDF path'],
            options: new TemplateOptions(
                renderer: 'pdf',
                locale: 'en',
                subject: 'Native path document',
                filename: 'native-path.pdf',
                pdf: (new EngineConfig)->setTempDir($input)->toPdfOptions(),
            ),
        ));

        expect($result->content)->toStartWith('%PDF-')
            ->and(rtrim($result->content))->toEndWith('%%EOF')
            ->and($result->mimeType)->toBe('application/pdf')
            ->and($result->byteSize)->toBe(strlen($result->content))
            ->and($result->checksum)->toBe(hash('sha256', $result->content))
            ->and($result->suggestedFilename)->toBe('native-path.pdf')
            ->and(app(PdfTemporaryDirectoryResolver::class)->resolve())->toBe(realpath($root.'/nested/work'))
            ->and(fn () => app(PdfTemporaryDirectoryResolver::class)->resolve($root.'/../outside'))
            ->toThrow(InvalidArgumentException::class, 'outside its allowed roots')
            ->and(File::exists($base.DIRECTORY_SEPARATOR.'outside'))->toBeFalse();
    } finally {
        File::deleteDirectory($base);
    }
});
