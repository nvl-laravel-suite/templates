<?php

declare(strict_types=1);

namespace Nvl\Templates\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateAssignment;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Ownership\TemplatesOwnership;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Builds TemplateAssignment fixture rows and their declared package parents.
 *
 * @extends Factory<TemplateAssignment>
 *
 * @api
 */
final class TemplateAssignmentFactory extends Factory
{
    protected $model = TemplateAssignment::class;

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
        })->afterMaking(function (TemplateAssignment $model) use (&$expandRelationships): void {
            if (! $expandRelationships) {
                return;
            }

            $owner = FactoryGuard::owner($model, 'owner_type', 'owner_id');
            if ($model->getAttribute('template_id') !== null) {
                $parent = TemplateModelRegistry::query()->findOrFail(FactoryGuard::identifier($model->getAttribute('template_id')));
                FactoryGuard::parent($parent, $model);
                FactoryGuard::inherit($model, $parent);
            }
            if ($model->getAttribute('template_version_id') !== null) {
                $parent = TemplateVersion::query()->findOrFail(FactoryGuard::identifier($model->getAttribute('template_version_id')));
                FactoryGuard::parent($parent, $model);
                FactoryGuard::inherit($model, $parent);
                if ($parent->template_id !== $model->template_id) {
                    throw new InvalidArgumentException('Assignment fixtures require a version belonging to their template.');
                }
            }
            if (config('nvl-tenancy.enabled') === true && $owner->getRawOriginal('tenant_id') !== $model->getAttribute('tenant_id')) {
                throw new InvalidArgumentException('Assignment fixtures require the owner and template tenant to agree.');
            }
        });
    }

    /**
     * Define the fixture's persisted attributes.
     *
     * @return array<model-property<TemplateAssignment>, mixed>
     */
    public function definition(): array
    {
        return [
            'template_id' => Template::factory(),
            'template_version_id' => null,
            'owner_type' => null,
            'owner_id' => null,
            'profile' => 'default',
            'revision' => 1,
        ];
    }

    /**
     * Associate an admitted persisted Template parent.
     *
     * @api
     */
    public function forTemplate(Template $parent): static
    {
        FactoryGuard::parent($parent, new TemplateAssignment);

        return $this->state([
            'template_id' => $parent->getKey(),
        ]);
    }

    /**
     * Associate an admitted persisted TemplateVersion parent.
     *
     * @api
     */
    public function forVersion(TemplateVersion $parent): static
    {
        FactoryGuard::parent($parent, new TemplateAssignment);

        return $this->state([
            'template_version_id' => $parent->getKey(),
            'template_id' => $parent->template_id,
        ]);
    }

    /**
     * Associate a persisted host owner using its native morph identity.
     *
     * @api
     */
    public function forOwner(Model $owner): static
    {
        FactoryGuard::parent($owner, new TemplateAssignment);

        $alias = $owner->getMorphClass();
        if (TemplatesOwnership::declared()) {
            $resources = config('nvl-templates.ownership.owner_resources', []);
            if (! is_array($resources)) {
                throw new InvalidArgumentException('Invalid native Template host map.');
            }
            $alias = array_search(TemplatesOwnership::resource($owner), $resources, true);
            if (! is_string($alias)) {
                throw new InvalidArgumentException('Factory owner has no Template assignment alias.');
            }
        }

        return $this->state([
            'owner_type' => $alias,
            'owner_id' => (string) FactoryGuard::identifier($owner->getKey()),
        ]);
    }
}
