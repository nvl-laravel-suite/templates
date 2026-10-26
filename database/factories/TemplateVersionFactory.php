<?php

declare(strict_types=1);

namespace Nvl\Templates\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use InvalidArgumentException;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Builds TemplateVersion fixture rows and their declared package parents.
 *
 * @extends Factory<TemplateVersion>
 *
 * @api
 */
final class TemplateVersionFactory extends Factory
{
    protected $model = TemplateVersion::class;

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
        })->afterMaking(function (TemplateVersion $model) use (&$expandRelationships): void {
            if (! $expandRelationships) {
                return;
            }

            if ($model->getAttribute('template_id') !== null) {
                $parent = TemplateModelRegistry::query()->findOrFail(FactoryGuard::identifier($model->getAttribute('template_id')));
                FactoryGuard::parent($parent, $model);
                FactoryGuard::inherit($model, $parent);
                if ($model->status->value === 'published') {
                    $snapshot = $model->content_snapshot;
                    if ($snapshot === null || $snapshot['blocks'] === [] || $snapshot['ownerId'] !== $model->id
                        || $model->content_hash !== $snapshot['version']) {
                        throw new InvalidArgumentException('Published fixtures require the exact version composition and tenant identity.');
                    }
                }
            }
        });
    }

    /**
     * Define the fixture's persisted attributes.
     *
     * @return array<model-property<TemplateVersion>, mixed>
     */
    public function definition(): array
    {
        return [
            'template_id' => Template::factory(),
            'version' => 1,
            'status' => 'draft',
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
        FactoryGuard::parent($parent, new TemplateVersion);

        return $this->state([
            'template_id' => $parent->getKey(),
        ]);
    }

    /** Declare an immutable publication fixture from a supplied native composition.
     *
     * @api
     *
     * @param  array{ownerType:string,ownerId:string,group:string,blocks:list<array{placementId:string,parentId:string|null,key:string,region:string,sortOrder:int,blockId:string,definitionKey:string,definitionSchema:array<string,mixed>,definitionView:string|null,visibility:string,values:array<string, mixed>,translations:array<string, array<string, mixed>>,overrides:array<string, mixed>,blockRevision:int,placementRevision:int}>,version:string,tenantId:string|null,formatVersion:int,ownershipContext:array<string,mixed>|null}  $snapshot
     */
    public function published(array $snapshot): static
    {
        if ($snapshot['blocks'] === [] || $snapshot['ownerType'] !== TemplateVersion::CONTENT_OWNER_TYPE
            || $snapshot['group'] !== TemplateVersion::CONTENT_GROUP) {
            throw new InvalidArgumentException('Published version fixtures require a nonempty native composition snapshot.');
        }

        return $this->state([
            'id' => $snapshot['ownerId'],
            'status' => 'published',
            'content_snapshot' => $snapshot,
            'content_hash' => $snapshot['version'],
            'published_at' => now(),
        ]);
    }
}
