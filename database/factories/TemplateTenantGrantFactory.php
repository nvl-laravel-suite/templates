<?php

declare(strict_types=1);

namespace Nvl\Templates\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use InvalidArgumentException;
use Nvl\Support\Tenancy\ValueObjects\TenantId;
use Nvl\Templates\Models\TemplateTenantGrant;
use Nvl\Templates\Models\TemplateVersion;

/**
 * Builds TemplateTenantGrant fixture rows and their declared package parents.
 *
 * @extends Factory<TemplateTenantGrant>
 *
 * @api
 */
final class TemplateTenantGrantFactory extends Factory
{
    protected $model = TemplateTenantGrant::class;

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
        })->afterMaking(function (TemplateTenantGrant $model) use (&$expandRelationships): void {
            if (! $expandRelationships) {
                return;
            }

            if ($model->getAttribute('template_version_id') === null) {
                throw new InvalidArgumentException('Template grant fixtures require forVersion() with a real published source snapshot.');
            }
            $parent = TemplateVersion::query()->findOrFail(FactoryGuard::identifier($model->getAttribute('template_version_id')));
            FactoryGuard::parent($parent, $model);
            if ($model->source_revision !== $parent->revision) {
                throw new InvalidArgumentException('Fixture source revisions must match their exact persisted parent.');
            }
            if ($parent->status->value !== 'published' || $parent->content_snapshot === null || $parent->content_snapshot->blocks === []
                || $parent->content_hash !== $parent->content_snapshot->version
                || $parent->template->tenant_id !== null || $parent->template->ownership_key !== 'platform') {
                throw new InvalidArgumentException('Template grant fixtures require a published platform source.');
            }
            $recipient = $model->getAttribute('recipient_tenant_id');
            if (! is_string($recipient)) {
                throw new InvalidArgumentException('Catalog fixtures require an explicit recipient tenant.');
            }
            FactoryGuard::recipient(new TenantId($recipient));
        });
    }

    /**
     * Define the fixture's persisted attributes.
     *
     * @return array<model-property<TemplateTenantGrant>, mixed>
     */
    public function definition(): array
    {
        return [
            'template_version_id' => null,
            'recipient_tenant_id' => null,
            'source_revision' => fn (array $attributes): int => $attributes['template_version_id'] === null ? 1 : TemplateVersion::query()->findOrFail(FactoryGuard::identifier($attributes['template_version_id']))->revision,
            'revision' => 1,
        ];
    }

    /**
     * Associate an admitted persisted TemplateVersion parent.
     *
     * @api
     */
    public function forVersion(TemplateVersion $parent): static
    {
        FactoryGuard::parent($parent, new TemplateTenantGrant);

        return $this->state([
            'template_version_id' => $parent->getKey(),
            'source_revision' => $parent->revision,
        ]);
    }

    /** Associate an active recipient in the explicit platform context.
     *
     * @api
     */
    public function forRecipient(TenantId $recipient): static
    {
        FactoryGuard::recipient($recipient);

        return $this->state(['recipient_tenant_id' => $recipient->value]);
    }
}
