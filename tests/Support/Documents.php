<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Support;

final class Documents
{
    public static function standalone(string $headline = 'An experience for you'): array
    {
        return [
            'format' => 'template-document', 'schemaVersion' => 1, 'target' => 'email',
            'source' => ['mode' => 'standalone', 'definition' => [
                'format' => 'gct-template', 'schemaVersion' => 1, 'id' => 'experience', 'name' => 'Experience',
                'description' => '', 'locale' => 'en',
                'page' => ['widthMm' => 210, 'heightMm' => 99, 'margins' => ['top' => 8, 'right' => 8, 'bottom' => 8, 'left' => 8]],
                'roots' => ['heading'], 'nodes' => ['heading' => [
                    'id' => 'heading', 'name' => 'Heading', 'kind' => 'text',
                    'permissions' => ['content' => false, 'style' => false],
                    'parts' => [['value' => ['source' => 'literal', 'value' => $headline], 'format' => 'text', 'currency' => 'EUR']],
                ]],
                'fields' => [], 'blocks' => [], 'assets' => [], 'styles' => ['theme' => '', 'css' => ''],
            ]],
            'content' => ['headline' => $headline],
            'dataSchema' => ['type' => 'object', 'properties' => [
                'facts' => ['type' => 'object', 'properties' => ['code' => ['type' => 'string', 'minLength' => 1]], 'required' => ['code'], 'additionalProperties' => false],
                'inputs' => ['type' => 'object', 'properties' => ['message' => ['type' => 'string', 'maxLength' => 200]], 'additionalProperties' => false],
                'settings' => ['type' => 'object', 'properties' => ['fontSize' => ['type' => 'number', 'minimum' => 12, 'maximum' => 24]], 'required' => ['fontSize'], 'additionalProperties' => false],
                'content' => ['type' => 'object', 'properties' => ['headline' => ['type' => 'string']], 'required' => ['headline'], 'additionalProperties' => false],
                'context' => ['type' => 'object', 'additionalProperties' => false],
            ], 'required' => ['facts', 'inputs', 'settings', 'content', 'context'], 'additionalProperties' => false],
            'settingsDefaults' => ['fontSize' => 16], 'inputDefaults' => ['message' => 'Enjoy!'],
            'exposedInputs' => ['message'], 'exposedSettings' => ['fontSize'], 'dependencies' => [],
            'artifacts' => [
                'engine' => 'bindings', 'html' => '<!doctype html><html><head></head><body><h1>{{headline}}</h1><p style="font-size:{{fontSize}}">{{message}}</p><b>{{code}}</b></body></html>',
                'css' => '', 'subject' => '{{headline}}', 'text' => '{{message}} — {{code}}',
                'bindings' => [
                    ['id' => 'headline', 'path' => 'content.headline', 'kind' => 'text'],
                    ['id' => 'message', 'path' => 'inputs.message', 'kind' => 'text'],
                    ['id' => 'code', 'path' => 'facts.code', 'kind' => 'text'],
                    ['id' => 'fontSize', 'path' => 'settings.fontSize', 'kind' => 'style', 'property' => 'font-size', 'unit' => 'px'],
                ],
            ],
        ];
    }

    public static function variant(string $groupId, int $revision, string $headline): array
    {
        return ['format' => 'template-document', 'schemaVersion' => 1, 'target' => 'email', 'source' => [
            'mode' => 'group-variant', 'group' => ['id' => $groupId, 'revision' => $revision],
            'overrides' => ['content' => ['headline' => $headline]],
        ]];
    }
}
