# ClickUp Admin Control Room

Product direction: one working administration dashboard, not separate one-off reports.

## Delivered foundation
- Workspace inventory, draft standards and configuration comparison.
- Field identity and duplicate-name review.
- Read-only bulk change planning with snapshot hashes.
- Durable background sync with Postgres checkpoints, atomic snapshot publication, cancellation, recovery, and recent run history.
- Saved lifecycle decisions, owner labels, follow-up dates, optimistic concurrency, and append-only review history.
- Admin overview with actionable inactivity and follow-up queues.
- Inventory sorting across filtered results.
- Stale Lists: six/twelve-calendar-month flags, date evidence, Space/search filters and export.

## Next: operational data and decisions
- Optional scheduled updates and richer historical comparisons.
- Persist approved profile versions and explicit List-to-standard assignments.
- Named admin access and role separation before multi-user mutation features.

## Administration modules
- Configuration: statuses, field definitions, templates, views, naming and supported ClickApps.
- Lifecycle: inactivity, empty Lists, open/overdue task counts, accountable owner and archive candidates.
- People and access: accessible membership/guest audits, unassigned work and permission gaps; only where APIs support them.
- Automation: package inventory where supported, external versioned rules, health, run history and failures.
- Change center: exact target preview, approval, fresh-read preconditions, execution status, recovery and immutable audit history.
- Reporting: saved filters, downloadable reports and change-over-time comparisons.

## Delivery order
1. Approve canonical standards and assignments.
2. Add task-health metrics and saved views.
3. Implement narrowly scoped metadata writes with audit history.
4. Add further supported operations and external automation execution.

Native API gaps remain explicit. Never equate List color with task status workflows, task field values with schema management, or a timestamp proxy with complete audit history. No destructive write is enabled merely because it appears in this roadmap.
