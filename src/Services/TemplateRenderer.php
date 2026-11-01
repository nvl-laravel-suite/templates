<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Str;
use Nvl\Media\Services\MediaUploader;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Events\DomainEventDispatcher;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\PdfOrientation;
use Nvl\Templates\Enums\PdfPageSize;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Enums\TemplateRenderStatus;
use Nvl\Templates\Events\TemplateRendered;
use Nvl\Templates\Exceptions\TemplateResolutionException;
use Nvl\Templates\Exceptions\TemplatesException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\Template as StoredTemplate;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Ownership\TemplatesOwnership;
use Nvl\Templates\Support\TemplatesConfiguration;
use Nvl\Templates\Template as RenderableTemplate;
use Throwable;

/**
 * Complete native template operations.
 *
 * @api
 */
final readonly class TemplateRenderer
{
    public function __construct(private TemplateContextFactory $contexts, private TemplateRendererRegistry $renderers, private TemplateOutputGuard $outputGuard, private TemplateAuthorization $authorization, private StoredTemplateRenderResolver $resolver, private OwnershipBoundary $boundary, private CanonicalJson $canonicalJson, private TemplateRenderDispatcher $dispatcher, private DomainEventDispatcher $domainEvents) {}

    /**
     * Render the supplied Template and return verified output bytes.
     *
     * @param  array<string,mixed>  $context
     * @param  array<string,mixed>  $options
     * @return array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}
     */
    public function render(RenderableTemplate|Template|string $template, array $context, array $options, Authenticatable|SystemActor $actor): array
    {
        if ($template instanceof RenderableTemplate) {
            $actor = app(TemplateContentGuard::class)->actor($actor);
            $this->authorization->authorize(TemplateAbility::Render, $actor, ['template' => $template->key]);
            /** @var array{renderer?: string|null, locale?: string|null, subject?: string|null, filename?: string|null, pdf?: array{pageSize?: PdfPageSize|null, orientation?: PdfOrientation|null, margins?: array{left?: float|null, right?: float|null, top?: float|null, bottom?: float|null, header?: float|null, footer?: float|null}|null, defaultFont?: string|null, defaultFontSize?: float|null, dpi?: int|null, imageDpi?: int|null, imageQuality?: int|null, showImageErrors?: bool|null, temporaryDirectory?: string|null, title?: string|null, author?: string|null, creator?: string|null, subject?: string|null, keywords?: string|null, headerView?: string|null, headerHtml?: string|null, headerData?: array<string, mixed>, footerView?: string|null, footerHtml?: string|null, footerData?: array<string, mixed>, watermark?: string|null, watermarkOpacity?: float|null, compress?: bool|null, pdfa?: bool|null, pdfaAuto?: bool|null, protectionPermissions?: list<string>, userPassword?: string|null, ownerPassword?: string|null}|null, rendererOptions?: array<string, mixed>} $codeOptions */
            $codeOptions = [...($template->options ?? []), ...$options];
            $template = new RenderableTemplate($template->key, $template->view, [...$template->data, ...$context], $codeOptions, $template->composition, $template->schema, $template->settings);

            return $this->renderCode($template);
        }

        return $this->renderStored($template, ['payload' => $context, ...$options], $actor);
    }

    /** Native Templates operation.
     * @return array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}
     */
    private function renderCode(RenderableTemplate $template): array
    {
        $context = $this->contexts->make($template);
        $rendered = $this->renderers->get($context->renderer)->render($context);
        $this->outputGuard->validate($context, $rendered);

        return $rendered;
    }

    /**
     * Resolve and render one published stored template.
     *
     * @param  array<string,mixed>  $data
     * @return array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}
     */
    private function renderStored(
        StoredTemplate|string $template,
        array $data,
        Authenticatable|SystemActor $actor,
    ): array {
        $data = app(TemplateContentGuard::class)->render($data);
        $data += ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false];
        $model = $template instanceof StoredTemplate
            ? $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')->findOrFail($template->id)
            : $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')
                ->when(
                    Str::isUuid($template),
                    static fn ($query) => $query
                        ->where('id', $template)
                        ->orWhere('key', $template),
                    static fn ($query) => $query->where('key', $template),
                )
                ->firstOrFail();
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(
            TemplateAbility::Render,
            $actor,
            [
                'template_id' => $model->id,
                'owner_type' => $data['ownerType'],
                'owner_id' => $data['ownerId'],
                'profile' => $data['profile'],
                'version_id' => $data['versionId'],
                'queued' => false,
            ],
        );
        $resolved = $this->resolver->resolve($model, $data, $actor);

        return $this->renderCode($resolved['renderable']);
    }

    /** Persist and dispatch an idempotent producer-scoped render request.
     * @param  array<string,mixed>  $data
     */
    public function queue(
        Template|string $template,
        array $data,
        Authenticatable|SystemActor $actor,
    ): TemplateRender {
        $this->assertDurableOutput();
        $data = app(TemplateContentGuard::class)->render($data);
        $data += ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false];
        $model = $template instanceof Template
            ? $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')->findOrFail($template->id)
            : $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')
                ->when(
                    Str::isUuid($template),
                    static fn ($query) => $query
                        ->where('id', $template)
                        ->orWhere('key', $template),
                    static fn ($query) => $query->where('key', $template),
                )
                ->firstOrFail();
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(
            TemplateAbility::Render,
            $actor,
            [
                'template_id' => $model->id,
                'owner_type' => $data['ownerType'],
                'owner_id' => $data['ownerId'],
                'profile' => $data['profile'],
                'version_id' => $data['versionId'],
                'queued' => true,
            ],
        );
        $resolved = $this->resolver->resolve($model, $data, $actor);
        $requestDigest = $this->canonicalJson->digest([
            'template_id' => $model->id,
            'locale' => $resolved['locale'],
            'payload' => $resolved['payload'],
            'owner_type' => $data['ownerType'],
            'owner_id' => $data['ownerId'],
            'profile' => $data['profile'],
            'version_id' => $data['versionId'],
            'actor_type' => ($actor instanceof Model ? $actor->getMorphClass() : null),
            'actor_id' => TemplateContentGuard::actorId($actor),
        ]);

        $ownershipEnvelope = TemplatesOwnership::envelope();

        try {
            return TemplateModelRegistry::newInstance()->getConnection()
                ->transaction(function () use (
                    $actor,
                    $data,
                    $model,
                    $resolved,
                    $requestDigest,
                    $ownershipEnvelope,
                ): TemplateRender {
                    if ($data['idempotency_key'] !== null) {
                        $existing = $this->boundary->query(TemplateRender::query(), 'templates.renders')
                            ->where('idempotency_key', $data['idempotency_key'])
                            ->lockForUpdate()
                            ->first();

                        if ($existing !== null) {
                            $this->assertEquivalent(
                                $existing,
                                $model,
                                $resolved,
                                $actor,
                                $requestDigest,
                            );

                            return $existing;
                        }
                    }

                    $render = TemplateRender::query()->create([

                        'template_id' => $model->id,
                        'template_version_id' => $resolved['version']->id,
                        'template_assignment_id' => $resolved['assignment']?->id,
                        'locale' => $resolved['locale'],
                        'profile' => $data['profile'],
                        'settings' => $resolved['renderable']->settings,
                        'status' => TemplateRenderStatus::Pending,
                        'idempotency_key' => $data['idempotency_key'],
                        'payload_digest' => $requestDigest,
                        'payload' => $resolved['payload'],
                        'requested_by_type' => ($actor instanceof Model ? $actor->getMorphClass() : null),
                        'requested_by' => TemplateContentGuard::actorId($actor),
                    ]);

                    TemplateModelRegistry::newInstance()->getConnection()
                        ->afterCommit(function () use ($ownershipEnvelope, $render): void {
                            $this->dispatcher->dispatch($render->id, $ownershipEnvelope);
                        });

                    return $render;
                });
        } catch (UniqueConstraintViolationException $exception) {
            if ($data['idempotency_key'] === null) {
                throw $exception;
            }

            $existing = $this->boundary->query(TemplateRender::query(), 'templates.renders')
                ->where('idempotency_key', $data['idempotency_key'])
                ->first();

            if ($existing === null) {
                throw $exception;
            }

            $this->assertEquivalent(
                $existing,
                $model,
                $resolved,
                $actor,
                $requestDigest,
            );

            return $existing;
        }
    }

    /** Native Templates operation.
     * @param  array{template: StoredTemplate, assignment: TemplateAssignment|null, version: TemplateVersion, renderable: RenderableTemplate, locale: string, payload: array<string, mixed>}  $resolved
     */
    private function assertEquivalent(
        TemplateRender $render,
        Template $template,
        array $resolved,
        Authenticatable|SystemActor $actor,
        string $requestDigest,
    ): void {
        if (! hash_equals($render->payload_digest, $requestDigest)
            || $render->template_id !== $template->id
            || $render->locale !== $resolved['locale']
            || $render->requested_by_type !== ($actor instanceof Model ? $actor->getMorphClass() : null)
            || $render->requested_by !== TemplateContentGuard::actorId($actor)) {
            throw new TemplatesException(
                'The template render idempotency key was already used for another request.',
            );
        }
    }

    /**
     * Process one render only while the supplied lease token remains its owner.
     */
    public function process(
        TemplateRender|string $render,
        ?string $processingToken = null,
        ?int $dispatchGeneration = null,
    ): TemplateRender {
        $renderId = $render instanceof TemplateRender ? $render->id : $render;
        $processingToken ??= (string) Str::uuid();
        $model = $this->claim(
            $renderId,
            $processingToken,
            $dispatchGeneration,
        );

        if ($model->status !== TemplateRenderStatus::Processing
            || $model->processing_token !== $processingToken) {
            return $model;
        }

        try {
            $resolved = $this->resolver->resolveDurable($model);
            $result = $this->renderCode($resolved['renderable']);

            return $this->complete($model->id, $processingToken, $result);
        } catch (Throwable $exception) {
            $this->fail($model->id, $processingToken, $exception);

            throw $exception;
        }
    }

    private function claim(
        string $renderId,
        string $processingToken,
        ?int $dispatchGeneration,
    ): TemplateRender {
        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use (
                $dispatchGeneration,
                $renderId,
                $processingToken,
            ): TemplateRender {
                $render = $this->boundary->query(TemplateRender::query(), 'templates.renders')
                    ->lockForUpdate()
                    ->findOrFail($renderId);

                if (($dispatchGeneration !== null
                    && $render->dispatch_generation !== $dispatchGeneration)
                    || $render->status === TemplateRenderStatus::Completed
                    || ($render->status === TemplateRenderStatus::Processing
                        && $render->lease_expires_at?->isFuture())) {
                    return $render;
                }

                $leaseSeconds = TemplatesConfiguration::positiveInteger(
                    'nvl-templates.rendering.lease_seconds',
                    75,
                );
                $render->fill([
                    'status' => TemplateRenderStatus::Processing,
                    'attempts' => $render->attempts + 1,
                    'processing_token' => $processingToken,
                    'lease_expires_at' => now('UTC')->addSeconds($leaseSeconds),
                    'started_at' => now('UTC'),
                    'completed_at' => null,
                    'failed_at' => null,
                    'failure' => null,
                ])->save();

                return $render->refresh();
            });
    }

    /** Native Templates operation.
     * @param  array{content: string, mime_type: string, renderer: string, byte_size: int, checksum: string, subject: string|null, suggested_filename: string|null}  $result
     */
    private function complete(
        string $renderId,
        string $processingToken,
        array $result,
    ): TemplateRender {
        $result += ['subject' => null, 'suggested_filename' => null];

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use (
                $processingToken,
                $renderId,
                $result,
            ): TemplateRender {
                $render = $this->boundary->query(TemplateRender::query(), 'templates.renders')
                    ->lockForUpdate()
                    ->findOrFail($renderId);
                $this->assertLeaseOwner($render, $processingToken);
                $extension = match (true) {
                    str_starts_with($result['mime_type'], 'application/pdf') => 'pdf',
                    str_starts_with($result['mime_type'], 'text/html') => 'html',
                    default => 'txt',
                };
                $fileName = sprintf(
                    '%s-%s.%s',
                    TemplatesConfiguration::string(
                        'nvl-templates.rendering.output.filename_prefix',
                        'template-render',
                    ),
                    $render->id,
                    $extension,
                );
                $this->outputGuard->validateFilename($fileName);

                $this->assertDurableOutput();
                $disk = TemplatesConfiguration::string(
                    'nvl-templates.rendering.output.disk',
                    'local',
                );
                app(MediaTemplateAssetResolver::class)->storeOutput($render, $result, $fileName, $disk, SystemActor::Background);

                $render->fill([
                    'status' => TemplateRenderStatus::Completed,
                    'processing_token' => null,
                    'lease_expires_at' => null,
                    'output_name' => $result['suggested_filename'] ?? $fileName,
                    'output_mime_type' => $result['mime_type'],
                    'completed_at' => now('UTC'),
                    'failed_at' => null,
                    'failure' => null,
                    'payload' => (bool) config('nvl-templates.rendering.store_payload', true)
                        ? $render->payload
                        : null,
                    'settings' => (bool) config('nvl-templates.rendering.store_payload', true)
                        ? $render->settings
                        : null,
                ])->save();
                $this->domainEvents->dispatch(new TemplateRendered(
                    $render->id,
                    $render->template_id,
                    $render->template_version_id,
                ), $render->getConnection());

                return $render->refresh();
            });
    }

    private function fail(
        string $renderId,
        string $processingToken,
        Throwable $exception,
    ): void {
        TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use ($exception, $processingToken, $renderId): void {
                $render = $this->boundary->query(TemplateRender::query(), 'templates.renders')
                    ->lockForUpdate()
                    ->findOrFail($renderId);

                if ($render->status !== TemplateRenderStatus::Processing
                    || $render->processing_token !== $processingToken) {
                    return;
                }

                $render->fill([
                    'status' => TemplateRenderStatus::Failed,
                    'processing_token' => null,
                    'lease_expires_at' => null,
                    'failure' => mb_substr($exception->getMessage(), 0, 4_000),
                    'failed_at' => now('UTC'),
                ])->save();
            });
    }

    /** Reject queued work whose output could not survive its worker process. */
    private function assertDurableOutput(): void
    {
        if (config('nvl-templates.rendering.output.persist', false) !== true) {
            throw new TemplateResolutionException('Queued template rendering requires rendering.output.persist = true and the optional nvl/media output integration.');
        }
        if (! class_exists(MediaUploader::class)) {
            throw new TemplateResolutionException('Persisting queued template output requires nvl/media.');
        }
        $disk = config('nvl-templates.rendering.output.disk');
        if (! is_string($disk) || $disk === '' || ! is_array(config("filesystems.disks.{$disk}"))) {
            throw new TemplateResolutionException('Queued template rendering requires a configured output disk.');
        }
    }

    private function assertLeaseOwner(
        TemplateRender $render,
        string $processingToken,
    ): void {
        if ($render->status !== TemplateRenderStatus::Processing
            || $render->processing_token !== $processingToken) {
            throw new TemplateResolutionException(
                "Template render [{$render->id}] lost its processing lease.",
            );
        }
    }

    /**
     * Recover one bounded batch of stale pending or expired processing renders.
     *
     * @return Collection<int, TemplateRender>
     */
    public function recover(Authenticatable|SystemActor $actor): Collection
    {
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(TemplateAbility::Render, $actor, ['recovery' => true]);

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function (): Collection {

                $ownershipEnvelope = TemplatesOwnership::envelope();
                $limit = TemplatesConfiguration::positiveInteger(
                    'nvl-templates.rendering.recovery_batch_size',
                    100,
                );
                $pendingCutoff = now('UTC')->subSeconds(
                    TemplatesConfiguration::positiveInteger(
                        'nvl-templates.rendering.pending_recovery_seconds',
                        660,
                    ),
                );
                $renders = $this->boundary->query(TemplateRender::query(), 'templates.renders')
                    ->where(function (Builder $query) use ($pendingCutoff): void {
                        $query->where(function (Builder $processing): void {
                            $processing
                                ->where('status', TemplateRenderStatus::Processing->value)
                                ->whereNotNull('lease_expires_at')
                                ->where('lease_expires_at', '<=', now('UTC'));
                        })->orWhere(function (Builder $pending) use ($pendingCutoff): void {
                            $pending
                                ->where('status', TemplateRenderStatus::Pending->value)
                                ->where('updated_at', '<=', $pendingCutoff);
                        });
                    })
                    ->orderBy('updated_at')
                    ->limit($limit)
                    ->lockForUpdate()
                    ->get();

                foreach ($renders as $render) {
                    $render->fill([
                        'status' => TemplateRenderStatus::Pending,
                        'dispatch_generation' => $render->dispatch_generation + 1,
                        'processing_token' => null,
                        'lease_expires_at' => null,
                        'failure' => null,
                        'failed_at' => null,
                    ])->save();
                }

                $renderIds = $renders->modelKeys();
                TemplateModelRegistry::newInstance()->getConnection()
                    ->afterCommit(function () use ($ownershipEnvelope, $renderIds): void {
                        foreach ($renderIds as $renderId) {
                            $this->dispatcher->dispatch((string) $renderId, $ownershipEnvelope);
                        }
                    });

                return $renders;
            });
    }
}
