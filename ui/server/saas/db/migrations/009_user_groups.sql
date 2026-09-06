-- PD-SAAS-FORK: user group assignment for capability / template visibility
ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id TEXT NOT NULL DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_saas_users_group ON users(group_id);
