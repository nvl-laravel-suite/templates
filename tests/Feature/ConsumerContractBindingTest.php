<?php

declare(strict_types=1);

use Illuminate\Config\Repository;
use Illuminate\Container\Container;
use Illuminate\Filesystem\FilesystemServiceProvider;
use Illuminate\Foundation\Application;
use Nvl\Templates\Actions\AssignTemplateAction;
use Nvl\Templates\Actions\CreateTemplateAction;
use Nvl\Templates\Actions\CreateTemplateVersionAction;
use Nvl\Templates\Actions\GetTemplateAction;
use Nvl\Templates\Actions\GetTemplateRenderAction;
use Nvl\Templates\Actions\GrantTemplateToTenantAction;
use Nvl\Templates\Actions\ImportPlatformTemplateAction;
use Nvl\Templates\Actions\ListTemplateRendersAction;
use Nvl\Templates\Actions\ListTemplatesAction;
use Nvl\Templates\Actions\PublishTemplateVersionAction;
use Nvl\Templates\Actions\QueueTemplateRenderAction;
use Nvl\Templates\Actions\RenderStoredTemplateAction;
use Nvl\Templates\Actions\RenderTemplateAction;
use Nvl\Templates\Actions\RevokeTemplateTenantGrantAction;
use Nvl\Templates\Actions\SyncTemplateDefinitionsAction;
use Nvl\Templates\Actions\UnassignTemplateAction;
use Nvl\Templates\Actions\UpdateTemplateAction;
use Nvl\Templates\Actions\UpdateTemplateVersionAction;
use Nvl\Templates\Contracts\AssignTemplateContract;
use Nvl\Templates\Contracts\CreateTemplateContract;
use Nvl\Templates\Contracts\CreateTemplateVersionContract;
use Nvl\Templates\Contracts\GetTemplateContract;
use Nvl\Templates\Contracts\GetTemplateRenderContract;
use Nvl\Templates\Contracts\GrantTemplateToTenantContract;
use Nvl\Templates\Contracts\ImportPlatformTemplateContract;
use Nvl\Templates\Contracts\ListTemplateRendersContract;
use Nvl\Templates\Contracts\ListTemplatesContract;
use Nvl\Templates\Contracts\PublishTemplateVersionContract;
use Nvl\Templates\Contracts\QueueTemplateRenderContract;
use Nvl\Templates\Contracts\RenderStoredTemplateContract;
use Nvl\Templates\Contracts\RenderTemplateContract;
use Nvl\Templates\Contracts\RevokeTemplateTenantGrantContract;
use Nvl\Templates\Contracts\SyncTemplateDefinitionsContract;
use Nvl\Templates\Contracts\UnassignTemplateContract;
use Nvl\Templates\Contracts\UpdateTemplateContract;
use Nvl\Templates\Contracts\UpdateTemplateVersionContract;
use Nvl\Templates\Providers\TemplatesServiceProvider;
use Nvl\Templates\Tests\TestCase;

if (! in_array(dirname(__DIR__).'/Pest.php', get_included_files(), true)) {
    uses(TestCase::class);
}

/** @return list<array{class-string, class-string}> */
function nvlConsumerBindingsForTemplates(): array
{
    return [
        [AssignTemplateContract::class, AssignTemplateAction::class],
        [CreateTemplateContract::class, CreateTemplateAction::class],
        [CreateTemplateVersionContract::class, CreateTemplateVersionAction::class],
        [GetTemplateContract::class, GetTemplateAction::class],
        [GetTemplateRenderContract::class, GetTemplateRenderAction::class],
        [GrantTemplateToTenantContract::class, GrantTemplateToTenantAction::class],
        [ImportPlatformTemplateContract::class, ImportPlatformTemplateAction::class],
        [ListTemplateRendersContract::class, ListTemplateRendersAction::class],
        [ListTemplatesContract::class, ListTemplatesAction::class],
        [PublishTemplateVersionContract::class, PublishTemplateVersionAction::class],
        [QueueTemplateRenderContract::class, QueueTemplateRenderAction::class],
        [RenderStoredTemplateContract::class, RenderStoredTemplateAction::class],
        [RenderTemplateContract::class, RenderTemplateAction::class],
        [RevokeTemplateTenantGrantContract::class, RevokeTemplateTenantGrantAction::class],
        [SyncTemplateDefinitionsContract::class, SyncTemplateDefinitionsAction::class],
        [UnassignTemplateContract::class, UnassignTemplateAction::class],
        [UpdateTemplateContract::class, UpdateTemplateAction::class],
        [UpdateTemplateVersionContract::class, UpdateTemplateVersionAction::class],
    ];
}

test('published workflow contracts retain native signatures attributes and generic documentation', function (): void {
    $genericDocumentation = static function (string|false $documentation): array {
        if ($documentation === false) {
            return [];
        }
        preg_match_all('/@param\s+([^\r\n]+?)\s+(\$[A-Za-z_][A-Za-z0-9_]*)\b/', $documentation, $parameters, PREG_SET_ORDER);
        $result = [];
        foreach ($parameters as $parameter) {
            $type = preg_replace('/\s+/', '', $parameter[1]);
            if (str_contains($type, '<') || str_contains($type, '{') || str_contains($type, '[]')) {
                $result['@param'.$parameter[2]] = $type;
            }
        }
        if (preg_match('/@return\s+([^\r\n]+)/', $documentation, $return) === 1) {
            $type = '';
            $depth = 0;
            foreach (str_split($return[1]) as $character) {
                if (preg_match('/\s/', $character) === 1 && $depth === 0) {
                    break;
                }
                if (str_contains('<{([', $character)) {
                    $depth++;
                } elseif (str_contains('>})]', $character)) {
                    $depth--;
                }
                if (preg_match('/\s/', $character) !== 1) {
                    $type .= $character;
                }
            }
            if (str_contains($type, '<') || str_contains($type, '{') || str_contains($type, '[]')) {
                $result['@return'] = $type;
            }
        }

        return $result;
    };

    foreach (nvlConsumerBindingsForTemplates() as [$contract, $implementation]) {
        $interface = new ReflectionClass($contract);
        $concrete = new ReflectionClass($implementation);
        expect($interface->isInterface())->toBeTrue()
            ->and($concrete->implementsInterface($contract))->toBeTrue();
        foreach ($interface->getMethods() as $method) {
            $native = $concrete->getMethod($method->getName());
            $return = (string) $method->getReturnType();

            $publishedTypes = $genericDocumentation($method->getDocComment());
            foreach ($genericDocumentation($native->getDocComment()) as $tag => $type) {
                expect($publishedTypes[$tag] ?? null)->toBe($type);
            }

            expect($native->isPublic())->toBeTrue()
                ->and($native->isStatic())->toBeFalse()
                ->and(count($method->getParameters()))->toBe(count($native->getParameters()));
            if ($return !== 'self') {
                expect((string) $native->getReturnType())->toBe($return);
            } else {
                $nativeReturn = (string) $native->getReturnType();
                expect(is_a(in_array($nativeReturn, ['self', 'static'], true) ? $native->getDeclaringClass()->getName() : $nativeReturn, $contract, true))->toBeTrue();
            }
            foreach ($method->getParameters() as $position => $parameter) {
                $actual = $native->getParameters()[$position];
                expect($actual->getName())->toBe($parameter->getName())
                    ->and((string) $actual->getType())->toBe((string) $parameter->getType())
                    ->and($actual->isVariadic())->toBe($parameter->isVariadic())
                    ->and($actual->isPassedByReference())->toBe($parameter->isPassedByReference())
                    ->and($actual->isDefaultValueAvailable())->toBe($parameter->isDefaultValueAvailable())
                    ->and(array_map(static fn (ReflectionAttribute $attribute): array => [$attribute->getName(), $attribute->getArguments()], $actual->getAttributes()))
                    ->toBe(array_map(static fn (ReflectionAttribute $attribute): array => [$attribute->getName(), $attribute->getArguments()], $parameter->getAttributes()));
                if ($parameter->isDefaultValueAvailable()) {
                    expect($actual->getDefaultValue())->toEqual($parameter->getDefaultValue());
                }
            }
        }
    }
});

test('native provider defaults resolve each workflow while preserving late host substitutes', function (): void {
    foreach (nvlConsumerBindingsForTemplates() as [$contract, $implementation]) {
        expect($this->app->bound($contract))->toBeTrue()
            ->and($this->app->make($contract))->toBeInstanceOf($implementation);
        $host = Mockery::mock($contract);
        $this->app->instance($contract, $host);
        expect($this->app->make($contract))->toBe($host);
    }
});

test('provider registration preserves early interface bindings in a second native application', function (): void {
    $consumer = new Application($this->app->basePath());
    $consumer->instance('config', new Repository($this->app->make('config')->all()));
    $consumer->instance('env', 'testing');
    $consumer->register(FilesystemServiceProvider::class);
    $hosts = [];
    foreach (nvlConsumerBindingsForTemplates() as [$contract]) {
        $hosts[$contract] = Mockery::mock($contract);
        $consumer->instance($contract, $hosts[$contract]);
    }
    try {
        $consumer->register(TemplatesServiceProvider::class);
        foreach ($hosts as $contract => $host) {
            expect($consumer->make($contract))->toBe($host);
        }
    } finally {
        Container::setInstance($this->app);
        $consumer->flush();
    }
});
