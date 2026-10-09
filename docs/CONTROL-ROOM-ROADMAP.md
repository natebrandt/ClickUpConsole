# ClickUp Admin Control Room

Product direction: one working administration dashboard, not separate one-off reports.

## Delivered foundation
- Workspace inventory, draft standards and configuration comparison.
- Field identity and duplicate-name review.
- Read-only bulk change planning with snapshot hashes.
- Manual read-only workspace sync with progress/cancellation (server token required; session storage only).
- Inventory sorting across filtered results.
- Stale Lists: six/twelve-calendar-month flags, date evidence, Space/search filters and export.

## Next: operational data and decisions
- Durable server-side refresh jobs, scheduled updates, and sync history.
- Durable database for snapshots, profile versions, List assignments and review decisions.
- Owner-approved decisions: keep active, review, archive candidate; reason, owner and review date.
- Dashboard summaries linking directly into filtered work queues.
- Named admin access and role separation before multi-user mutation features.

## Administration modules
- Configuration: statuses, field definitions, templates, views, naming and supported ClickApps.
- Lifecycle: inactivity, empty Lists, open/overdue task counts, accountable owner and archive candidates.
- People and access: accessible membership/guest audits, unassigned work and permission gaps; only where APIs support them.
- Automation: package inventory where supported, external versioned rules, health, run history and failures.
- Change center: exact target preview, approval, fresh-read preconditions, execution status, recovery and immutable audit history.
- Reporting: saved filters, downloadable reports and change-over-time comparisons.

## Delivery order
1. Complete and publish stale-List reporting.
2. Add live read-only refresh and persistent review decisions.
3. Approve canonical standards and assignments.
4. Implement narrowly scoped metadata writes with audit history.
5. Add further supported operations and external automation execution.

Native API gaps remain explicit. Never equate List color with task status workflows, task field values with schema management, or a timestamp proxy with complete audit history. No destructive write is enabled merely because it appears in this roadmap.
