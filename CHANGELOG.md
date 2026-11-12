# Changelog


All notable changes to `nvl/templates` are documented here.

## [Unreleased]

### Fixed

- Keep unscoped Templates readable alongside unrelated adopted resources. The forward migration removes unused ownership columns and preserves owned graphs.
- Recover a MySQL installation interrupted by the 7.0.2 resource index error with `nvl:templates:schema:recover`.

## [7.0.3] - 2026-11-11

### Fixed

- Pin URL asset imports to the validated public address: the request no longer uses Guzzle's stream transport, which ignored the pinned DNS result and resolved the hostname a second time. Oversized downloads are aborted as soon as they pass the byte limit.
- Reject HTML comments that contain markup in binding artifacts. Browsers and Outlook end or interpret such comments differently from the validating parser, which exposed unvalidated elements, event handlers and remote images.
- Reject CSS `image-set()` wherever `url()` is refused, so remote images cannot bypass managed asset retention.
- Treat a malformed template, family, resource, asset, revision or render identity as not found on PostgreSQL instead of raising a query error, and keep a draft that references one readable for repair.
- List retained assets on PostgreSQL; `TemplateCatalog::assets()` compared the UUID Media identity with an empty string and failed.
- Reuse an existing detached resource copy when the database returns its JSON provenance keys in another order (MySQL), instead of creating a duplicate on every copy.
- Refuse a non-UUID processing token in `RenderRequests::process()` before the request is claimed; on PostgreSQL it permanently failed the accepted render.
- Allow the document schema to install on MySQL and MariaDB. The resource table's composite unique key exceeded InnoDB's 3072-byte index limit under utf8mb4, so the create migration failed with error 1071. The `kind`, `scope` and `owner_key` columns are now bounded (32, 32 and 64 characters); every value the package writes fits. Installations already migrated on PostgreSQL or SQLite keep their wider columns and need no action.

<!-- NVL GENERATED CHANGES START -->
### Changed

- fit MySQL index limits and harden media URL import
<!-- NVL GENERATED CHANGES END -->

## [7.0.2] - 2026-11-10

### Fixed

- Clarify the existing PDF adapter contract: the supplied read-only `RenderedDocument` fields and `toArray()` are supported public API, while construction and retained-bundle parsing remain internal. Preserve the callback signature and runtime shapes; update the API catalog and consumer guidance.

<!-- NVL GENERATED CHANGES START -->
### Changed

- support the supplied PDF callback render value
<!-- NVL GENERATED CHANGES END -->

## [7.0.1] - 2026-11-09

### Changed

- Refresh the inherited Ownership deletion API reference for ordinary models and native pivots.

<!-- NVL GENERATED CHANGES START -->
### Changed

- refresh inherited ownership deletion contracts
<!-- NVL GENERATED CHANGES END -->

## [7.0.0] - 2026-11-03

- Adopt the reviewed NVL 7 family for PHP 8.4+ and Laravel 13, with compatible required and optional NVL peers. Review the package upgrade guide before deployment.

### Changed

- Replace the former Blade/Content definition, assignment and version engine with portable document sources, pinned template families, structural variation points and reviewed upgrade/rebase/detach/regroup workflows.
- Require NVL Media for immutable retained assets and complete durable HTML/email or PDF output; preserve native actor/owner admission, source transactions, current grants, leases, retries, output bounds and recovery.
- Publish the existing complete React/Themelia builder as application-buildable source, with shared schemas, dependency manifest and bundled Node renderer. Applications own transport, routes and delivery.
- Expose focused native services, bounded catalog pagination, exact family revision reads and bounded editor/browser projections. Laravel Mail adaptation consumes native output arrays and preserves CID attachments/plain text.
- Adopt canonical NVL document table identities and fresh-only native Ownership activation. Retain all eight legacy migration files unchanged; existing installations require explicit staged migration. See [UPGRADING.md](UPGRADING.md).
- Replace legacy integration guidance, configuration, factories and consumer skills. Retire obsolete Blade/mPDF/Content APIs and their named lifecycle events.

### Fixed

- Honor the actual package/suite database connection in all document migrations and native Media composition.
- Preserve raw variant authority, numeric JSON object keys, scoped resource visibility and immutable revision evidence across the full family lifecycle.
- Revalidate canonical actors, Media permissions/bytes and queued business ownership; reject malformed publication data through native validation.
- Filter email media before pagination; enforce complete preview/email output budgets, matching CID bytes, outer-transaction rollback cleanup and retained output integrity.

## [6.1.0] - 2026-10-23

<!-- NVL GENERATED CHANGES START -->
### Changed

- expose safe host APIs and harden package boundaries
<!-- NVL GENERATED CHANGES END -->

## [6.0.1] - 2026-10-21

### Changed

- Share configured Template registration, queue capture and native backfill while retaining reviewed snapshot rebinding, checksums and domain graph verification.
- Require optional Ownership >=6.0.1 when installed so new shared backfill callers cannot resolve an older runtime. Require Core >=6.0.1 for the shared model, queue or compatibility implementation.

## [6.0.0] - 2026-10-20

### Changed

- Integrate configured models and native/inherited ownership throughout template compositions, localized rows and document rendering. Revalidate canonical parents and private asset access inside the admitted owner.
- Align required/development NVL peers on `^6.0`, optional peer conflicts on major 6, and `dev-main` on `6.x-dev`. Review [UPGRADING.md](UPGRADING.md) before rollout.

## [5.0.1] - 2026-10-08

### Changed

- Correct published-family verification and adoption guidance for local Dagger CI; runtime contracts are unchanged.


## [5.0.0] - 2026-10-08

### Changed

- Renderer, PDF, asset, owner, payload, and authorization extension contracts remain the existing APIs. Optional PDF installation and worker behavior are unchanged. Document contract substitution and truthful host fixtures in Testing your app.
- Classify the supported consumer PHP surface with explicit source annotations and restrict package model handles to declared identity and in-memory read fields; preserve existing workflow behavior and concrete signatures.
- Isolate owned cache and lock keys under `nvl:templates:`; preserve generic host entries and explicit store choices.

- Adopt lockstep major 5 with required and development NVL peer floors of `^5.0`.
- Use collision-checked nvl-template-version for package-owned versions and Laravel identity for host assignment owners.
- Review [UPGRADING.md](UPGRADING.md) before adopting the new names and infrastructure boundaries.

## [2.2.1] - 2026-09-26

### Documentation

- Clarify public support, contribution, and private security reporting paths.

## [2.2.0] - 2026-09-25

### Changed

- Prepare `nvl/templates` for independent Composer and Git publication; require `nvl/core` for shared Support and Data services.

## [2.0.1] - 2026-09-22

### Added

- Added tenant template graphs, immutable platform catalog grants/copies,
  Content copy seams, staged Media import rollback, isolated renders, and adoption.

### Fixed

- Reload stored template and render model state before rendering, queueing, or
  disclosing requester-owned history and Media relationships.
- Enforce local roots and exact remote hosts at every mPDF asset fetch,
  including nested SVG resources, with bounded remote reads and no redirects.
- Preserve unique staging constraints through repeatable index renaming during
  adoption, including PostgreSQL constraint-backed and standalone indexes.
- Check architecture restrictions independently while confining reviewed
  Content preflight and mutation dependencies to the adoption integration.

## [2.0.0] - 2026-08-29

### Changed

- Established render, list, and mutation Actions plus renderer/asset contracts
  as the 2.0 consumer boundary; direct consumer Template-model queries now fail
  Suite audit.

## [1.0.7] - 2026-08-22

### Changed

- Aligned the documented runtime requirement with the PHP 8.4+ package
  baseline.

## [1.0.5] - 2026-08-12

### Changed

- Released unchanged under the suite's shared version.

## [1.0.2] - 2026-08-12

- Added a versioned staged-adoption command with schema inventory, explicit
  key/scope/locale/Media maps, staging-index preparation, Action-backed writes,
  idempotent reconciliation, and fail-closed asset counts.
- Added a compatibility preflight migration and expanded Doctor checks for
  every canonical Templates column and named index.
- Added an opt-in revision-aware NVL Media asset resolver, scoped alias
  registry, and source-alias adoption helper for class templates.
- Added consumer contract coverage for opt-in HTTP management/rendering, bounded JSON Schema validation, PDF configuration, and distribution hygiene.
- Added source-controlled definitions, renderer and owner registries.
- Added UUID template, translation, version, assignment, and render schemas.
- Added Content block compositions, immutable publication snapshots, current
  Media/reference resolution, optimistic revisions, and synchronous or queued
  rendering.
- Added bundled mPDF rendering with bounded page options, dedicated temp
  storage, dangerous-HTML rejection, and fail-closed remote asset allowlists.
- Added source-schema validation, render payload validation, canonical content
  and request hashing, draft updates, assignment removal, and concurrent
  idempotency recovery.
- Added fail-closed authorization, configurable opt-in APIs, diagnostics, and
  definition synchronization.
- Removed parallel version-string and template-asset persistence in favor of
  `nvl/content` fields, locale rows, placements, and Media integration.
- Uses the configured Templates database connection for every Action-owned
  transaction and after-commit queue dispatch.
- Added the directly constructible `Nvl\Templates\Template` core, typed
  `TemplateOptions`, `PdfOptions`, `PdfMargins`, and one shared renderer
  context for direct and database-backed templates.
- Added guarded publishable HTML/PDF document, header, footer, section, table,
  and page-break Blade foundations.
- Added typed PDF header/footer views, watermark, compression, PDF/A, metadata,
  orientation, margins, font, DPI, and image-quality overrides.
- Added verified output size/checksum facts and protected inline/download
  responses through `TemplateResponseFactory`.
- Added `RenderStoredTemplateAction` as the database adapter into
  `RenderTemplateAction`; synchronous APIs and queued work use the same
  rendering pipeline.
- Changed synchronous render APIs to return actual HTML/PDF bytes instead of
  JSON-encoding potentially binary output.
- Added the reusable `BaseTemplate`/`BasePdfTemplate` class surface,
  `PdfServiceInterface`, `GeneratedPdfInterface`, HTML payload/context
  adapters, fluent PDF configuration values, and guarded Content/asset view
  accessors.
- Preserved class-template configuration, variation, frame/sticker,
  generation, response, and storage methods while replacing static lookups
  with injected contracts and one verified rendering pipeline.
- Added bounded local/inline/remote asset policies, safe per-template temporary
  directory overrides, production-gated image diagnostics, validated raw
  source-defined headers/footers, and atomic local PDF persistence.
- Added ancestor-symlink-safe path resolution for view publication, PDF
  persistence, and temporary directories.
- Added strict JSON-only content guards, exact source-definition/PDF option
  keys, a documented bounded JSON Schema subset, and fail-closed route
  middleware configuration.
- Added one shared stored-render/version resolver and consistent published or
  retired assignment-pin policy.
- Added leased queue ownership, overlap and uniqueness locks, terminal-timeout
  handling, immutable assignment-settings snapshots, bounded recovery for
  expired leases and failed queue pushes, and queue configuration diagnostics.
- Consolidated durable render processing fields and recovery indexes into the
  unreleased package’s clean render-table migration.
- Added binary signature validation for data-image resources embedded directly
  in rendered PDF HTML.
- Serialized publication on the template aggregate, restricted publication to
  active synchronized drafts, and advanced retired-version revisions.
- Applied payload-retention policy to terminal failures and withheld partial
  output Media references unless a render completed successfully.
- Wired the configured default page size into both history APIs and added its
  bounds to doctor diagnostics.
- Added authorized render history/status APIs with private transport DTOs and
  no-store response headers.
- Made definition synchronization atomic and deterministic, with safe
  reactivation of restored source definitions.
- Added scoped core/database doctor checks and name-preserving migration
  publication.
- Preserved registered inactive templates during definition synchronization
  while continuing to reactivate restored archived definitions.
- Added owner, profile, and pinned-version context to assignment and stored
  render authorization so consumer policies can enforce domain ownership.
- Allowed class-template PDF assets only when absolute local paths pass the
  configured root, file, and size guard.
- Confined class-template save filenames to safe PDF basenames and made output
  disk diagnostics conditional on output persistence being enabled.
- Restored configured class-template page numbering without replacing trusted
  header/footer HTML and hardened PDF resource scanning for quoted whitespace
  and escaped URL payloads.

## [1.0.0] - 2026-08-08

- Initial coordinated package-family release for Laravel 12–13.
