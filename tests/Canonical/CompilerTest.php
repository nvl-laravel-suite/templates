<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\DocumentCompiler;
use Nvl\Templates\Drivers\Compiler\LocalNodeCompiler;
use Nvl\Templates\Exceptions\RetryableRenderException;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;
use PHPUnit\Framework\Attributes\DataProvider;

final class CompilerTest extends TestCase
{
    use RefreshDatabase;

    public function test_structural_templates_require_the_configured_compiler_without_a_binding_fallback(): void
    {
        $api = app(Templates::class);
        $t = $api->createTemplate('dynamic', 'Dynamic');
        $doc = Documents::standalone();
        $doc['artifacts']['engine'] = 'shared';
        $d = $api->saveDraft($t->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($t->id, $d->version);
    }

    public function test_shared_engine_receives_authorized_complete_values_and_its_output_is_used(): void
    {
        self::assertTrue(interface_exists(DocumentCompiler::class));
        $driver = new class implements DocumentCompiler
        {
            public function compile(array $document, array $data, array $assets = []): array
            {
                return ['html' => '<p>Shared '.$data['facts']['code'].'</p>', 'css' => 'p{color:red}'];
            }
        };
        app()->instance('test.compiler', $driver);
        config()->set('nvl-templates.compiler.driver', 'test.compiler');
        $api = app(Templates::class);
        $t = $api->createTemplate('dynamic', 'Dynamic');
        $doc = Documents::standalone();
        $doc['artifacts']['engine'] = 'shared';
        $d = $api->saveDraft($t->id, $doc, 0);
        $r = $api->publish($t->id, $d->version);
        $output = $api->render($r->id, facts: ['code' => 'ABC']);
        self::assertStringContainsString('Shared ABC</p>', $output->html);
        self::assertMatchesRegularExpression('/<p[^>]*style="[^"]*color:\s*red/', $output->html);
        self::assertSame('', $output->css);
    }

    public function test_a_compiler_timeout_is_retryable_without_exposing_process_output(): void
    {
        config()->set('nvl-templates.compiler.command', [PHP_BINARY, '-n', '-r', 'usleep(100000);']);
        config()->set('nvl-templates.compiler.timeout', 0.01);
        $this->expectException(RetryableRenderException::class);
        $this->expectExceptionMessage('compiler_timeout');
        app(LocalNodeCompiler::class)->compile(Documents::standalone(), ['facts' => ['code' => 'ABC']]);
    }

    public static function unboundedTimeouts(): array
    {
        return [
            'zero' => [0],
            'zero string' => ['0'],
            'negative' => [-1],
            'not numeric' => ['invalid'],
            'not a number' => [NAN],
            'infinity' => [INF],
        ];
    }

    #[DataProvider('unboundedTimeouts')]
    public function test_invalid_compiler_timeout_is_rejected_before_starting_a_process(mixed $timeout): void
    {
        $marker = tempnam(sys_get_temp_dir(), 'template-compiler-');
        unlink($marker);
        config()->set('nvl-templates.compiler.command', [PHP_BINARY, '-r', 'file_put_contents($argv[1], "started"); echo json_encode(["html" => "<p>Done</p>", "css" => ""]);', $marker]);
        config()->set('nvl-templates.compiler.timeout', $timeout);
        $caught = null;
        try {
            app(LocalNodeCompiler::class)->compile(Documents::standalone(), ['facts' => ['code' => 'ABC']]);
        } catch (\Throwable $error) {
            $caught = $error;
        } finally {
            $started = is_file($marker);
            if ($started) {
                unlink($marker);
            }
        }
        self::assertInstanceOf(ValidationException::class, $caught, 'Compiler configuration must preserve a finite positive execution timeout.');
        self::assertFalse($started, 'Invalid compiler configuration must be rejected before executing its command.');
    }

    public function test_a_positive_numeric_string_keeps_the_configured_compiler_usable(): void
    {
        config()->set('nvl-templates.compiler.command', [PHP_BINARY, '-n', '-r', 'echo json_encode(["html" => "<p>Done</p>", "css" => ""]);']);
        config()->set('nvl-templates.compiler.timeout', '1.5');
        self::assertSame(['html' => '<p>Done</p>', 'css' => ''], app(LocalNodeCompiler::class)->compile(Documents::standalone(), ['facts' => ['code' => 'ABC']]));
    }

    public function test_shared_engine_rejects_control_characters_in_compiled_subject(): void
    {
        $driver = new class implements DocumentCompiler
        {
            public function compile(array $document, array $data, array $assets = []): array
            {
                return ['html' => '<p>Shared</p>', 'css' => '', 'subject' => "Header\r\nBcc: attacker@example.test"];
            }
        };
        app()->instance('test.compiler', $driver);
        config()->set('nvl-templates.compiler.driver', 'test.compiler');
        $api = app(Templates::class);
        $t = $api->createTemplate('dynamic-subject', 'Dynamic Subject');
        $doc = Documents::standalone();
        $doc['artifacts']['engine'] = 'shared';
        $d = $api->saveDraft($t->id, $doc, 0);
        $r = $api->publish($t->id, $d->version);

        $this->expectException(ValidationException::class);
        $api->render($r->id, facts: ['code' => 'ABC']);
    }
}
