# Security Policy

Submit reports through [this package's private vulnerability reporting form](https://github.com/nvl-laravel-suite/templates/security/advisories/new).

Security fixes are provided for the published `5.x` release line. Composer declares PHP `^8.4` and Laravel `^12.0|^13.0`. The local Dagger release gate verifies PHP 8.4/Laravel 13 with MySQL 8.4 and PostgreSQL 17 persistence contracts; PHP 8.5, Laravel 12 and MariaDB require separate compatibility evidence. Upstream security lifecycle limits still apply.

Include the definition key, renderer alias, route group, owner scope, payload
shape, storage disk, and impact. Do not include production secrets or personal
content. Keep APIs disabled until authorization is bound, keep views and
renderer classes source-controlled, bound every JSON input, encrypt queued
payloads, and deliver private outputs only through Media authorization.

The bundled PDF renderer rejects dangerous tags and resource schemes, bounds
HTML/data-image size, uses a dedicated allowlisted temp root, and disables
remote assets by default. Enabling remote assets requires HTTPS and exact hosts.
These controls do not make arbitrary user HTML safe: escape all persisted and
request values in Blade and never render user-authored executable markup.

Renderer output is verified for maximum size, MIME safety, exact byte count,
SHA-256 checksum, safe filename, subject line safety, and PDF signature.
`TemplateResponseFactory` protects Content-Type, Content-Length, ETag,
Content-Disposition, and nosniff headers. PDF headers and footers must be
source-controlled views; database/request-provided raw header or footer HTML is
not supported.
