# Documentation map

This is the current documentation for `@nicolasvlachos/voucher-builder`. Start with the workflow you are integrating; the template and voucher formats are different contracts.

| Goal | Read |
|---|---|
| Install, choose an entry point, import styles | [Installation](../INSTALLATION.md) |
| Understand the package and run the demo | [Project overview](../README.md) |
| Use Template Creator / controlled Template Editor | [Template API](TEMPLATE_API.md) |
| Compose and extend primitives, columns, links and repeaters | [Build a template](BUILDING_TEMPLATES.md) |
| Author email blocks and qualify email output | [Email templates](EMAIL_TEMPLATES.md) |
| Use the original voucher workspace and renderer | [Voucher API](API.md) |
| Find every public export and its complete declaration | [Public export inventory](PUBLIC_API.md) |
| Find every controller, action, and template-library command | [Commands](COMMANDS.md) |
| Understand JSON formats, defaults, permissions, CSS and limits | [Contracts](CONTRACTS.md) |
| Supply preloaded JSON and consume local edits/HTML/JSON in any app | [Host composition](INTEGRATION.md) |
| Integrate Themelia, themes, component owners and agent scripts | [UI integration](UI.md) |
| Inspect UI source ownership, public contracts, exceptions and review drift | [UI compliance review](UI_COMPLIANCE.md) |
| Learn the workspace panels and editing behavior | [Workspace guide](WORKSPACES.md) |
| Extend, test, package, or troubleshoot the codebase | [Maintenance and architecture](MAINTENANCE.md) |
| See what changed and migration requirements | [Changelog](../CHANGELOG.md) |

## Verified examples

[Template composition](../examples/template-composition.mjs) constructs a definition, optional snapshot, application-owned values, personalization and validated HTML locally. Run `npm run build:package` and `npm run check:examples` first. [React workspaces](../examples/react-workspaces.tsx) contains type-checked authoring, personalization, custom-field and voucher-provider examples, with no service or save lifecycle.

The composition example generates six deterministic fixtures, each checked against its corresponding wire schema:

- [Definition](examples/template-definition.v1.json)
- [Template snapshot](examples/template-revision.v1.json)
- [Personalization](examples/template-personalization.v1.json)
- [Field](examples/template-field.v1.json)
- [Render input](examples/template-render-input.v1.json)
- [Reusable block library](examples/template-block-library.v1.json)

These are examples, not production records or a migration mechanism. Schema files live in [schemas](../schemas/template-definition.v1.schema.json); never edit generated schemas by hand.

## Keeping this documentation current

`npm run build:docs` regenerates the export inventory from TypeScript. `npm run check:docs` checks inventory drift, local links/anchors, command coverage, and action-event coverage. `npm run check:examples` compiles the React examples and validates all six composition fixtures. See the [release checklist](MAINTENANCE.md#verification-and-release).

`WALKTHROUGH.md`, `PLAN.md`, and `docs/superpowers/` retain historical design context. They describe earlier architecture or proposals; use the guides above for current behavior. Generated declarations are the precise TypeScript contract, and the guides explain semantics and integration choices.
