<?php

declare(strict_types=1);

namespace Nvl\Templates\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use InvalidArgumentException;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateRender;
use Nvl\Templates\Models\TemplateVersion;

/**
 * Builds TemplateRender fixture rows and their declared package parents.
 *
 * @extends Factory<TemplateRender>
 *
 * @api
 */
final class TemplateRenderFactory extends Factory
{
    protected $model = TemplateRender::class;

    /**
     * Prepare native parent and owner facts after Laravel expands relationships.
     *
     * @internal
     */
    public function configure(): static
    {
        $expandRelationships = true;

        return $this->state(function () use (&$expandRelationships): array {
            $expandRelationships = $this->expandRelationships;

            return [];
        })->afterMaking(function (TemplateRender $model) use (&$expandRelationships): void {
            if (! $expandRelationships) {
                return;
            }

            if ($model->getAttribute('template_version_id') !== null) {
                $parent = TemplateVersion::query()->findOrFail(FactoryGuard::identifier($model->getAttribute('template_version_id')));
                FactoryGuard::parent($parent, $model);
                FactoryGuard::inherit($model, $parent);
                if ($model->template_id !== $parent->template_id) {
                    throw new InvalidArgumentException('Render fixtures must use the version template.');
                }
            }
        });
    }

    /**
     * Define the fixture's persisted attributes.
     *
     * @return array<model-property<TemplateRender>, mixed>
     */
    public function definition(): array
    {
        return [
            'template_version_id' => TemplateVersion::factory(),
            'template_id' => fn (array $attributes): ?string => $attributes['template_version_id'] === null ? null : TemplateVersion::query()->findOrFail(FactoryGuard::identifier($attributes['template_version_id']))->template_id,
            'locale' => 'en',
            'profile' => 'default',
            'status' => 'pending',
            'payload_digest' => hash('sha256', '[]'),
            'payload' => [],
            'attempts' => 0,
        ];
    }

    /**
     * Associate an admitted persisted TemplateVersion parent.
     *
     * @api
     */
    public function forVersion(TemplateVersion $parent): static
    {
        FactoryGuard::parent($parent, new TemplateRender);

        return $this->state([
            'template_version_id' => $parent->getKey(),
            'template_id' => $parent->template_id,
        ]);
    }

    /** Associate an assignment with its explicit version and template graph.
     *
     * @api
     */
    public function forAssignment(TemplateAssignment $assignment): static
    {
        FactoryGuard::parent($assignment, new TemplateRender);
        if ($assignment->template_version_id === null) {
            throw new InvalidArgumentException('Render assignment fixtures require an explicit assignment version.');
        }

        return $this->state([
            'template_assignment_id' => $assignment->getKey(),
            'template_id' => $assignment->template_id,
            'template_version_id' => $assignment->template_version_id,
            'profile' => $assignment->profile,
            'settings' => $assignment->settings,
        ]);
    }
}
