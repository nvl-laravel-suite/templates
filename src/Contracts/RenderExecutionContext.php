<?php

declare(strict_types=1);

namespace Nvl\Templates\Contracts;

use Closure;

/**
 * Native or host-adapted scalar worker admission.
 *
 * @api
 */
interface RenderExecutionContext
{
    /** Capture trusted scalar actor/tenant references, never credentials or customer data.
     * @return array<array-key,mixed>
     */
    public function capture(): array;

    /** Restore one admitted operation and restore previous worker state afterward.
     * @template T
     *
     * @param  array<array-key,mixed>  $context
     * @param  Closure(): T  $operation
     * @return T
     */
    public function run(array $context, Closure $operation): mixed;
}
