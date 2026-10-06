# Upgrading NVL Templates

## Tenant adoption

Map each template/render root explicitly and derive versions and assignments
from their canonical template. Import platform templates through the catalog
copy Action so Content/Media copies, provenance, and rollback remain bounded.

## To 1.0

There is no supported pre-1.0 public API. Install the clean schema, register
source-controlled render definitions and Content block definitions, import
structural rows through package Actions, and publish versions explicitly.

Before an adoption cutover:

1. Disable `templates.migrations.enabled`.
2. Map existing keys, locales, revisions, assignments, strings, structured
   values, and binary assets.
3. Run `php artisan nvl:templates:doctor --strict --format=json`.
4. Import binaries through Media; model strings, structured values, and Media
   UUIDs as Content fields.
5. Place blocks on the `TemplateVersion` model’s reserved `document` Content
   group and publish immutable snapshots.
6. Compare row counts, snapshot hashes, and representative rendered output.
7. Enable package migrations only after table compatibility is proven.

Never persist executable PHP or arbitrary Blade source from an old system.
Do not recreate legacy version-translation or template-asset tables.
When adopting PDF templates, move executable views into application source,
map print options into source-controlled `renderer_options`, configure a
dedicated writable mPDF temp path, and explicitly allowlist every remote image
host. Do not import untrusted HTML as an executable template.

Direct rendering now uses `Nvl\Templates\Template` with `TemplateOptions` and
`RenderTemplateAction`. Database-backed rendering uses
`RenderStoredTemplateAction`, which resolves the stored publication and
delegates to the direct Action. Custom renderers receive
`TemplateRenderContext`, not the removed `TemplateRenderContextData`.

PDF header and footer overrides are trusted view names plus bounded data. Raw
`header_html` and `footer_html` are reserved for trusted, source-defined direct
or class templates and pass through the package HTML guard. Stored definitions
should use trusted header/footer views.
Synchronous render routes return the actual output body and MIME type. Clients
that previously expected JSON must consume the binary response or use the
queued-render API.

Durable render rows now include `profile`, encrypted `settings`,
`dispatch_generation`, `processing_token`, `lease_expires_at`, and `failed_at`.
Because there is no supported pre-1.0 schema, these fields and their recovery
indexes are consolidated into the clean render-table migration. Configure
`lease_seconds` above the job timeout, `unique_for` at least as long as the
lease, `pending_recovery_seconds` above `unique_for`, and the queue connection’s
`retry_after` above the timeout. Schedule `nvl:templates:renders:recover` to
redispatch stale pending records and expired processing leases.

Source definitions and PDF defaults now reject unknown keys. Payload-related
values must be JSON-only objects, and the built-in validator accepts only the
bounded schema keywords documented in the README. Replace unsupported schema
keywords or bind a custom `TemplatePayloadValidator`.

The opt-in render route group now includes authorized render history/status
endpoints. Its middleware list may not be empty. Non-system users can access
only records matching their requester identity, and all render responses send
private no-store cache directives.

Source-controlled class templates may migrate incrementally to
`Nvl\Templates\Templates\BaseTemplate` or
`Nvl\Templates\Templates\BasePdfTemplate`. The reusable fluent methods remain,
but constructors now receive rendering and asset contracts through the
container. Replace custom string/asset persistence with Content compositions
and Media identifiers. Bind `TemplateAssetResolver` only when frame, sticker,
or scoped asset handles are required. Keep application-specific template
subclasses and authorization in the consuming application.

## Shared owner registry compatibility

Move model identity declarations to `nvl-core.owners` and reference the alias from `templates` capability configuration as described in the [README](README.md#shared-owner-identity). Preserve package contracts, resolvers/handlers, visibility scopes, and mutation authorization. Core does not grant package capabilities. Conflicting aliases or multiple canonical aliases for one model fail before use.

Legacy class inputs remain accepted for one major cycle and are reported through Core diagnostics. Existing Content, Taxonomy, and Metafields mappings keep their established aliases. Legacy SEO, Media, Comments, Templates, Pages, and Translatable class-backed behavior does not automatically create a new morph alias. Existing host morph mappings are respected.

Adding a canonical Core alias changes Laravel's write-time morph type for that model. Before adding it to an existing class-backed deployment, explicitly convert the known package-owned morph columns and reconcile every other affected host relationship. Keep unrelated rows and host-owned morph tables unchanged. This release performs no automatic owner-data conversion and does not ship `nvl:owners:upgrade`. Preserve existing aliases when no conversion is required, rebuild configuration caches, and restart workers after the cutover.

## Shared Doctor integration

The loaded package provider now contributes its existing inspection checks to Core's `nvl:doctor --strict --format=json`. The package command remains available. The shared gate fails errors and, in strict mode, warnings; no data upgrade is required for diagnostics.


## Infrastructure option inheritance

Move `rendering.connection` and `rendering.queue` to `queue.connection` and `queue.name`, or set canonical values to null to inherit Core/Laravel. Keep rendering retry, backoff, timeout, and lease settings. Configure `locks.store` for unique dispatch and overlap locks when a dedicated cache store is needed. Route middleware and `authorization.guard` may inherit Core; authorization remains host-owned. Compatibility inputs remain supported for one major cycle. Rebuild caches and restart workers after the cutover.

## Next major: isolated schema identities

This is a breaking schema identity change. Back up storage and migration history, pause writes/workers, install this code with automatic package migrations disabled, and select one owner for migrations (vendor or published).

```sh
php artisan nvl:doctor --strict --format=json
php artisan nvl:schema:upgrade --package=templates --claim-legacy --dry-run --format=json
php artisan nvl:schema:upgrade --package=templates --claim-legacy --format=json
```

The command validates released columns and relational keys plus creating migration history, renames owned legacy tables to the effective `tables.*` targets and rewrites exact package migration identities while retaining batches and unrelated host records. It refuses foreign/incomplete shapes and conflicting targets. Explicit old table mappings retain those names; remove them when choosing new defaults. A second run is empty.

Unmodified published files, including changed timestamps, map by verified checksum to the exact vendor migration identity and current package migration implementation. Modified host copies remain host-owned. Disable vendor loading when retaining a published owner; duplicate ownership fails before migration. No migration files or stored morph types are rewritten.

DDL transactions are driver dependent and per connection. Inspect dry-run warnings for MySQL/MariaDB or split storage; after a failure, inspect completed steps before resuming. Schema-qualified rename targets require an explicit host schema move first. Re-enable your selected migration owner, migrate remaining package changes and rerun Doctor before resuming writes. See the suite upgrade guide for shared owner/locale inputs, Core option defaults and one-major deprecation rules.
