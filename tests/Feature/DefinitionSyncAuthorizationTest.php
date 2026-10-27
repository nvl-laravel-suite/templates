<?php

declare(strict_types=1);

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Services\TemplateDefinitionRegistry;
use Nvl\Templates\Services\TemplateDefinitions;
use Nvl\Templates\Services\TemplateModelRegistry;

it('authorizes and persists the same source definition snapshot', function (): void {
    $definitions = app(TemplateDefinitionRegistry::class);
    $definitions->register(['key' => 'source-copy', 'renderer' => 'blade', 'view' => 'templates.source-copy']);
    $snapshot = $definitions->all();
    app()->instance(TemplateAuthorization::class, new class($definitions, $snapshot) implements TemplateAuthorization
    {
        public function __construct(private TemplateDefinitionRegistry $definitions, private array $snapshot) {}

        public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void
        {
            expect($ability)->toBe(TemplateAbility::Update)
                ->and($actor)->toBe(SystemActor::Background)
                ->and($context)->toBe(['operation' => 'synchronize_definitions', 'definitions' => $this->snapshot]);
            $this->definitions->register(['key' => 'late-copy', 'renderer' => 'blade', 'view' => 'templates.late-copy']);
        }
    });

    $plan = app(TemplateDefinitions::class)->sync(SystemActor::Background);
    expect($plan->pluck('key')->all())->toBe(array_keys($snapshot))
        ->and(TemplateModelRegistry::query()->pluck('key')->sort()->values()->all())->toBe(array_keys($snapshot));
});

it('rejects denied source synchronization before any stored definition changes', function (): void {
    app()->instance(TemplateAuthorization::class, new class implements TemplateAuthorization
    {
        public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void
        {
            throw new AuthorizationException('Source synchronization denied.');
        }
    });
    expect(fn () => app(TemplateDefinitions::class)->sync(SystemActor::Background))->toThrow(AuthorizationException::class, 'Source synchronization denied.')
        ->and(TemplateModelRegistry::query()->count())->toBe(0);
});
