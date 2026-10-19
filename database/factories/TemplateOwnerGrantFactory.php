<?php

declare(strict_types=1);

namespace Nvl\Templates\Database\Factories;

use Illuminate\Container\Container;
use Illuminate\Database\Eloquent\Factories\Factory;
use InvalidArgumentException;
use Nvl\Templates\Contracts\TemplateCatalogAccess;
use Nvl\Templates\Models\TemplateOwnerGrant;
use Nvl\Templates\Models\TemplateVersion;
use Nvl\Templates\Ownership\TemplateCatalogSource;

/**
 * Builds explicit recipient capability fixtures through the current catalog policy.
 *
 * @extends Factory<TemplateOwnerGrant>
 *
 * @api
 */
final class TemplateOwnerGrantFactory extends Factory
{
    protected $model = TemplateOwnerGrant::class;

    /** Define only fields that require a deliberately selected source publication.
     * @return array<model-property<TemplateOwnerGrant>,mixed>
     */
    public function definition(): array
    {
        return ['template_version_id' => null, 'source_revision' => null, 'revision' => 1, 'revoked_at' => null];
    }

    /** Validate the current recipient and source before native fixture persistence. */
    public function configure(): static
    {
        return $this->afterMaking(static function (TemplateOwnerGrant $grant): void {
            $id = $grant->getAttribute('template_version_id');
            $revision = $grant->getAttribute('source_revision');
            if (! is_string($id) || ! is_int($revision)) {
                throw new InvalidArgumentException('Native grant fixtures require an explicit source version.');
            }
            $container = Container::getInstance();
            $container->make(TemplateCatalogAccess::class)->assertCanGrant($id, $revision);
            $source = $container->make(TemplateCatalogSource::class)->version($id);
            if ($source->revision !== $revision) {
                throw new InvalidArgumentException('Native grant fixture source revision changed.');
            }
        });
    }

    /** Select one persisted immutable central source; the recipient comes from current admission. */
    public function forVersion(TemplateVersion $source): static
    {
        if (! $source->exists || $source->isDirty(['id', 'revision'])) {
            throw new InvalidArgumentException('Grant fixture sources require unchanged persisted identities.');
        }

        return $this->state(['template_version_id' => $source->id, 'source_revision' => $source->revision]);
    }
}
