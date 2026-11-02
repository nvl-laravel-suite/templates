# Contributing

Follow NVL Light conventions: complete focused domain services, constructor injection, explicit actors, native models/enums/documented arrays, and useful domain values only. Consumers own controllers, routes, Actions, DTOs and application screens. Mark every service `@api` or `@internal`; update generated consumer contracts and portable skill references when public behavior changes.

Preserve portable JSON schemas, hashes, raw family pins/overrides, numeric object keys, current grants and exact revision/media evidence. Keep draft review/apply separate from publication. Use native Ownership and Media operations on the actual source connection; retain outer-commit, rollback cleanup, actor refresh and lease/generation semantics. Add meaningful regressions for behavioral defects.

Run the package's PHP tests, PHPStan max and formatter. In the suite, use the package quality tooling and scope edits to the owning package. Legacy tests remain archived under fixtures and are not certification of the new engine. Do not change released migration files; new schema work requires additive migration/identity updates and explicit upgrade guidance.

`frontend/` is a private maintainer workspace using the existing React/Themelia components. With Node 24 and its locked dependencies, run types, component tests, package/browser checks, published-source consumer tests and worker tests. Run `npm run build:composer` to regenerate `resources/js`, `resources/contracts`, `resources/runtime` and `resources/frontend-manifest.json`; `npm run check:composer` verifies drift. Composer consumers use those generated resources; the maintainer workspace is excluded from distribution archives.

Test a real extracted Composer archive: source publication, native lifecycle/rendering, schema/Media setup and the bundled worker must work without a checkout of Template Maker. Qualify supported production database, disk, queue, compiler/PDF service and email-client behavior in the relevant external matrix before a release claim.
