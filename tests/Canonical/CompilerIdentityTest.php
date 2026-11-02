<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class CompilerIdentityTest extends TestCase
{
    use RefreshDatabase;

    public static function invalidIdentity(): array
    {
        return [['compilerVersion', 'unknown/99'], ['rendering', ['engine' => 'shared']]];
    }

    #[DataProvider('invalidIdentity')]
    public function test_rejects_unsupported_or_inconsistent_compiler_identity_at_publication(string $key, mixed $value): void
    {
        $api = app(Templates::class);
        $t = $api->createTemplate('identity', 'Identity');
        $doc = Documents::standalone();
        $doc[$key] = $value;
        $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, 1);
    }
}
