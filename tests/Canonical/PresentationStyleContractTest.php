<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Rendering\PresentationStyle;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class PresentationStyleContractTest extends TestCase
{
    #[DataProvider('presentationStyles')]
    public function test_php_matches_the_shared_presentation_style_contract(array $case): void
    {
        if ($case['invalid'] ?? false) {
            $this->expectException(ValidationException::class);
        }
        $output = PresentationStyle::format($case['property'], $case['value'], $case['unit'] ?? '');
        if (! ($case['invalid'] ?? false)) {
            self::assertSame($case['output'], $output);
        }
    }

    public static function presentationStyles(): iterable
    {
        $cases = json_decode(file_get_contents(__DIR__.'/../Support/Contracts/presentation-styles.v1.json'), true, 64, JSON_THROW_ON_ERROR);
        foreach ($cases as $index => $case) {
            yield $index.' '.$case['property'] => [$case];
        }
    }
}
