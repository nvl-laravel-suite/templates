<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Nvl\Templates\Enums\TemplateRenderStatus;
use Nvl\Templates\Models\TemplateRender;
use Throwable;

/**
 * Applies terminal failure only under the current source authority and durable lease.
 *
 * @internal
 */
final readonly class TemplateRenderFailure
{
    /** Apply terminal failure only while the current scope retains the durable lease. */
    public function fail(string $id, int $generation, string $token, ?Throwable $error): void
    {
        (new TemplateRender)->getConnection()->transaction(function () use ($id, $generation, $token, $error): void {
            $render = TemplateRender::query()->whereKey($id)->lockForUpdate()->first();
            if ($render === null || $render->dispatch_generation !== $generation || $render->status === TemplateRenderStatus::Completed || ($render->status === TemplateRenderStatus::Processing && $render->processing_token !== $token)) {
                return;
            }
            $render->fill(['status' => TemplateRenderStatus::Failed, 'processing_token' => null, 'lease_expires_at' => null, 'failure' => mb_substr($error?->getMessage() ?? 'Template render job failed.', 0, 4000), 'failed_at' => now()])->save();
        });
    }
}
