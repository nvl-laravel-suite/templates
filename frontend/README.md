# NVL Templates frontend maintainer workspace

This private workspace is the canonical React builder source for the `nvl/templates` Composer package. Its npm name is retained for source/test compatibility and does not imply ownership of a registry name. Composer applications consume the generated resources without installing a Template Maker npm package.

Use Node 24 and the checked-in dependency lockfile. Maintainers run `npm run build:composer` here to regenerate `../resources/js/template-maker`, `../resources/runtime`, `../resources/contracts` and `../resources/frontend-manifest.json`. `npm run check:composer` checks drift, including the schemas and email profile. The generated browser parser and Node worker retain third-party license notices. The Node worker bundles its dependencies.

For development qualification, an ignored `node_modules` symlink may point to an existing compatible dependency installation; no dependency installation is needed for Composer consumers. App and library builds share `dist`, so run them sequentially.

Consumers opt in with `php artisan nvl:templates:frontend:publish --dry-run` and configure `nvl-templates.frontend.path`. See [published frontend integration](docs/published-frontend.md) for entry points, styles, dependency metadata and optional host adapters. Core source has no persistence or HTTP transport. Laravel reference examples are explicit imports and require a host-owned transport contract.

The portable `template-document`, `gct-template` and `urn:gct` formats and checksums remain unchanged. Existing builder components are reused without redesign.

Run `npm run verify` for source boundary checks, type checking, the complete frontend suite, sequential app/library builds, isolated published-source browser/Tailwind/headless/SSR checks, drift checks and worker transport checks. The previous module's Composer consumer harness is excluded because it targets removed PHP APIs. Native Composer qualification belongs to the package PHP suite.
