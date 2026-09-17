# API capabilities and automation design

Verified September 17, 2026, against exposed ClickUp connector tools and the official public API reference. The enabled Unified API operator discovery returned “Enabled operators: none.” Do not infer a writable API from a setting visible in the ClickUp UI.

| Feature | Current connector | Public API / implementation boundary |
|---|---|---|
| Hierarchy | Paginated Space/Folder/List read | Standard hierarchy GET endpoints |
| List task statuses | Effective status read | General List workflow replacement not documented |
| List metadata | Name/content/color write tools exist, unused | Update List supports these metadata operations |
| Custom field definitions | Read at workspace/Space/Folder/List scopes | Field values on tasks are writable; generic schema/attachment management not found in documented index |
| Task actions | Status, assignee, field values etc. available, unused | Can power future external rules |
| Space ClickApps | Not exposed | Get/Update Space documents features |
| Views | Not exposed | Documented View CRUD APIs; not wired to this app |
| Native automations | No read/create/update/delete operator exposed | No native rule CRUD endpoint found in reviewed official index |
| Webhooks | No subscription management tool exposed | Public API supports subscription CRUD; needs separate server-side authorization |
| Automation “Call webhook” | Cannot configure through this connector | Native UI action sends events outward; distinct from public API subscriptions |

“No endpoint found” is a finding about published interfaces reviewed, not a claim that ClickUp has no internal implementation. API support does not prove this user's plan or token has permission.

The Update List status property changes List color, not the task status set. Never use it to apply a status standard. Editing parent workflows also has wider blast radius and needs inheritance verification.

## Proposed abstraction

NativeAutomationAdapter and ExternalRuleAdapter should implement the same versioned package interface. Native support currently reports unavailable; no guessed endpoint or UI automation fallback is used.

Rule flow:
1. Register only specifically approved public API subscriptions in Phase 2.
2. Receive raw request bytes; verify HMAC-SHA256 X-Signature using the secret belonging to the registered webhook.
3. Resolve workspace/List/task identity from trusted registration metadata and a fresh authorized task read. Do not trust arbitrary payload scope.
4. Atomically store an inbox event before acknowledgement. Use webhook_id:history_item_id as the event key when history is available; events without stable history identity need a documented digest/dedup strategy or rejection.
5. Queue evaluation outside the request path; match versioned rules with explicit workspace and List allowlists.
6. Generate deterministic action intents; dry-run by default. A future executor must validate task status choices and authorization again.
7. Use an outbox and operation ledger for delivery. Durable inbox and queue writes must be transactional or use an outbox; a bare insert followed by enqueue can lose work on a crash.
8. Bound retries/backoff, detect executor echoes, prevent same-value transitions, cap attempts, dead-letter failures, and reconcile on a schedule for missed events.
9. Monitor subscription health and the creating user's continued access.

lib/governance/rules.ts supplies signature verification, contracts for durable storage and queues, and a pure evaluator. No receiver, subscriptions, storage adapters, task readers, or executor are enabled. config/rules.example.json is disabled and only illustrates a proposed rule; it is not an approved business action.

## Phase 2 data model

- standards (id, version, immutable JSON, SHA256, approval record)
- assignments (workspace_id, list_id, standard_id, version, approver)
- snapshots (id, scope, captured_at, complete/partial, configuration)
- change_plans (snapshot, targets, operations, preconditions, approval)
- operation_log (idempotency_key, actor, before, result, error, compensation)
- webhook_registrations (id, creator, workspace, allowed scope, secret reference)
- event_inbox / outbox / rule_runs (durable dedup, delivery and execution records)

Use per-workspace isolation throughout. Secrets belong server-side; no token in the snapshot, profile files, client bundle, source control, or logs. The current hosted app is private to its owner and uses the captured snapshot.

## Sources

- [Official API index](https://developer.clickup.com/llms.txt)
- [Update List](https://developer.clickup.com/reference/updatelist)
- [Update Space](https://developer.clickup.com/reference/updatespace)
- [Views](https://developer.clickup.com/docs/views)
- [Webhooks](https://developer.clickup.com/docs/webhooks)
- [Create Webhook](https://developer.clickup.com/reference/createwebhook)
- [Get Webhooks](https://developer.clickup.com/reference/getwebhooks)
- [Webhook signature](https://developer.clickup.com/docs/webhooksignature)
- [Automation webhooks](https://help.clickup.com/hc/en-us/articles/35313844961943-Integrate-ClickUp-using-Automation-webhooks)
