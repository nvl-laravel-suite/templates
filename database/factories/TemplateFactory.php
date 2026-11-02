<?php

declare(strict_types=1);

namespace Nvl\Templates\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Native document fixtures; production mutations use TemplateLifecycle.
 *
 * @extends Factory<Template>
 *
 * @api
 */
final class TemplateFactory extends Factory
{
    protected $model = Template::class;

    /** Resolve the exact configured native root. */
    public function modelName(): string
    {
        return TemplateModelRegistry::modelClass();
    }

    /** @return array<model-property<Template>,mixed> */
    public function definition(): array
    {
        return [
            'key' => $this->faker->unique()->slug(3),
            'name' => $this->faker->sentence(3),
            'status' => 'active',
            'version' => 0,
            'group_id' => null,
            'current_revision_id' => null,
        ];
    }
}
