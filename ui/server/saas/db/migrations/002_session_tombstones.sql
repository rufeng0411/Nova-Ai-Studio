-- PD-SAAS-FORK: tombstone registry for orphan transcripts after hardDelete

CREATE TABLE IF NOT EXISTS session_tombstones (
    session_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT 'user-delete',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, user_id, session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_tombstones_session ON session_tombstones(session_id);
