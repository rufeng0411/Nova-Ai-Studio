-- PD-SAAS-FORK: marketing site contact / invite / analytics (PostgreSQL)

CREATE TABLE IF NOT EXISTS marketing_contact_leads (
    id SERIAL PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    company TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    ip_hash TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_leads_status ON marketing_contact_leads(status);
CREATE INDEX IF NOT EXISTS idx_mkt_leads_created ON marketing_contact_leads(created_at);

CREATE TABLE IF NOT EXISTS marketing_invite_codes (
    code TEXT PRIMARY KEY,
    created_by INTEGER,
    note TEXT,
    used_by INTEGER,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_invite_used ON marketing_invite_codes(used_by);

CREATE TABLE IF NOT EXISTS marketing_page_events (
    id SERIAL PRIMARY KEY,
    path TEXT NOT NULL,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    country_hint TEXT,
    session_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_events_created ON marketing_page_events(created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_events_path ON marketing_page_events(path);
CREATE INDEX IF NOT EXISTS idx_mkt_events_session ON marketing_page_events(session_key);
