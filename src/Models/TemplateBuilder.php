<?php

declare(strict_types=1);

namespace Nvl\Templates\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Keeps malformed document identities a portable not-found result.
 *
 * @template TModel of TemplateModel
 *
 * @extends Builder<TModel>
 *
 * @internal
 */
final class TemplateBuilder extends Builder
{
    /** PostgreSQL rejects a malformed uuid operand (SQLSTATE 22P02) instead of matching no record. */
    public function whereKey($id)
    {
        if (is_string($id) && ! Str::isUuid($id)) {
            $this->whereRaw('1 = 0');

            return $this;
        }

        return parent::whereKey($id);
    }
}
