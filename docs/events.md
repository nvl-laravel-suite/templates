# NVL templates events

This document describes the implemented source behavior. Acceptance is exercised by the owning package suites and Core committed-event regression tests; current release execution evidence is tracked in consumer-readiness.md. The authoritative machine-readable schema is [event-catalog.json](../resources/event-catalog.json), catalog version `1`. Event `schemaVersion` is independent of catalog version.

## Publication and listener timing

The native host dispatcher receives the captured event after the supplied source connection outer commit, or immediately when that connection has no active transaction.

Callbacks attach to the matching native connection and current nesting record; native outer/savepoint rollback discards the corresponding callbacks.

Missing source transaction records fail before commit; Mail Notifications reports and drops unusable observations.

Host after-commit listeners and queue after_commit policies can add their own deferral after publication. Host transaction infrastructure and dispatcher bindings are preserved.

Local callbacks are not an outbox. Process exit between commit and callback can lose delivery; no crash durability or exactly-once delivery is promised.

One canonical object is dispatched per qualifying producer call. This is local publication, not cross-process deduplication or a guarantee that repeated observations are unique.

Use Nvl\Support\Events\DomainEventDispatcher::dispatch($event, $writerConnection). Native Event::dispatch() is immediate and has no package interception.

## Payload security and no-op behavior

TemplateChanged includes the explicit native actor; do not serialize it as a public response. Render facts omit rendered output, definition payload and assigned models.

Existing assignment/version/render guards govern publication. Completed render describes its persisted record, not durable listener execution.

Actor/owner identifiers do not grant access. Listeners must preserve the captured ownership and apply their own authorization when reading storage. Readonly payload fields and native value objects are schema facts; public constructors with mixed arrays do not create a new recursive sanitization boundary. Package producer shapes are documented below; hosts must not attach models, mutable service objects or private arbitrary data.

## Canonical events

The event constructors and PHPDoc define the current payload types and shapes:

- [TemplateChanged](../src/Events/TemplateChanged.php)
- [TemplateRendered](../src/Events/TemplateRendered.php)

`TemplateChanged` carries an explicit `Authenticatable|SystemActor`; `TemplateRendered` identifies the render, template and version. The consumer owns presentation and serialization.

## Deferred acceptance checks

Final testing must compare catalog types/defaults/aliases with actual classes, recursively inspect producer payloads, and prove source outer commit, nested rollback, unrelated connection independence and retry behavior without an uncommitted test-harness transaction. Where applicable it must cover cached/queued listeners, canonical fakes, ownership capture, package no-op guards and observational failure containment. This document does not report those checks as passing.

## Consumer event assertions

Use the canonical event class for `Event::fake([...])` and `Event::assertDispatched(...)`. Laravel fake filters compare the emitted class name. Update listeners and fakes to the current source event class; old aliases are not a Light compatibility API.

