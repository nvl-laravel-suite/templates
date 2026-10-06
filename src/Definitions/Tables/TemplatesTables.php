<?php

declare(strict_types=1);

namespace Nvl\Templates\Definitions\Tables;

use Nvl\Support\Config\PackageStorage;

/**
 * Defines the configurable persistence table keys owned by Templates.
 */
final class TemplatesTables
{
    public const string Templates = 'nvl_templates_templates';

    public const string I18n = 'nvl_templates_i18n';

    public const string Versions = 'nvl_templates_versions';

    public const string Assignments = 'nvl_templates_assignments';

    public const string Renders = 'nvl_templates_renders';

    public const string TenantGrants = 'nvl_templates_tenant_grants';

    public const string TenantGrantLocks = 'nvl_templates_tenant_grant_locks';

    public const string TEMPLATES = self::Templates;

    public const string TEMPLATES_I18N = self::I18n;

    public const string TEMPLATE_VERSIONS = self::Versions;

    public const string TEMPLATE_ASSIGNMENTS = self::Assignments;

    public const string TEMPLATE_RENDERS = self::Renders;

    /**
     * Return a configured package table name.
     */
    public static function get(string $key): string
    {
        return PackageStorage::resolveTable('templates', $key);
    }

    private function __construct() {}
}
