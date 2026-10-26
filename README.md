# NVL Templates

Reusable template definitions, versions, assignments and rendering for PHP 8.4 and Laravel 13. Native services own validation, authorization, version integrity, ownership, transactions, leases, output bounds and durable recovery.

Consumers own data objects, Actions, controllers, routes, view models and download responses. Use native models, enums and documented arrays; no package DTO or fluent compatibility layer is required.

## Services

- `TemplateDefinitions`: sync registered definitions with an explicit actor and optional dry run.
- `TemplateLifecycle`: create/update/delete templates, create/update/publish versions.
- `TemplateAssignments`: assign/unassign admitted owners.
- `TemplateReader`: authorized template/version and render-record reads, pagination and render history.
- `TemplateRenderer`: render bounded output, queue a `TemplateRender` model and recover durable jobs.

```php
use Nvl\Templates\Services\TemplateRenderer;

$output = app(TemplateRenderer::class)->render($template, $context, $options, $actor);
```

The render result contains content bytes, MIME type, renderer, byte size, checksum, optional subject and suggested filename. Consumers choose HTTP delivery or persistence. PDF bytes are binary; do not automatically JSON-serialize them. Use the documented PHPDoc for accepted context/options and model fields.

Blade-only rendering works without Content, Media or mPDF. Enable integrations explicitly and retain their existing HTML, URL, asset, output and authorization guards. Base models do not inherit interfaces from optional packages. Optional Content registration supplies explicit permitted groups; optional Media output uses the native private-file lifecycle.

Bind host `TemplateAuthorization` policy. Background identities require explicit grants. Registered owner identity and revision/version guards remain authoritative; consumer Actions must call complete services rather than write package tables.

The deprecated Tenancy bridge, package HTTP layer, passive display carriers and forwarding/fluent PDF helpers are removed. Consumers own their presentation and filesystem/download wrappers. Choose one migration owner and preserve populated rendering and ownership facts during adoption.

See [events](docs/events.md), [upgrading](UPGRADING.md), [security](SECURITY.md) and [contributing](CONTRIBUTING.md).
