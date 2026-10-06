<?php

declare(strict_types=1);

namespace Nvl\Templates\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Nvl\Templates\Models\Template;

/**
 * Builds Template fixture rows and their declared package parents.
 *
 * @extends Factory<Template>
 *
 * @api
 */
final class TemplateFactory extends Factory
{
    protected $model = Template::class;

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
        })->afterMaking(function (Template $model) use (&$expandRelationships): void {
            if (! $expandRelationships) {
                return;
            }

            FactoryGuard::root($model, 'templates.templates');
        });
    }

    /**
     * Define the fixture's persisted attributes.
     *
     * @return array<model-property<Template>, mixed>
     */
    public function definition(): array
    {
        return [
            'key' => $this->faker->unique()->slug(3),
            'renderer' => 'blade',
            'status' => 'active',
            'revision' => 1,
        ];
    }
}
