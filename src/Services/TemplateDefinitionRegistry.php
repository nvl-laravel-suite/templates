<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use InvalidArgumentException;
use Nvl\Templates\Contracts\TemplatePayloadValidator;

/**
 * Central registry for source-controlled views, renderers, profiles, and schemas.
 */
final class TemplateDefinitionRegistry
{
    /** @var array<string, array{key: string, renderer: string, view: string, profiles: list<string>, schema: array<string, mixed>, rendererOptions: array<string, mixed>, subjectPath: string|null, requiredRegions: list<string>, allowedContentDefinitions: list<string>}> */
    private array $definitions = [];

    public function __construct(
        private readonly TemplateContentGuard $guard,
        private readonly TemplatePayloadValidator $payloadValidator,
        private readonly StoredTemplateOptionsFactory $optionsFactory,
        private readonly TemplateRendererRegistry $renderers,
    ) {}

    /**
     * Validate and register one source-controlled stored-template definition.
     *
     * @param  array{key: string, renderer: string, view: string, profiles?: list<string>, schema?: array<string, mixed>, rendererOptions?: array<string, mixed>, subjectPath?: string|null, requiredRegions?: list<string>, allowedContentDefinitions?: list<string>}  $definition
     */
    public function register(array $definition): void
    {
        $definition += ['profiles' => ['default'], 'schema' => [], 'rendererOptions' => [], 'subjectPath' => null, 'requiredRegions' => [], 'allowedContentDefinitions' => []];
        if (isset($this->definitions[$definition['key']])) {
            throw new InvalidArgumentException(
                "Template definition [{$definition['key']}] is already registered.",
            );
        }

        if (preg_match('/^[a-z][a-z0-9_.-]*$/', $definition['key']) !== 1) {
            throw new InvalidArgumentException(
                "Template definition key [{$definition['key']}] is invalid.",
            );
        }

        $this->assertAlias($definition['renderer'], 'renderer');

        if (! $this->renderers->has($definition['renderer'])) {
            throw new InvalidArgumentException(
                "Template renderer [{$definition['renderer']}] is not registered.",
            );
        }

        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9_.:\\/-]*$/', $definition['view']) !== 1
            || str_contains($definition['view'], '..')
            || str_starts_with($definition['view'], '/')) {
            throw new InvalidArgumentException(
                'A template definition requires a safe source-controlled view name.',
            );
        }

        if ($definition['profiles'] === []
            || count($definition['profiles']) !== count(array_unique($definition['profiles']))) {
            throw new InvalidArgumentException(
                "Template definition [{$definition['key']}] requires unique profiles.",
            );
        }

        foreach ($definition['profiles'] as $profile) {
            $this->assertAlias($profile, 'profile');
        }

        if ($definition['subjectPath'] !== null
            && preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]*$/', $definition['subjectPath']) !== 1) {
            throw new InvalidArgumentException(
                "Template subject path [{$definition['subjectPath']}] is invalid.",
            );
        }

        foreach ([
            'required Content region' => $definition['requiredRegions'],
            'allowed Content definition' => $definition['allowedContentDefinitions'],
        ] as $kind => $aliases) {
            if (count($aliases) !== count(array_unique($aliases))) {
                throw new InvalidArgumentException(
                    "Template definition [{$definition['key']}] requires unique {$kind} aliases.",
                );
            }

            foreach ($aliases as $alias) {
                $this->assertAlias($alias, $kind);
            }
        }

        $this->guard->schema($definition['schema']);
        $this->guard->rendererOptions($definition['rendererOptions']);
        $this->payloadValidator->validateSchema($definition['schema']);
        $this->optionsFactory->make(
            renderer: $definition['renderer'],
            locale: 'en',
            subject: null,
            configured: $definition['rendererOptions'],
        );
        $this->definitions[$definition['key']] = $definition;
        ksort($this->definitions);
    }

    /**
     * Return one registered definition by key.
     *
     * @return array{key: string, renderer: string, view: string, profiles: list<string>, schema: array<string, mixed>, rendererOptions: array<string, mixed>, subjectPath: string|null, requiredRegions: list<string>, allowedContentDefinitions: list<string>}
     */
    public function get(string $key): array
    {
        return $this->definitions[$key]
            ?? throw new InvalidArgumentException("Template definition [{$key}] is not registered.");
    }

    /**
     * Return all registered definitions in deterministic key order.
     *
     * @return array<string, array{key: string, renderer: string, view: string, profiles: list<string>, schema: array<string, mixed>, rendererOptions: array<string, mixed>, subjectPath: string|null, requiredRegions: list<string>, allowedContentDefinitions: list<string>}>
     */
    public function all(): array
    {
        return $this->definitions;
    }

    private function assertAlias(string $alias, string $kind): void
    {
        if (preg_match('/^[a-z][a-z0-9_.-]*$/', $alias) !== 1) {
            throw new InvalidArgumentException(
                "Template {$kind} [{$alias}] is invalid.",
            );
        }
    }
}
