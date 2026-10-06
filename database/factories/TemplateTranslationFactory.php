<?php

declare(strict_types=1);

namespace Nvl\Templates\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateTranslation;

/**
 * Builds TemplateTranslation fixture rows and their declared package parents.
 *
 * @extends Factory<TemplateTranslation>
 *
 * @api
 */
final class TemplateTranslationFactory extends Factory
{
    protected $model = TemplateTranslation::class;

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
        })->afterMaking(function (TemplateTranslation $model) use (&$expandRelationships): void {
            if (! $expandRelationships) {
                return;
            }

            if ($model->getAttribute('template_id') !== null) {
                $parent = Template::query()->findOrFail(FactoryGuard::identifier($model->getAttribute('template_id')));
                FactoryGuard::parent($parent, $model);
                FactoryGuard::inherit($model, $parent);
            }
        });
    }

    /**
     * Define the fixture's persisted attributes.
     *
     * @return array<model-property<TemplateTranslation>, mixed>
     */
    public function definition(): array
    {
        return [
            'template_id' => Template::factory(),
            'locale' => 'en',
            'title' => $this->faker->sentence(3),
        ];
    }

    /**
     * Associate an admitted persisted Template parent.
     *
     * @api
     */
    public function forTemplate(Template $parent): static
    {
        FactoryGuard::parent($parent, new TemplateTranslation);

        return $this->state([
            'template_id' => $parent->getKey(),
        ]);
    }
}
