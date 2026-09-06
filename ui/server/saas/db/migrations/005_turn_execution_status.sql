-- PD-SAAS-FORK: Turn queue execution lifecycle fields on conversation_catalog

ALTER TABLE conversation_catalog
    ADD COLUMN IF NOT EXISTS execution_status TEXT NOT NULL DEFAULT 'idle';

ALTER TABLE conversation_catalog
    ADD COLUMN IF NOT EXISTS queue_position INTEGER;

ALTER TABLE conversation_catalog
    ADD COLUMN IF NOT EXISTS queued_payload_json TEXT;

ALTER TABLE conversation_catalog
    ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

ALTER TABLE conversation_catalog
    ADD COLUMN IF NOT EXISTS paused_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_conversation_catalog_execution_status
    ON conversation_catalog (tenant_id, user_id, execution_status)
    WHERE deleted_at IS NULL AND execution_status IN ('queued', 'running', 'paused');

UPDATE conversation_catalog
SET execution_status = 'idle'
WHERE execution_status IS NULL OR execution_status = '';
