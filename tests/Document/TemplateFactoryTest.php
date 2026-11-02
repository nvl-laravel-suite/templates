<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document;

use Illuminate\Database\Eloquent\Relations\Relation;
use Nvl\Templates\Database\Factories\TemplateFactory;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Tests\CanonicalTestCase;

final class TemplateFactoryTest extends CanonicalTestCase
{
    private array $originalMorphMap = [];

    protected function setUp(): void
    {
        $this->originalMorphMap = Relation::morphMap();
        parent::setUp();
    }

    protected function tearDown(): void
    {
        try {
            parent::tearDown();
        } finally {
            Relation::morphMap($this->originalMorphMap, false);
        }
    }

    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $app['config']->set('nvl-templates.models.template', FixtureTemplate::class);
    }

    public function test_factory_uses_the_configured_native_document_root_and_valid_schema_fields(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $template = TemplateFactory::new()->create();
        self::assertInstanceOf(FixtureTemplate::class, $template);
        self::assertNotSame('', $template->name);
        self::assertSame(0, $template->version);
        self::assertNull($template->current_revision_id);
        self::assertArrayNotHasKey('renderer', $template->getAttributes());
        self::assertSame($template->id, Template::query()->firstOrFail()->id);
        self::assertInstanceOf(FixtureTemplate::class, Template::factory()->make());
    }
}

final class FixtureTemplate extends Template {}
