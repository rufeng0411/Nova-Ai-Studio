-- SaaS control database (users, tenants; sessions optional for refresh tokens)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    UNIQUE(tenant_id, username),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saas_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_users_username ON users(username);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saas_sessions_user ON sessions(user_id);

-- Phase 2: Billing & subscriptions
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    credits_monthly INTEGER NOT NULL DEFAULT 0,
    price_cents INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_user ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS credit_wallet (
    user_id INTEGER PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    reason TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saas_credit_ledger_user ON credit_ledger(user_id);

-- Phase 3: Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    user_id INTEGER,
    tenant_id TEXT,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saas_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_saas_analytics_created ON analytics_events(created_at);

-- Router usage attribution: maps a gateway session to the owning user/tenant
-- and project. The gateway's router stats (token usage) are keyed only by
-- sessionId + projectPath with no tenant dimension, so we record ownership at
-- turn time to attribute "路由" token usage per user/project in SaaS mode.
CREATE TABLE IF NOT EXISTS usage_session_owner (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER,
    tenant_id TEXT,
    project_path TEXT,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saas_usage_owner_user ON usage_session_owner(user_id);
CREATE INDEX IF NOT EXISTS idx_saas_usage_owner_tenant ON usage_session_owner(tenant_id);

-- PD-SAAS-FORK: tombstone for orphan transcripts after hardDelete (catalog gone, jsonl may remain)
CREATE TABLE IF NOT EXISTS session_tombstones (
    session_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT 'user-delete',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, user_id, session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_tombstones_session ON session_tombstones(session_id);

-- PD-SAAS-FORK: marketing site contact / invite / analytics
CREATE TABLE IF NOT EXISTS marketing_contact_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    company TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    ip_hash TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mkt_leads_status ON marketing_contact_leads(status);
CREATE INDEX IF NOT EXISTS idx_mkt_leads_created ON marketing_contact_leads(created_at);

CREATE TABLE IF NOT EXISTS marketing_invite_codes (
    code TEXT PRIMARY KEY,
    created_by INTEGER,
    note TEXT,
    used_by INTEGER,
    used_at DATETIME,
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mkt_invite_used ON marketing_invite_codes(used_by);

CREATE TABLE IF NOT EXISTS marketing_page_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    country_hint TEXT,
    session_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mkt_events_created ON marketing_page_events(created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_events_path ON marketing_page_events(path);
CREATE INDEX IF NOT EXISTS idx_mkt_events_session ON marketing_page_events(session_key);

-- PD-SAAS-FORK: Showcase admin sections + items
CREATE TABLE IF NOT EXISTS showcase_sections (
    id TEXT PRIMARY KEY,
    title_zh TEXT NOT NULL,
    title_en TEXT NOT NULL,
    lead_zh TEXT,
    lead_en TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    star INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_showcase_sections_sort ON showcase_sections(sort_order);

CREATE TABLE IF NOT EXISTS showcase_items (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    name_zh TEXT NOT NULL,
    name_en TEXT NOT NULL,
    annotation_zh TEXT,
    annotation_en TEXT,
    badge_zh TEXT,
    badge_en TEXT,
    prompt_zh TEXT,
    prompt_en TEXT,
    thumb TEXT,
    href TEXT,
    star INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    source_session_id TEXT,
    source_artifact_paths TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES showcase_sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_showcase_items_section ON showcase_items(section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_showcase_items_status ON showcase_items(status);
CREATE INDEX IF NOT EXISTS idx_showcase_items_published ON showcase_items(published_at);

-- PD-SAAS-FORK: public markdown share links
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
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_markdown_share_links_lookup
  ON markdown_share_links (tenant_id, user_id, project_key, relative_path);
