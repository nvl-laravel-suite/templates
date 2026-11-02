<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

use Nvl\Templates\Contracts\DocumentCompiler;
use Nvl\Templates\Drivers\Compiler\LocalNodeCompiler;

final class Compiler
{
    public static function configured(): ?DocumentCompiler
    {
        $id = config('nvl-templates.compiler.driver');
        if (! is_string($id) || $id === '') {
            return null;
        }
        try {
            $driver = app($id);
        } catch (\Throwable) {
            return null;
        }
        if (! $driver instanceof DocumentCompiler) {
            return null;
        }
        if ($driver instanceof LocalNodeCompiler && (! is_array(config('nvl-templates.compiler.command')) || config('nvl-templates.compiler.command') === [])) {
            return null;
        }

        return $driver;
    }
}
