// Additive, idempotent schema; no destructive migrations run at startup.
export const schema=[
`CREATE TABLE IF NOT EXISTS cr_snapshots (
 id text PRIMARY KEY, workspace_id text NOT NULL, snapshot jsonb NOT NULL,
 activity jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
)`,
`CREATE INDEX IF NOT EXISTS cr_snapshots_workspace ON cr_snapshots(workspace_id,created_at DESC)`,
`CREATE TABLE IF NOT EXISTS cr_jobs (
 id text PRIMARY KEY, workspace_id text NOT NULL, status text NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled')),
 state jsonb NOT NULL, progress text NOT NULL DEFAULT 'Queued', error text, workflow_id text,
 lease_token text, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
)`,
`CREATE UNIQUE INDEX IF NOT EXISTS cr_jobs_one_active ON cr_jobs(workspace_id) WHERE status IN ('queued','running')`,
`CREATE TABLE IF NOT EXISTS cr_reviews (
 workspace_id text NOT NULL, list_id text NOT NULL, status text NOT NULL,
 owner text NOT NULL DEFAULT '', reason text NOT NULL DEFAULT '', review_date date,
 version integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text NOT NULL,
 PRIMARY KEY(workspace_id,list_id), CHECK(status IN ('unreviewed','keep_active','needs_review','archive_candidate'))
)`,
`CREATE TABLE IF NOT EXISTS cr_review_events (
 id text PRIMARY KEY, workspace_id text NOT NULL, list_id text NOT NULL,
 before_value jsonb, after_value jsonb NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
)`,
`CREATE INDEX IF NOT EXISTS cr_events_workspace ON cr_review_events(workspace_id,created_at DESC)`
];
