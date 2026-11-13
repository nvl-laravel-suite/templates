<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Mpdf\Mpdf;
use Nvl\Media\Contracts\MediaAuthorization;
use Nvl\Media\Enums\MediaVisibility;
use Nvl\Media\Models\MediaAssociation;
use Nvl\Media\Services\MediaModelRegistry;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Exceptions\RenderUnavailable;
use Nvl\Templates\Models\TemplateAsset;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Services\RenderRequests;
use Nvl\Templates\Services\TemplateAssets;
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Tests\CanonicalTestCase;
use Nvl\Templates\Tests\Fixtures\NativeMpdfAcceptanceDriver;
use Nvl\Templates\Tests\Fixtures\NativePdfAcceptanceMediaPolicy;
use Nvl\Templates\Tests\Support\Documents;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

uses(CanonicalTestCase::class, RefreshDatabase::class);

$sharedMpdfDirectory = null;
$resolvedPopplerTools = null;

afterAll(function () use (&$sharedMpdfDirectory): void {
    if (is_string($sharedMpdfDirectory) && is_dir($sharedMpdfDirectory)) {
        File::deleteDirectory($sharedMpdfDirectory);
        $sharedMpdfDirectory = null;
    }
});

beforeEach(function () use (&$sharedMpdfDirectory, &$resolvedPopplerTools): void {
    if (! class_exists(Mpdf::class)) {
        $this->markTestSkipped('Native PDF acceptance requires the optional development dependency mpdf/mpdf.');
    }
    if ($resolvedPopplerTools === null) {
        $finder = new ExecutableFinder;
        $resolvedPopplerTools = [];
        foreach (['pdfinfo', 'pdftotext', 'pdfimages', 'pdftoppm'] as $tool) {
            $resolvedPopplerTools[$tool] = $finder->find($tool);
        }
    }
    foreach ($resolvedPopplerTools as $tool => $binary) {
        if ($binary === null) {
            $this->markTestSkipped('Native PDF acceptance requires the local Poppler tool '.$tool.'.');
        }
    }

    if ($sharedMpdfDirectory === null || ! is_dir($sharedMpdfDirectory)) {
        $sharedMpdfDirectory = sys_get_temp_dir().'/nvl-native-mpdf-'.bin2hex(random_bytes(10));
        File::ensureDirectoryExists($sharedMpdfDirectory, 0700);
    }
    app()->instance(NativeMpdfAcceptanceDriver::class, new NativeMpdfAcceptanceDriver($sharedMpdfDirectory));
    app()->instance(MediaAuthorization::class, new NativePdfAcceptanceMediaPolicy);
    config()->set([
        'nvl-templates.pdf.driver' => NativeMpdfAcceptanceDriver::class,
        'nvl-media.disk' => 'local', 'nvl-media.private_disk' => 'local', 'nvl-media.allowed_disks' => ['local'],
        'nvl-media.delivery.disks.local' => ['public' => false, 'private' => ['mode' => 'application', 'allowed' => ['application']]],
    ]);
    Http::preventStrayRequests();
});

/** @return array{revision: TemplateRevision, asset: TemplateAsset} */
function nativeMpdfPublication(bool $secondPage = false): array
{
    $actor = SystemActor::Background;
    $asset = app(TemplateAssets::class)->upload(UploadedFile::fake()->image('private-mark.png', 48, 32), $actor);
    $document = Documents::standalone('Native multilingual voucher');
    $document['target'] = 'document';
    $document['source']['definition']['page']['heightMm'] = 297;
    $document['dataSchema']['properties']['facts']['properties']['logo'] = ['type' => 'string'];
    $document['dataSchema']['properties']['facts']['required'][] = 'logo';
    $document['artifacts'] = [
        'engine' => 'bindings',
        'html' => '<!doctype html><html><head><meta charset="utf-8"></head><body><h1>{{headline}}</h1><p>{{message}}</p><p>{{code}}</p><p><img src="{{logo}}" width="48" height="32" alt="Private mark"></p>'
            .($secondPage ? '<div style="page-break-before:always">Second page</div>' : '').'</body></html>',
        'css' => '@page{size:210mm 297mm;margin:10mm}body{font-family:dejavusans;font-size:12pt}h1{font-size:18pt}p{margin:0 0 12pt}',
        'subject' => null, 'text' => null,
        'bindings' => [
            ['id' => 'headline', 'path' => 'content.headline', 'kind' => 'text'],
            ['id' => 'message', 'path' => 'inputs.message', 'kind' => 'text'],
            ['id' => 'code', 'path' => 'facts.code', 'kind' => 'text'],
            ['id' => 'logo', 'path' => 'facts.logo', 'kind' => 'image'],
        ],
    ];
    $lifecycle = app(TemplateLifecycle::class);
    $template = $lifecycle->create(['key' => 'native-mpdf', 'name' => 'Native mPDF acceptance'], $actor);
    $draft = $lifecycle->saveDraft($template->id, $document, 0, $actor);

    return ['revision' => $lifecycle->publish($template->id, $draft->version, $actor), 'asset' => $asset];
}

/** @return list<string> */
function nativeMpdfLanguageSamples(): array
{
    return ['A gift for you', 'Подарък за теб — София', 'Ένα δώρο για εσένα — Αθήνα', 'Un cadou pentru tine — București, ș ț ă â î', 'Literal {{keep_me}}'];
}

/** @return array{facts: array{code: string, logo: string}, inputs: array{message: string}, output: string, options: array{filename: string, maxPages: int}, idempotency_key: string} */
function nativeMpdfRequest(TemplateAsset $asset): array
{
    return [
        'facts' => ['code' => 'PRIVATE-EN-BG-EL-RO', 'logo' => $asset->id],
        'inputs' => ['message' => implode(' | ', nativeMpdfLanguageSamples())],
        'output' => 'pdf', 'options' => ['filename' => 'native-acceptance.pdf', 'maxPages' => 1],
        'idempotency_key' => 'native-mpdf-acceptance',
    ];
}

/** @param list<string> $command */
function nativeMpdfInspect(array $command): string
{
    $executable = (new ExecutableFinder)->find($command[0]);
    if ($executable === null) {
        throw new \LogicException('A required native PDF inspection tool disappeared.');
    }
    $command[0] = $executable;

    return (new Process($command, timeout: 20))->mustRun()->getOutput();
}

function nativeMpdfRevokeGrant(string $grant, TemplateAsset $asset, bool $completed): void
{
    if ($grant === 'template') {
        Gate::define('templates.'.($completed ? 'read' : 'render'), static fn (Authenticatable $actor, ?Model $resource = null): bool => ! $resource instanceof TemplateRevision);

        return;
    }
    $policy = app(MediaAuthorization::class);
    if (! $policy instanceof NativePdfAcceptanceMediaPolicy) {
        throw new \LogicException('The native PDF acceptance policy is unavailable.');
    }
    $policy->deniedDownloadMediaId = $asset->media_id;
}

it('retains a real multilingual PDF with its private image and reuses the accepted bytes', function (): void {
    ['revision' => $revision, 'asset' => $asset] = nativeMpdfPublication();
    $requests = app(RenderRequests::class);
    $actor = SystemActor::Background;
    $data = nativeMpdfRequest($asset);
    $request = $requests->accept($revision->id, $data, $actor);
    $completed = $requests->process($request->id, null, null, $actor);
    expect($completed->status)->toBe('completed', $completed->error ?? '');
    $bytes = $requests->bytes($request->id, $actor);
    expect($requests->bytes($request->id, $actor))->toBe($bytes)
        ->and($requests->accept($revision->id, $data, $actor)->id)->toBe($request->id)
        ->and($requests->process($request->id, null, null, $actor)->attempts)->toBe(1);
    $driver = app(NativeMpdfAcceptanceDriver::class);
    expect($driver->calls)->toBe(1)
        ->and($driver->received?->revisionId)->toBe($revision->id)
        ->and($driver->received?->inlineAssets)->toBe([])
        ->and($completed->result['checksum'])->toBe(hash('sha256', $bytes));
    $media = MediaModelRegistry::query()->findOrFail($completed->result['mediaId']);
    $assetMedia = MediaModelRegistry::query()->findOrFail($asset->media_id);
    expect($media->visibility)->toBe(MediaVisibility::Private)
        ->and($media->is_public)->toBeFalse()
        ->and($assetMedia->visibility)->toBe(MediaVisibility::Private)
        ->and($assetMedia->is_public)->toBeFalse()
        ->and(MediaAssociation::query()->where('media_id', $media->id)->where('collection', 'retained_output')->count())->toBe(1)
        ->and(MediaModelRegistry::query()->count())->toBe(2);

    $pdfPath = $driver->temporaryDirectory.'/native-mpdf-acceptance.pdf';
    expect(file_put_contents($pdfPath, $bytes))->toBe(strlen($bytes));
    $previewPrefix = $driver->temporaryDirectory.'/native-mpdf-acceptance';
    nativeMpdfInspect(['pdftoppm', '-f', '1', '-singlefile', '-r', '100', '-png', $pdfPath, $previewPrefix]);
    expect(is_file($previewPrefix.'.png'))->toBeTrue();
    $artifactDirectory = getenv('NVL_ADDITIONAL_PDF_ARTIFACT_DIR');
    if (is_string($artifactDirectory) && $artifactDirectory !== '') {
        File::ensureDirectoryExists($artifactDirectory, 0700);
        expect(File::copy($pdfPath, $artifactDirectory.'/native-mpdf-acceptance.pdf'))->toBeTrue()
            ->and(File::copy($previewPrefix.'.png', $artifactDirectory.'/native-mpdf-acceptance.png'))->toBeTrue();
    }
    expect(nativeMpdfInspect(['pdfinfo', $pdfPath]))->toMatch('/^Pages:\s+1\s*$/m');
    $text = preg_replace('/\s+/u', ' ', nativeMpdfInspect(['pdftotext', '-enc', 'UTF-8', $pdfPath, '-']));
    expect($text)->toBeString()->toContain('PRIVATE-EN-BG-EL-RO');
    foreach (nativeMpdfLanguageSamples() as $sample) {
        expect($text)->toContain($sample);
    }
    expect(nativeMpdfInspect(['pdfimages', '-list', $pdfPath]))->toMatch('/^\s*1\s+\d+\s+image\s+48\s+32\s/m');
    Http::assertNothingSent();
});

it('refuses a real PDF whose final page count violates the admitted option', function (string $option): void {
    ['revision' => $revision, 'asset' => $asset] = nativeMpdfPublication(secondPage: true);
    $requests = app(RenderRequests::class);
    $actor = SystemActor::Background;
    $data = nativeMpdfRequest($asset);
    $data['options'] = ['filename' => 'two-pages.pdf', $option => 1];
    $request = $requests->accept($revision->id, $data, $actor);
    $failed = $requests->process($request->id, null, null, $actor);
    expect(app(NativeMpdfAcceptanceDriver::class)->pages)->toBe(2)
        ->and($failed->status)->toBe('failed')
        ->and($failed->error)->toBe('invalid_render')
        ->and($failed->result)->toBeNull()
        ->and(MediaModelRegistry::query()->count())->toBe(1);
})->with(['maximum pages' => ['maxPages'], 'expected pages' => ['expectedPages']]);

it('refuses real PDF bytes above the configured limit without retaining output', function (): void {
    ['revision' => $revision, 'asset' => $asset] = nativeMpdfPublication();
    $requests = app(RenderRequests::class);
    $actor = SystemActor::Background;
    $request = $requests->accept($revision->id, nativeMpdfRequest($asset), $actor);
    config()->set('nvl-templates.limits.output_bytes', 8192);
    $failed = $requests->process($request->id, null, null, $actor);
    $driver = app(NativeMpdfAcceptanceDriver::class);
    expect($driver->calls)->toBe(1)
        ->and($driver->size)->toBeGreaterThan(8192)
        ->and($failed->status)->toBe('failed')
        ->and($failed->error)->toBe('invalid_render')
        ->and($failed->result)->toBeNull()
        ->and(MediaModelRegistry::query()->count())->toBe(1);
});

it('denies expired completed PDF bytes before pruning and then removes only the output', function (): void {
    ['revision' => $revision, 'asset' => $asset] = nativeMpdfPublication();
    $requests = app(RenderRequests::class);
    $actor = SystemActor::Background;
    $request = $requests->accept($revision->id, nativeMpdfRequest($asset), $actor);
    $completed = $requests->process($request->id, null, null, $actor);
    expect($completed->status)->toBe('completed');
    $outputMediaId = $completed->result['mediaId'];
    expect($requests->bytes($request->id, $actor))->toStartWith('%PDF-');
    $completed->update(['expires_at' => now()->subSecond()]);
    expect(fn () => $requests->bytes($request->id, $actor))->toThrow(RenderUnavailable::class);
    expect(MediaModelRegistry::query()->whereKey($outputMediaId)->exists())->toBeTrue()
        ->and($requests->prune(10, $actor))->toBe(1)
        ->and(MediaModelRegistry::query()->whereKey($outputMediaId)->exists())->toBeFalse()
        ->and(MediaModelRegistry::query()->whereKey($asset->media_id)->exists())->toBeTrue();
    $expired = $requests->byKey('native-mpdf-acceptance', $actor);
    expect($expired->id)->toBe($request->id)
        ->and($expired->status)->toBe('expired')
        ->and($expired->snapshot)->toBeNull()
        ->and($expired->result)->toBeNull();
});

it('rechecks the accepted PDF release and private image grant before invoking the engine', function (string $grant): void {
    ['revision' => $revision, 'asset' => $asset] = nativeMpdfPublication();
    $requests = app(RenderRequests::class);
    $actor = SystemActor::Background;
    $request = $requests->accept($revision->id, nativeMpdfRequest($asset), $actor);
    nativeMpdfRevokeGrant($grant, $asset, completed: false);
    $failed = $requests->process($request->id, null, null, $actor);
    expect($failed->status)->toBe('failed')
        ->and($failed->error)->toBe('not_authorized')
        ->and($failed->result)->toBeNull()
        ->and(app(NativeMpdfAcceptanceDriver::class)->calls)->toBe(0)
        ->and(MediaModelRegistry::query()->count())->toBe(1);
})->with(['release render grant' => ['template'], 'private image download grant' => ['asset']]);

it('rechecks current release and private image grants before reading retained PDF bytes', function (string $grant): void {
    ['revision' => $revision, 'asset' => $asset] = nativeMpdfPublication();
    $requests = app(RenderRequests::class);
    $actor = SystemActor::Background;
    $request = $requests->accept($revision->id, nativeMpdfRequest($asset), $actor);
    $completed = $requests->process($request->id, null, null, $actor);
    expect($completed->status)->toBe('completed')
        ->and($requests->bytes($request->id, $actor))->toStartWith('%PDF-');
    nativeMpdfRevokeGrant($grant, $asset, completed: true);
    expect(fn () => $requests->bytes($request->id, $actor))->toThrow(AuthorizationException::class);
    expect(app(NativeMpdfAcceptanceDriver::class)->calls)->toBe(1)
        ->and(MediaModelRegistry::query()->whereKey($completed->result['mediaId'])->exists())->toBeTrue();
})->with(['release read grant' => ['template'], 'private image download grant' => ['asset']]);
