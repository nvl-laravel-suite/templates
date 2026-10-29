<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Nvl\Content\Services\ContentSnapshotService;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Events\DomainEventDispatcher;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Enums\TemplateVersionStatus;
use Nvl\Templates\Events\TemplateChanged;
use Nvl\Templates\Exceptions\StaleTemplateException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Translatable\Enums\TranslationSyncMode;
use Nvl\Translatable\Services\RelatedTranslationStore;

/**
 * Complete native template operations.
 *
 * @api
 */
final readonly class TemplateLifecycle
{
    public function __construct(private TemplateAuthorization $authorization, private TemplateDefinitionRegistry $definitions, private TemplateContentGuard $guard, private RelatedTranslationStore $translations, private OwnershipBoundary $boundary, private DomainEventDispatcher $domainEvents) {}

    /**
     * Create one stored template and its localized management metadata.
     *
     * @param  array<string,mixed>  $data
     */
    public function create(array $data, Authenticatable|SystemActor $actor): Template
    {
        $data = app(TemplateContentGuard::class)->createTemplate($data);
        $data += ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => []];
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(TemplateAbility::Create, $actor, ['key' => $data['key']]);
        $definition = $this->definitions->get($data['key']);
        $this->guard->metadata($data['metadata']);

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use ($actor, $data, $definition): Template {
                $template = TemplateModelRegistry::create([
                    ...$this->boundary->attributes('templates.templates'),
                    'key' => $data['key'],
                    'renderer' => $definition['renderer'],
                    'status' => $data['status'],
                    'schema' => $definition['schema'],
                    'metadata' => $data['metadata'],
                ]);
                foreach ($data['translations'] as $locale => $attributes) {
                    $this->translations->upsert($template, $template->translationDefinition(), $locale, $attributes);
                }
                $this->translations->deleteExcept($template, $template->translationDefinition(), array_keys($data['translations']));
                $template->load('translations');
                $this->domainEvents->dispatch(new TemplateChanged($template->id, 'created', $actor), $template->getConnection());

                return $template;
            });
    }

    /**
     * Update one stored template using its exact optimistic revision.
     *
     * Omitted metadata and translations remain unchanged. Explicit empty arrays clear
     * metadata and, in replacement mode, translations.
     *
     * @param  array{status: TemplateStatus|string, expected_revision: int|string, metadata?: array<string, mixed>, translations?: array<string, array{title: string, description?: string|null}>}  $data
     */
    public function update(
        Template|string $template,
        array $data,
        Authenticatable|SystemActor $actor,
        TranslationSyncMode $translationMode = TranslationSyncMode::Replace,
    ): Template {
        $data = app(TemplateContentGuard::class)->updateTemplate($data);
        $templateId = $template instanceof Template ? $template->id : $template;
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(
            TemplateAbility::Update,
            $actor,
            ['template_id' => $templateId],
        );
        if (array_key_exists('metadata', $data)) {
            $this->guard->metadata($data['metadata']);
        }

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use (
                $actor,
                $data,
                $templateId,
                $translationMode,
            ): Template {
                $template = $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')
                    ->lockForUpdate()
                    ->findOrFail($templateId);

                if ($template->revision !== $data['expected_revision']) {
                    throw StaleTemplateException::forResource('template', $template->id);
                }

                $attributes = ['status' => $data['status']];
                if (array_key_exists('metadata', $data)) {
                    $attributes['metadata'] = $data['metadata'];
                }
                $template->fill($attributes)->save();
                if (array_key_exists('translations', $data)) {
                    foreach ($data['translations'] as $locale => $attributes) {
                        $this->translations->upsert($template, $template->translationDefinition(), $locale, $attributes);
                    }
                    if ($translationMode === TranslationSyncMode::Replace) {
                        $this->translations->deleteExcept($template, $template->translationDefinition(), array_keys($data['translations']));
                    }
                }
                $this->domainEvents->dispatch(new TemplateChanged($template->id, 'updated', $actor), $template->getConnection());

                return $template->refresh()->load('translations');
            });
    }

    /** Allocate the next draft version under the canonical template lock.
     * @param  array<string,mixed>  $data
     */
    public function createVersion(
        Template|string $template,
        array $data,
        Authenticatable|SystemActor $actor,
    ): TemplateVersion {
        $data = app(TemplateContentGuard::class)->createVersion($data);
        $data += ['metadata' => []];
        $templateId = $template instanceof Template ? $template->id : $template;
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(
            TemplateAbility::Update,
            $actor,
            ['template_id' => $templateId],
        );

        $this->guard->metadata($data['metadata']);

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use ($actor, $data, $templateId): TemplateVersion {
                $template = $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')
                    ->lockForUpdate()
                    ->findOrFail($templateId);
                $currentVersion = $template->versions()->max('version');
                $nextVersion = is_numeric($currentVersion) ? ((int) $currentVersion) + 1 : 1;
                $version = $template->versions()->create([

                    'version' => $nextVersion,
                    'metadata' => $data['metadata'],
                ]);
                $this->domainEvents->dispatch(new TemplateChanged($template->id, 'version_created', $actor), $template->getConnection());

                return $version;
            });
    }

    /** Update draft metadata while rejecting stale or immutable publications.
     * Omitted metadata remains unchanged; an explicit empty array clears it.
     *
     * @param  array{expected_revision: int|string, metadata?: array<string, mixed>}  $data
     */
    public function updateVersion(
        TemplateVersion|string $version,
        array $data,
        Authenticatable|SystemActor $actor,
    ): TemplateVersion {
        $data = app(TemplateContentGuard::class)->updateVersion($data);
        $versionId = $version instanceof TemplateVersion ? $version->id : $version;
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(
            TemplateAbility::Update,
            $actor,
            ['version_id' => $versionId],
        );
        if (array_key_exists('metadata', $data)) {
            $this->guard->metadata($data['metadata']);
        }

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use ($actor, $data, $versionId): TemplateVersion {
                $version = $this->boundary->query(TemplateVersion::query(), 'templates.versions')
                    ->lockForUpdate()
                    ->findOrFail($versionId);

                if ($version->revision !== $data['expected_revision']) {
                    throw StaleTemplateException::forResource('template version', $version->id);
                }

                if ($version->status !== TemplateVersionStatus::Draft) {
                    throw new InvalidArgumentException(
                        'Published and retired template versions are immutable.',
                    );
                }

                $attributes = [
                    'content_snapshot' => null,
                    'content_hash' => null,
                ];
                if (array_key_exists('metadata', $data)) {
                    $attributes['metadata'] = $data['metadata'];
                }
                $version->fill($attributes)->save();
                $this->domainEvents->dispatch(new TemplateChanged($version->template_id, 'version_updated', $actor), $version->getConnection());

                return $version->refresh();
            });
    }

    /**
     * Publish one synchronized draft and retire its published predecessor.
     */
    public function publishVersion(
        TemplateVersion|string $version,
        int $expectedRevision,
        Authenticatable|SystemActor $actor,
    ): TemplateVersion {
        if (! config('nvl-templates.integrations.content', false) || ! class_exists(ContentSnapshotService::class)) {
            throw new InvalidArgumentException('Publishing stored template Content requires the enabled Content integration.');
        }
        $versionId = $version instanceof TemplateVersion ? $version->id : $version;
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $this->authorization->authorize(
            TemplateAbility::Publish,
            $actor,
            ['version_id' => $versionId],
        );

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use ($actor, $expectedRevision, $versionId): TemplateVersion {
                $version = $this->boundary->query(TemplateVersion::query(), 'templates.versions')
                    ->lockForUpdate()
                    ->findOrFail($versionId);
                $template = $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')
                    ->lockForUpdate()
                    ->findOrFail($version->template_id);
                $version->setRelation('template', $template);

                if ($version->revision !== $expectedRevision) {
                    throw StaleTemplateException::forResource('template version', $version->id);
                }

                if ($version->status !== TemplateVersionStatus::Draft) {
                    throw new InvalidArgumentException(
                        'Only draft template versions can be published.',
                    );
                }

                $definition = $this->definitions->get($template->key);
                $canonicalJson = new CanonicalJson;

                if ($template->status !== TemplateStatus::Active
                    || $template->renderer !== $definition['renderer']
                    || $canonicalJson->digest($template->schema)
                        !== $canonicalJson->digest($definition['schema'])) {
                    throw new InvalidArgumentException(
                        "Template [{$template->key}] must be active and synchronized before publication.",
                    );
                }

                $snapshot = app(ContentSnapshotService::class)->capture(
                    $version,
                    TemplateVersion::CONTENT_GROUP,
                    $actor,
                    publishing: true,
                );
                $this->assertComposition($snapshot['blocks'], $definition);

                $publishedVersions = $this->boundary->query(TemplateVersion::query(), 'templates.versions')
                    ->where('template_id', $version->template_id)
                    ->where('id', '!=', $version->id)
                    ->where('status', TemplateVersionStatus::Published->value)
                    ->lockForUpdate()
                    ->get();

                foreach ($publishedVersions as $publishedVersion) {
                    $publishedVersion->fill([
                        'status' => TemplateVersionStatus::Retired,
                    ])->save();
                }

                $version->fill([
                    'status' => TemplateVersionStatus::Published,
                    'content_snapshot' => $snapshot,
                    'content_hash' => $snapshot['version'],
                    'published_by_type' => ($actor instanceof Model ? $actor->getMorphClass() : null),
                    'published_by' => TemplateContentGuard::actorId($actor),
                    'published_at' => now(),
                ])->save();
                $this->domainEvents->dispatch(new TemplateChanged($version->template_id, 'version_published', $actor), $version->getConnection());

                return $version->refresh();
            });
    }

    /**
     * @param  array{key: string, renderer: string, view: string, profiles: list<string>, schema: array<string, mixed>, rendererOptions: array<string, mixed>, subjectPath: string|null, requiredRegions: list<string>, allowedContentDefinitions: list<string>}  $definition
     * @param  list<array{region:string,definitionKey:string,...}>  $blocks
     */
    private function assertComposition(
        array $blocks,
        array $definition,
    ): void {
        $definition += ['profiles' => ['default'], 'schema' => [], 'rendererOptions' => [], 'subjectPath' => null, 'requiredRegions' => [], 'allowedContentDefinitions' => []];
        if ($blocks === []) {
            throw new InvalidArgumentException(
                'A template version cannot be published without Content block placements.',
            );
        }

        $regions = [];

        foreach ($blocks as $block) {
            $regions[$block['region']] = true;

            if ($definition['allowedContentDefinitions'] !== []
                && ! in_array(
                    $block['definitionKey'],
                    $definition['allowedContentDefinitions'],
                    true,
                )) {
                throw new InvalidArgumentException(
                    "Content definition [{$block['definitionKey']}] is not allowed in template [{$definition['key']}].",
                );
            }
        }

        foreach ($definition['requiredRegions'] as $region) {
            if (! isset($regions[$region])) {
                throw new InvalidArgumentException(
                    "Template [{$definition['key']}] requires Content region [{$region}].",
                );
            }
        }
    }

    /** Delete the admitted template and its dependent versions in the source transaction. */
    public function delete(Template|string $template, Authenticatable|SystemActor $actor): void
    {
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $id = $template instanceof Template ? $template->id : $template;
        TemplateModelRegistry::newInstance()->getConnection()->transaction(function () use ($id, $actor): void {
            $model = $this->boundary->query(TemplateModelRegistry::query(), 'templates.templates')->lockForUpdate()->findOrFail($id);
            $this->authorization->authorize(TemplateAbility::Delete, $actor, ['template_id' => $model->id]);
            foreach ($model->versions()->get() as $version) {
                $version->delete();
            }
            $model->delete();
        });
    }
}
