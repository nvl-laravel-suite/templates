---
name: nvl-templates
description: Implement, integrate, test, or review nvl/templates in Laravel 13. Use for directly constructed Template values, typed renderer/PDF options, Blade views, Content compositions, stored template definitions and versions, assignments, queued renders, output responses, view publication, APIs, or package architecture.
---

# NVL Templates

Treat Templates as a composition and rendering package with two layers that
share one pipeline:

For tenant catalogs, copy through the package import Action; never share source
rows or write Content/Media tables directly. Keep render envelopes and all
temporary/output paths tenant-bound across queue retries and recovery.

1. `Template`, typed options, renderer contracts, Blade/PDF implementations,
   verified output, and response helpers.
2. The database implementation for definitions, localized metadata, versions,
   Content snapshots, assignments, and durable renders.

## Render directly

- Construct `Template` from a source-controlled view, bounded data, optional
  schema, optional Content composition, settings, and `TemplateOptions`.
- Use `RenderTemplateAction` for directly constructed templates.
- Use `TemplateResponseFactory` for protected inline/download responses.
- Extend `Template` for domain-specific typed constructors when useful.
- Keep ordinary Blade values escaped.
- Render rich text only through Content's sanitized DTO/component.

## Adopt class templates

- Extend `BaseTemplate` or `BasePdfTemplate` for source-controlled class
  templates that need the reusable fluent API.
- Resolve subclasses through Laravel's container; constructor dependencies are
  injected and no static application lookup is required.
- Use `ContentAccessor` and `AssetAccessor` in class-template Blade views.
- Supply persisted copy through `withComposition()` and keep binary ownership
  in Media.
- Prefer the opt-in Media resolver and registered revision-aware aliases for
  frame, sticker, or scoped asset handles; bind `TemplateAssetResolver` only
  for an application-specific ownership source.
- Use `Content::resolveScopes()` for bounded ordered class-template copy. Do
  not page the HTTP-style block catalog or query Content models directly.
- Keep local assets under configured roots; exact-allowlist every remote host.
- Keep mPDF's guarded asset fetcher enabled so nested SVG/CSS resources pass
  the same root/host checks, byte limits, timeouts, and no-redirect policy.
- Use the versioned `nvl:templates:adopt` manifest for legacy key/scope/locale
  and Media alias mapping. Plan first, prepare named staging indexes, migrate,
  apply, and require exact reconciliation before removing staging.
- Preserve unique staging enforcement by renaming named unique indexes during
  preparation; ordinary index names may be removed. Keep the exact reviewed
  Content read/preflight imports inside the adoption classes only.
- Treat raw header/footer HTML as trusted source only. Stored definitions use
  header/footer view names.
- Keep PDF image diagnostics disabled outside explicitly enabled debug
  environments.

## Configure rendering

- Use `TemplateOptions` for renderer, locale, subject, filename, custom driver
  options, and `PdfOptions`.
- Use `PdfMargins`, `PdfPageSize`, and `PdfOrientation` instead of untyped
  option strings in application code.
- Configure renderer aliases through `TemplateRendererRegistry`.
- Implement `TemplateRenderer` for additional formats.
- Return exact MIME, byte-size, checksum, and safe filename facts in
  `RenderedTemplateData`.
- Keep output and HTML byte limits enabled.

## Render PDFs safely

- Use `MpdfTemplateRenderer` through the `pdf` alias.
- Configure page, margins, fonts, DPI, image quality, metadata, header/footer
  views, watermark, compression, and PDF/A through typed options.
- Use trusted Blade views for headers and footers; never accept raw executable
  template source from a database or caller.
- Keep remote resources disabled or restrict them to HTTPS and exact hosts.
- Keep mPDF temporary files beneath configured allowed roots.
- Reject traversal, absolute local paths outside configured asset roots, unsafe
  schemes, credentialed URLs, oversized data images, and unsafe HTML elements.

## Use the database implementation

- Keep executable definitions and renderer options source-controlled.
- Synchronize definitions with `nvl:templates:sync`.
- Use `CreateTemplateAction` and `CreateTemplateVersionAction` for stored state.
- Compose version content through the `TemplateVersion` model’s reserved
  `document` Content group; it implements `ContentOwner` with `HasContent`.
- Consume the injected `Nvl\Content\Content` application surface for capture
  and snapshot rendering, and adapt authorization identity with
  `TemplateActorData::contentActor()`.
- Persist immutable content through `ContentCompositionSnapshotCast`; keep the
  model attribute typed as `ContentCompositionSnapshotData`.
- Publish with `PublishTemplateVersionAction` and the exact revision.
- Use `RenderStoredTemplateAction` for synchronous database-backed rendering.
  It resolves the publication and delegates to `RenderTemplateAction`.
- Use `AssignTemplateAction` and `UnassignTemplateAction` for owner/profile
  mappings.
- Use `QueueTemplateRenderAction` for durable idempotent work.
- Preflight queue requests before persistence and snapshot the resolved version,
  profile, payload, and assignment settings on the render record.
- Keep the database lease longer than the job timeout and the unique lock at
  least as long as the lease. Keep `pending_recovery_seconds` above the unique
  lock duration. Recover failed queue pushes and expired leases with
  `nvl:templates:renders:recover`.
- Let only the matching processing token complete or fail a claimed render.
- Use `GetTemplateRenderAction` and `ListTemplateRendersAction` for authorized
  history; never expose payload, settings, failure text, or processing tokens.
- Treat model arguments to stored rendering and history Actions as persisted
  identifiers; reload canonical state and relationships before authorization.
- Keep payload-related values JSON-only and use only the built-in bounded JSON
  Schema keywords unless the application binds a custom validator.
- Never write package, Content, or Media tables directly.
- Keep management and stored-render routes disabled until authorization and
  middleware are configured.

## Views

- Use or publish the bundled HTML/PDF document, header, footer, section, table,
  and page-break starting points.
- Publish to the default path with the `nvl-templates-views` tag.
- Use `nvl:templates:views:publish` for a guarded custom path.
- Keep destinations beneath `nvl-templates.views.allowed_publish_roots`.

## Verify

Run `nvl:templates:doctor --strict --format=json`; use `--scope=core` for
core-only adoption. Also run the Templates Pest suite, Pint, PHPStan at maximum
strictness, generated TypeScript checks, database matrices, cached boot/routes,
and archive inspection.

## Configurable-tenancy release discipline

- Preserve disabled compatibility and package independence; tenant support never creates an undeclared Auth or Suite dependency.
- Use registered package-owned resources, adoption adapters, Actions, and lifecycle APIs. Never add a generic tenant delete-all path or raw cross-package cleanup.
- Treat mapping/configuration hashes, interruption checkpoints, conservation evidence, worker context, tenant-leading queries, and standalone consumption as release contracts.

## Shared owner identities

- Declare owner class lists in `nvl-core.owners` and reference model classes in `templates` capability configuration. Laravel `getMorphClass()` supplies the host-authored stored identity; declarations do not add global host morph mappings.
- Keep resolver visibility and identifier checks, assignment scopes, and template mutation authorization. Routing aliases may differ from shared owner aliases.
- Keep the package allowlist and authorization independent of Core registration. Never authorize a model merely because Core knows it.
- Preserve resolvers, handlers and authorization. Legacy aliases require agreement with native `getMorphClass()` and are removed in major 6; Doctor reports mismatches and stored identity drift without conversion.
- If the host changes its morph map, explicitly reconcile reviewed package-owned columns and affected host relations before cutover. Core and package capability registration never mutate the host morph map or rewrite stored values.

## Shared consumer diagnostics

Run `php artisan nvl:doctor --strict --format=json` to combine checks from loaded NVL providers. Retain the package Doctor command for its detailed report; both paths reuse the package-owned inspection service.


## Shared infrastructure options

- Configure `queue.connection`/`queue.name` and `locks.store`, or inherit Core then Laravel. Historical rendering queue inputs remain supported for one major cycle; preserve rendering retries, timeout, lease, and backoff.
- Unique dispatch and overlap locks must use the selected package store. Inherit route middleware with null, apply explicit `authorization.guard` to bare `auth`, and retain explicit guard middleware and host authorization.

### Brownfield storage identities

Resolve all package tables through the table helper and canonical `nvl-templates.tables.*`, connections through `nvl-templates.connection` with Core/Laravel inheritance. Defaults use `nvl_templates_*`; migration filenames include that package slug. Never silently adopt a matching table or generic migration filename. Run shared `nvl:doctor --strict --format=json` and the explicit `nvl:schema:upgrade --package=templates --claim-legacy --dry-run --format=json` before upgrading owned legacy storage. Validate the complete plan and choose one migration owner. Preserve host records, constraint names and stored morph values. Deprecated config inputs last one major; canonical options take precedence.

## Cache and lock ownership

Render overlap locks use `nvl:templates:render-overlap:` while retaining Laravel release timing and the inherited cache store. Native Laravel dispatch uniqueness remains framework-owned and includes the job class. Generic foreign overlap locks are never acquired or removed.

Drain old mutation workers and maintenance processes, then wait for their outstanding lock leases to end before starting the new major across all nodes. Running old and new lock prefixes concurrently would create independent serialization domains. Restart workers after cutover; preserve host-selected stores and keys, and do not flush a shared cache to remove old NVL entries.

## Canonical configuration ownership

- Read/write `nvl-templates` configuration and publish only canonical `nvl-<package>-<resource>` tags. Keep logical package/tenant resource identifiers unchanged.
- Generic config roots and unprefixed package environment names are foreign by default. For an upgrading NVL host only, select `nvl-core.compatibility.legacy_config` package IDs and `legacy_env` explicitly; both default off. Canonical presence wins, including false/null/empty values. Legacy inputs are read without writing back and are removed in major 6.
- Use canonical `NVL_<PACKAGE>_*` variables only in config evaluation, then rebuild configuration caches and restart workers after cutover. Shared Laravel environment variables retain their names. Consult Core's versioned `support/resources/global-names.json` for all renames.
- Old global aliases and legacy route families require separate explicit `global_aliases`/`legacy_routes` package selections. Preserve collisions and use Doctor diagnostics; never grant generic permissions automatically or claim signed-link compatibility without the same authorization/signature checks.

## Application workflow substitution

Renderer, PDF, asset, owner, payload, and authorization extension contracts remain the existing APIs. Optional PDF installation and worker behavior are unchanged.

The supported workflow injection names are `AssignTemplateContract`, `CreateTemplateContract`, `CreateTemplateVersionContract`, `GetTemplateContract`, `GetTemplateRenderContract`, `GrantTemplateToTenantContract`, `ImportPlatformTemplateContract`, `ListTemplateRendersContract`, `ListTemplatesContract`, `PublishTemplateVersionContract`, `QueueTemplateRenderContract`, `RenderStoredTemplateContract`, `RenderTemplateContract`, `RevokeTemplateTenantGrantContract`, `SyncTemplateDefinitionsContract`, `UnassignTemplateContract`, `UpdateTemplateContract`, `UpdateTemplateVersionContract`.

Inject the supported contract into host orchestration and bind a native interface
mock or host implementation before resolving that orchestration. Keep concrete
constructors and native workflow bodies intact; internal chains remain package-owned.
Use declared DTOs or unsaved model identity handles for orchestration fixtures.
Use real package workflows and Laravel framework fakes for persistence, tenant,
queue, file, and external-effect integration checks. A host substitute proves
only the host call and result. Keep public declarations tagged `@api` and
constructor/configuration/private helpers internal.

Consult the owning README's Testing your app section for native examples. Include
`vendor/nvl/core/support/consumer-audit.neon` in host PHPStan and declare explicit
`nvlConsumer.testPaths`; the Suite workbench is not consumer tooling.


## Consumer runtime and testing contracts

Start with the package README Quickstart and Testing your app sections. Use `nvl:install <package>` for loaded-package common config publication; it does not enable features, run schema or refresh caches. Preserve native host owner keys/morph maps and selected auth/tenancy defaults. Read full runtime defaults and publish advanced config only deliberately.

Inject the supported focused interfaces and preserve host bindings. Returned model handles do not permit package-table queries/writes outside documented capability/extension seams. Host tests may substitute contracts in Laravel's container, use shipped model factories (ordinary make may persist parents; withoutParents()->make is detached), and use Laravel effect fakes deliberately. Only Media/Stripe have dedicated provider/library fakes; do not invent a universal package fake. Settings InteractsWithSettings is definition-only. Host PHPStan may include vendor/nvl/core/support/consumer-audit.neon; no unpublished workbench command is a consumer requirement.

Read docs/events.md and the package README error table. Domain events use schemaVersion=1, model-free facts and actual source-connection commit callbacks; only six declared old Event suffix aliases remain for major 5. Migrate exact listeners/fakes and suffix wildcards, drain old queued payloads, rebuild event cache and restart workers. Delivery is not a durable outbox. The Core exception renderer is opt-in, JSON-only for respondable failures, with exactly message/code/context and host-selected locale. Do not expose diagnostics or reinterpret missing bindings as authorization denial.

Core package logging uses nvl/normal with CSV quiet by default, stable message keys and bounded context; incidents survive quiet. Do not mutate global logger context or log raw row/provider/content/credential payloads. Run only authorized project checks and report new acceptance as pending until actual output exists.
