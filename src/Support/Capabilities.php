<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

/**
 * Read-only supported document, engine, media and preview capabilities.
 *
 * @api
 */
final class Capabilities
{
    /** @return array<string,mixed> */
    public static function document(): array
    {
        return ['schemaVersion' => 1, 'compilerVersions' => ['template-platform/1'], 'sourceModes' => ['standalone', 'group-variant'], 'targets' => ['email', 'document'], 'emailProfiles' => ['email-safe/1'],
            'engines' => ['bindings' => true, 'shared' => Compiler::configured() !== null], 'pdf' => Pdf::configured() !== null,
            'renderRequests' => ['html' => true, 'queued' => config('nvl-templates.rendering.queue.enabled') === true, 'retention' => true],
            'preview' => ['browserHtml' => true, 'includeInlineAssets' => true, 'maxBytes' => config('nvl-templates.limits.preview_bytes', 8388608)],
            'assetTypes' => ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
            'assetTypesByTarget' => self::assetTypesByTarget(),
            'familyOperations' => ['upgrade', 'rebase', 'detach', 'regroup'], 'structuralVariations' => true, 'variantOverrides' => ['content', 'settingsDefaults', 'exposedInputs', 'exposedSettings', 'variations']];
    }

    /** @return array{email:list<string>,document:list<string>} */
    public static function assetTypesByTarget(): array
    {
        return [
            'email' => ['image/png', 'image/jpeg', 'image/gif'],
            'document' => ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        ];
    }
}
