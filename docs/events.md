# Commit boundaries and application events

The document engine does not publish the previous Blade lifecycle's named `TemplateChanged` or `TemplateRendered` events. Its event catalog is intentionally empty. See [UPGRADING.md](../UPGRADING.md) when migrating existing listeners.

Native service transactions preserve Laravel's source connection and outer transaction. Durable rendering schedules only after that source outer commit; rollback discards dispatch. Accepted requests, leases and retained artifacts provide render recovery, not a delivery outbox or exactly-once mail guarantee.

The consuming application defines business events and delivery triggers. Dispatch a host event through `Nvl\Support\Events\DomainEventDispatcher` with the actual source connection when an after-commit boundary is required. For Eloquent observers, use Laravel's appropriate after-commit observer interface. Preserve captured native owner/principal authority and apply current read/delivery policies in listeners.

An immutable revision or completed render does not grant access to its data or assets. Keep private snapshots, processing tokens, attachment bytes and mutable actor attributes out of public event payloads. Use a host-owned durable delivery/outbox workflow when crash recovery is required after rendering.
