# ClickUp Admin Console — Phase 1

Read-only audit of the connected ClickUp workspace, with draft standards and non-executable change plans. Built with React, TypeScript, Vinext/Vite, and the installed Shadcn components. Hosted deployment is owner-private through Sites.

## Run locally

Requires Node 22.13+ and npm.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the local address printed by the development server. The bundled snapshot works without a ClickUp token. Keep the local server bound to loopback: it has no standalone authentication. Hosted privacy is enforced by Sites, not by a custom login screen in this app.

```sh
npm test
npx tsc --noEmit
npm run build
```

The build produces a Cloudflare-compatible Worker in dist/server and browser assets in dist/client. Sites packaging/deployment uses .openai/hosting.json; do not change the owner-only audience. Deploying elsewhere requires an authenticated access layer in front of both HTML and all data/asset routes.

## What was collected

Connected workspace 1230709, September 17, 2026:
- 23 Spaces, 72 Folders, 465 Lists.
- Effective status configurations and accessible custom fields for all 465 Lists.
- Workspace, 23 Space and 72 Folder field scopes.
- 171 unique custom field IDs and 30 status-name/category workflow variants.
- List descriptions when returned. Null means unobserved; an empty string means observed empty.
- Field types, canonical IDs, option definitions, required flags, status types, colors and order.

The hierarchy call reported no remaining pages. Counts cover locations visible to the connected user, not a guarantee that archived/private/inaccessible locations are included. Task records, comments, attachments, and task-level field values were not collected. Scope errors and collection coverage are retained in data/snapshot.json.

The current connector does not expose Space settings, parent status definitions or override flags, views, or native automation rules. These remain explicitly unknown. No ClickUp mutation tools were called.

## Use the console

1. Filter by Space, suggested standard, result, or List/Folder name.
2. Open a List for the side-by-side comparison and raw observed field options.
3. Change its comparison profile to explore another candidate. This does not assign a policy.
4. Select Lists; choose each naming-based suggestion or one explicit profile for the batch.
5. Preview and export the dry-run plan. Unclassified selections require an explicit profile.
6. Export the captured snapshot or individual profile definitions for review.

Selection and the latest plan live in page memory and reset on reload. Export plans before leaving. No background synchronization or monitoring is scheduled.

## Versioned standards

config/profiles.json contains six draft v1.0.0 profiles:
- Website Project, based on MDC Web Template.
- Retainer, based on Retainer in Nate's Space.
- Digital/Content, based on Digital/HTML.
- Internal, based on Nicole :: Internal Tasks.
- Time Tracking/Admin, proposed three-stage workflow; source context is Administrative Time Tracking.
- Support/Tickets, based on the existing Tickets List.

These seeds are candidates, not approved organizational policy. Source List identity is preserved in each profile. To adopt a standard, review status meanings and field identities with workspace owners, copy the approved config to a new semantic version, and implement a separate explicit assignment registry. Do not overwrite prior versions used by exported plans. No assignment registry or approval UI is implemented in Phase 1.

The engine compares normalized status names, category, color and ordering. Location-specific status IDs are deliberately ignored. Canonical field IDs, names, types, required flags and option identity/order/labels/colors are compared; unrequested extra fields are retained, but duplicate names with different IDs are flagged. Arbitrary non-option type_config properties (e.g. formula expressions) are inventoried but not enforced by the current draft profiles. Client-style profiles propose Client :: Project naming. All profiles propose descriptions, List/Board views and an automation package placeholder. Package identifiers are reserved design references, not deployed rules.

Alignment = matching known checks / all known checks, rounded. Unknowns are excluded and coverage is shown separately. Workspace alignment pools checks for suggested Lists only; unclassified Lists are explicitly not assessed. A 100% known-check score never means unavailable settings were verified. All checks currently have equal weight; it is a candidate-alignment metric, not a security or project performance score.

## Refresh the snapshot

The ChatGPT ClickUp connection bootstrapped the dataset, but its credentials cannot be embedded or reused by the hosted browser. A standalone GET-only importer is included:

1. Set CLICKUP_API_TOKEN and optionally CLICKUP_WORKSPACE_ID in a trusted local shell, or use a local secret manager. .env.example documents the names; the importer does not auto-load .env files. Node's --env-file option can load a local .env if desired.
2. Run `npm run sync:clickup`.
3. Review data/snapshot.json coverage/errors and compare counts with the previous export.
4. Run tests, build, and redeploy to publish the new snapshot.

The importer verifies workspace access, enumerates active Spaces, folderless Lists, Folders and their Lists, reads List details and custom fields at all scopes, and captures returned Space features. Requests are GET-only, paced under 100/minute, with bounded 429/5xx retry and request timeouts. A structural hierarchy read failure aborts without replacing the prior snapshot; detail/field failures are recorded as unknown. No token is saved or sent to app users. It is not a hosted automatic refresh service. The current UI preserves Space features in snapshot export but continues to show connector-era checks as unknown; extending the adapter-aware settings evaluator is a future task.

## Code map

- app/console.tsx: dashboard, inventory, comparisons, plans, and capability report.
- data/snapshot.json: real initial dataset and collection provenance.
- config/profiles.json: six versioned draft standards.
- lib/governance/engine.ts: deterministic audit, classification, plan hashing, stale-plan rejection and write guard.
- lib/governance/rules.ts: webhook signature verification and scoped dry-run rule evaluation.
- scripts/sync-clickup.mjs: offline GET-only refresh.
- tests/governance.test.mjs: safety and comparison regression tests.
- docs/API-CAPABILITIES.md: capability findings and architecture.

## Change-plan boundary

Plans include workspace and List IDs, before configurations, profile versions/hashes, snapshot hash/time, findings, risks, manual/inspection/future-API classifications, and execution guards. Every operation is executable:false. applyStandard() always throws; no network write adapter or Apply endpoint exists.

Before Phase 2: establish an authenticated operator/approver model, immutable profile history and assignment registry, fresh-read preconditions, permission/capability checks, durable audit log, idempotency, partial failure recovery, explicit task-status migration maps, and per-operation compensation. Snapshot rollback cannot restore lost task history or field data automatically.

The stale-plan check compares the complete snapshot including timestamp, so even a refreshed snapshot with unchanged settings requires regenerating a plan. The beforeHash is a stricter per-List precondition for a future executor; hashes do not authorize execution.

## Validation

Tests cover status order/types, canonical field identity, unknown data, inference precedence, duplicate targets, immutable snapshot fingerprints, stale-plan rejection, blocked writes, webhook signature tampering and rule scope/echo prevention. UI checks cover search, List inspection and dry-run plan creation. WebMCP read comparisons were checked with valid and invalid IDs.

The public API refresh script is included and syntax-checked but was not run against an independently supplied API token. The initial dataset came from the existing connector. Native automation writes, webhook delivery and any mutation execution are deliberately not implemented.
