<?php

declare(strict_types=1);

use Illuminate\Database\Eloquent\Relations\Relation;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Services\TemplateOwnerRegistry;
use Nvl\Templates\Tests\Fixtures\TestTemplateOwner;
use Nvl\Templates\Tests\Fixtures\TestTemplateOwnerResolver;

beforeEach(function (): void {
    $this->originalOwnerMorphMap = Relation::morphMap();
});

afterEach(function (): void {
    Relation::morphMap($this->originalOwnerMorphMap, false);
});

it('retains template resolvers when their owner identity references core', function (): void {
    config()->set('nvl-core.owners', ['person' => TestTemplateOwner::class, 'private-person' => Template::class]);
    $owner = TestTemplateOwner::create(['name' => 'Member']);
    $registry = app()->build(TemplateOwnerRegistry::class);
    $registry->register('member', TestTemplateOwnerResolver::class, 'person');

    expect($registry->resolve('member', $owner->getKey())->is($owner))->toBeTrue()
        ->and($registry->has('private-person'))->toBeFalse();
});
