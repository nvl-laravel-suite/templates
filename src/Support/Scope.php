<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

use InvalidArgumentException;
use Nvl\Support\Config\PackageStorage;
use Nvl\Support\Ownership\Contracts\OwnershipContext;
use Nvl\Templates\Services\TemplateModelRegistry;

/**
 * Resolves trusted document partition and configured native storage.
 *
 * @internal
 */
final class Scope
{
    public static function current(): string
    {
        $class = app(TemplateModelRegistry::class)->templateClass();
        if ($class::ownershipDefinition()->strategy !== 'unscoped') {
            $owner = app(OwnershipContext::class)->requireOwner();

            return $owner->scopeKey();
        }
        $scope = config('nvl-templates.scope', 'app');
        if (! is_string($scope) || $scope === '' || strlen($scope) > 128) {
            throw new InvalidArgumentException('A trusted template application scope is required.');
        }

        return $scope;
    }

    public static function table(string $key): string
    {
        $table = config('nvl-templates.tables.'.$key);
        if (! is_string($table)) {
            throw new InvalidArgumentException('Invalid Templates table configuration: '.$key);
        }

        return PackageStorage::table('templates', $key, $table);
    }
}
