<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Content\Services\ContentSnapshotService;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Ownership\Contracts\OwnershipBoundary;
use Nvl\Templates\Contracts\TemplatePayloadValidator;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Enums\TemplateVersionStatus;
use Nvl\Templates\Exceptions\TemplateResolutionException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Template as RenderableTemplate;

/**
 * Resolves every stored-template invariant into one immutable render plan.
 *
 * @internal
 */
final readonly class StoredTemplateRenderResolver
{
    /** Retain the canonical services and immutable inputs for this workflow. */
    public function __construct(
        private TemplateContentGuard $guard,
        private TemplateDefinitionRegistry $definitions,
        private TemplatePayloadValidator $payloadValidator,
        private TemplateLocaleResolver $locales,
        private TemplateVersionResolver $versions,
        private StoredTemplateOptionsFactory $optionsFactory,
        private OwnershipBoundary $boundary,
    ) {}

    /**
     * Resolve and validate a stored template without producing output bytes.
     *
     * @param  array{locale: string, payload: array<string, mixed>, ownerType: string|null, ownerId: string|null, profile: string, versionId: string|null, idempotency_key: string|null, download: bool}  $data
     * @return array{template: Template, assignment: TemplateAssignment|null, version: TemplateVersion, renderable: RenderableTemplate, locale: string, payload: array<string, mixed>}
     */
    public function resolve(
        Template $template,
        array $data,
        Authenticatable|SystemActor $actor,
    ): array {
        $data += ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false];
        $this->boundary->assertRecord($template, 'templates.templates');
        $payload = $this->guard->payload($data['payload']);
        $locale = $this->locales->resolve($data['locale']);
        $definition = $this->definition($template);

        if ($template->status !== TemplateStatus::Active) {
            throw new TemplateResolutionException(
                "Template [{$template->key}] is not active.",
            );
        }

        if (! in_array($data['profile'], $definition['profiles'], true)) {
            throw new TemplateResolutionException(
                "Template profile [{$data['profile']}] is not registered.",
            );
        }

        $assignment = $this->assignment($template, $data);
        $settings = $this->guard->settings(
            is_array($assignment?->settings) ? $assignment->settings : [],
        );
        $version = $this->versions->forRender($template, $data, $assignment, $actor);

        return $this->makePlan(
            template: $template,
            assignment: $assignment,
            version: $version,
            definition: $definition,
            locale: $locale,
            payload: $payload,
            settings: $settings,
            actor: $actor,
        );
    }

    /**
     * Resolve the exact immutable request captured by a durable render record.
     *
     * @return array{template: Template, assignment: TemplateAssignment|null, version: TemplateVersion, renderable: RenderableTemplate, locale: string, payload: array<string, mixed>}
     */
    public function resolveDurable(TemplateRender $render): array
    {
        $this->boundary->assertRecord($render, 'templates.renders');
        $template = $render->template;
        $version = $render->version;
        $payload = $this->guard->payload(is_array($render->payload) ? $render->payload : []);
        $settings = $this->guard->settings(
            is_array($render->settings) ? $render->settings : [],
        );
        $locale = $this->locales->resolve($render->locale);
        $definition = $this->definition($template);

        if ($version->template_id !== $template->id
            || ! in_array($version->status, [
                TemplateVersionStatus::Published,
                TemplateVersionStatus::Retired,
            ], true)) {
            throw new TemplateResolutionException(
                'A durable template render must reference an immutable published version.',
            );
        }

        return $this->makePlan(
            template: $template,
            assignment: $render->assignment,
            version: $version,
            definition: $definition,
            locale: $locale,
            payload: $payload,
            settings: $settings,
            actor: SystemActor::Background,
        );
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $settings
     * @param  array{key: string, renderer: string, view: string, profiles: list<string>, schema: array<string, mixed>, rendererOptions: array<string, mixed>, subjectPath: string|null, requiredRegions: list<string>, allowedContentDefinitions: list<string>}  $definition
     * @return array{template: Template, assignment: TemplateAssignment|null, version: TemplateVersion, renderable: RenderableTemplate, locale: string, payload: array<string, mixed>}
     */
    private function makePlan(
        Template $template,
        ?TemplateAssignment $assignment,
        TemplateVersion $version,
        array $definition,
        string $locale,
        array $payload,
        array $settings,
        Authenticatable|SystemActor $actor,
    ): array {
        $definition += ['profiles' => ['default'], 'schema' => [], 'rendererOptions' => [], 'subjectPath' => null, 'requiredRegions' => [], 'allowedContentDefinitions' => []];
        $this->payloadValidator->validate($definition['schema'], $payload);
        $snapshot = $version->content_snapshot;

        if ($snapshot === null) {
            throw new TemplateResolutionException(
                "Template [{$template->key}] version [{$version->version}] has no Content snapshot.",
            );
        }

        if (! hash_equals((string) $version->content_hash, $snapshot['version'])
            || $snapshot['ownerType'] !== $version->getMorphClass()
            || $snapshot['ownerId'] !== $version->id
            || $snapshot['group'] !== TemplateVersion::CONTENT_GROUP) {
            throw new TemplateResolutionException(
                'Template Content snapshot identity or integrity is invalid.',
            );
        }

        $composition = app(ContentSnapshotService::class)->render(
            $snapshot,
            $locale,
            $actor,
        );
        $subject = $definition['subjectPath'] === null
            ? null
            : $this->guard->compositionValue($composition, $definition['subjectPath']);

        if ($subject !== null && ! is_string($subject)) {
            throw new TemplateResolutionException(
                "Template subject path [{$definition['subjectPath']}] must resolve to text.",
            );
        }

        return ['template' => $template, 'assignment' => $assignment, 'version' => $version, 'renderable' => new RenderableTemplate(
            key: $template->key,
            view: $definition['view'],
            data: $payload,
            options: $this->optionsFactory->make(
                renderer: $template->renderer,
                locale: $locale,
                subject: $subject,
                configured: $definition['rendererOptions'],
            ),
            composition: $composition,
            schema: $definition['schema'],
            settings: $settings,
        ), 'locale' => $locale, 'payload' => $payload];
    }

    /** Native Templates operation.
     * @return array{key: string, renderer: string, view: string, profiles: list<string>, schema: array<string, mixed>, rendererOptions: array<string, mixed>, subjectPath: string|null, requiredRegions: list<string>, allowedContentDefinitions: list<string>}
     */
    private function definition(Template $template): array
    {
        $definition = $this->definitions->get($template->key);
        $canonicalJson = new CanonicalJson;

        if ($template->renderer !== $definition['renderer']
            || $canonicalJson->digest($template->schema)
                !== $canonicalJson->digest($definition['schema'])) {
            throw new TemplateResolutionException(
                "Template [{$template->key}] is stale; synchronize its source definition.",
            );
        }

        return $definition;
    }

    /** Native Templates operation.
     * @param  array{locale: string, payload: array<string, mixed>, ownerType: string|null, ownerId: string|null, profile: string, versionId: string|null, idempotency_key: string|null, download: bool}  $data
     */
    private function assignment(
        Template $template,
        array $data,
    ): ?TemplateAssignment {
        $data += ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false];
        if (($data['ownerType'] === null) !== ($data['ownerId'] === null)) {
            throw new TemplateResolutionException(
                'Template assignment resolution requires both owner type and owner id.',
            );
        }

        if ($data['ownerType'] === null || $data['ownerId'] === null) {
            return null;
        }

        return $this->boundary->query(TemplateAssignment::query(), 'templates.assignments')
            ->where('template_id', $template->id)
            ->where('owner_type', $data['ownerType'])
            ->where('owner_id', $data['ownerId'])
            ->where('profile', $data['profile'])
            ->first()
            ?? throw new TemplateResolutionException(
                'No matching template assignment exists for the requested owner and profile.',
            );
    }
}
