# Contributing

This public repository is a publication mirror of private source. Open an issue
here for a bug or proposal; include a reproduction and, if helpful, a patch.
Maintainers apply accepted changes in source and publish a mirror release.
Direct mirror pull requests do not update source. See the
[organization contribution guide](https://github.com/nvl-laravel-suite/.github/blob/main/CONTRIBUTING.md).

Keep Templates headless, generic, and free of application-specific workflows.
Add strict types, complete parameter and return types, DTOs at boundaries,
transactions in Actions, and after-commit events. New renderers implement the
public contract and must never evaluate untrusted executable source.

Add Pest coverage for success, authorization, concurrency, failure, queue,
locale, database, Media behavior, payload schema validation, PDF output, and
remote/local PDF resource rejection. From a standalone checkout of the public
Templates repository, run:

```bash
composer install
composer quality
```

Maintainer CI also runs suite integration and package-family checks in the private source workbench.

Update the README, changelog, upgrade guide, and packaged skill whenever a
public contract, command, configuration key, schema, or operational behavior
changes.
