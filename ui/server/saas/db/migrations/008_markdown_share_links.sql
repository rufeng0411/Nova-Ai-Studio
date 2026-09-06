-- PD-SAAS-FORK: public markdown share links (opaque id, no user JWT)
CREATE TABLE IF NOT EXISTS markdown_share_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  project_key TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  hint_dir TEXT,
  title TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  seo_indexable INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markdown_share_links_lookup
  ON markdown_share_links (tenant_id, user_id, project_key, relative_path);

CREATE INDEX IF NOT EXISTS idx_markdown_share_links_active
  ON markdown_share_links (id)
  WHERE revoked_at IS NULL;
