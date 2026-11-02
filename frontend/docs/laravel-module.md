# Laravel host integration

The frontend is published from the standalone `nvl/templates` Composer package with `php artisan nvl:templates:frontend:publish`; configure its destination through `nvl-templates.frontend.path`. Use `--dry-run` to review generated file changes. See [published frontend integration](published-frontend.md) for focused entry points, dependency metadata and styles.

The optional `examples/laravel` source and generated `integrations/laravel` folder provide reference staff, family and published-customer screens, an injected HTTP repository and session helpers. These are examples of a host-owned HTTP contract. NVL Templates supplies native PHP services and does not register those reference API routes. The consuming application adapts the example transport to its routes, authenticated actors, authorization, storage and native services. Package-level PHP documentation describes those service APIs.

Import reference integrations explicitly. Pure builder/schema/rendering entry points have no network transport, persistence or session dependency. A host supplies JSON, asset references, permissions and callbacks. It owns saving, publication, preview/PDF requests and delivery.

Retain the portable `template-document` v1, `gct-template` and `urn:gct` values when adapting transport. Managed assets and retained output use native NVL Media integration through PHP services; preview URLs are not authority to retain arbitrary assets.
