<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\GenericUser;
use Nvl\Support\Auth\CanonicalActorResolver;
use Nvl\Support\Enums\SystemActor;
use Nvl\Support\Ownership\Contracts\OwnershipContext;
use Nvl\Support\Ownership\Enums\OwnershipContextMode;
use Nvl\Support\Ownership\ValueObjects\OwnershipSnapshot;
use Nvl\Templates\Services\TemplateOperation;
use PHPUnit\Framework\TestCase;

final class TemplateOperationTest extends TestCase
{
    public function test_nested_actor_state_restores_after_failure_and_success(): void
    {
        $ownership = $this->createMock(OwnershipContext::class);
        $ownership->method('snapshot')->willReturn(new OwnershipSnapshot(OwnershipContextMode::Disabled));
        $operation = new TemplateOperation(new CanonicalActorResolver, $ownership);
        $actor = new GenericUser(['id' => 7]);
        $operation->run($actor, function () use ($operation, $actor): void {
            self::assertSame($actor, $operation->actor());
            try {
                $operation->run(SystemActor::Background, function () use ($operation): void {
                    self::assertSame(SystemActor::Background, $operation->actor());
                    throw new \RuntimeException('failure');
                });
            } catch (\RuntimeException) {
            }
            self::assertSame($actor, $operation->actor());
        });
        $this->expectException(AuthorizationException::class);
        $operation->actor();
    }

    public function test_explicit_actor_cannot_borrow_another_ownership_principal(): void
    {
        $ownership = $this->createMock(OwnershipContext::class);
        $ownership->method('snapshot')->willReturn(new OwnershipSnapshot(OwnershipContextMode::Central, principal: ['kind' => 'actor', 'type' => GenericUser::class, 'id' => '7'], operation: 'maintenance'));
        $operation = new TemplateOperation(new CanonicalActorResolver, $ownership);
        $this->expectException(AuthorizationException::class);
        $operation->run(new GenericUser(['id' => 8]), static fn () => null);
    }
}
