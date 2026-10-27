<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Collection;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Models\Template;

/**
 * Complete native template operations.
 *
 * @api
 */
final readonly class TemplateDefinitions
{
    public function __construct(private TemplateDefinitionRegistry $definitions, private TemplateAuthorization $authorization) {}

    /**
     * Plan or apply one complete source-definition synchronization.
     *
     * @return Collection<int, array{key: string, operation: string}>
     */
    public function sync(Authenticatable|SystemActor $actor, bool $dryRun = false): Collection
    {
        $actor = app(TemplateContentGuard::class)->actor($actor);
        $registered = $this->definitions->all();
        $this->authorization->authorize(TemplateAbility::Update, $actor, [
            'operation' => 'synchronize_definitions',
            'definitions' => $registered,
        ]);

        return TemplateModelRegistry::newInstance()->getConnection()
            ->transaction(function () use ($dryRun, $registered): Collection {
                $canonicalJson = new CanonicalJson;
                $registeredKeys = array_keys($registered);
                $stored = TemplateModelRegistry::query()
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('key');
                $plan = new Collection;

                foreach ($registered as $definition) {
                    $template = $stored->get($definition['key']);
                    $operation = ! $template instanceof Template
                        ? 'create'
                        : ($template->renderer !== $definition['renderer']
                            || $canonicalJson->digest($template->schema)
                                !== $canonicalJson->digest($definition['schema'])
                            || $template->status === TemplateStatus::Archived
                                ? 'update'
                                : 'unchanged');
                    $plan->push(['key' => $definition['key'], 'operation' => $operation]);

                    if ($dryRun || $operation === 'unchanged') {
                        continue;
                    }

                    $attributes = [
                        'key' => $definition['key'],
                        'renderer' => $definition['renderer'],
                        'status' => TemplateStatus::Active,
                        'schema' => $definition['schema'],
                    ];
                    if ($template === null) {
                        $template = TemplateModelRegistry::create($attributes);
                    } else {
                        $template->fill($attributes)->save();
                    }
                }

                foreach ($stored as $key => $template) {
                    if (in_array((string) $key, $registeredKeys, true)) {
                        continue;
                    }

                    $operation = $template->status === TemplateStatus::Archived
                        ? 'unchanged'
                        : 'archive';
                    $plan->push(['key' => $template->key, 'operation' => $operation]);

                    if (! $dryRun && $operation === 'archive') {
                        $template->fill([
                            'status' => TemplateStatus::Archived,
                        ])->save();
                    }
                }

                return $plan->values();
            });
    }
}
