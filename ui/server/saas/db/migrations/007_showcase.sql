-- PD-SAAS-FORK: Showcase admin sections + items (PostgreSQL)

CREATE TABLE IF NOT EXISTS showcase_sections (
    id TEXT PRIMARY KEY,
    title_zh TEXT NOT NULL,
    title_en TEXT NOT NULL,
    lead_zh TEXT,
    lead_en TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    star INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_showcase_sections_sort ON showcase_sections(sort_order);

CREATE TABLE IF NOT EXISTS showcase_items (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL REFERENCES showcase_sections(id) ON DELETE CASCADE,
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
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_showcase_items_section ON showcase_items(section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_showcase_items_status ON showcase_items(status);
CREATE INDEX IF NOT EXISTS idx_showcase_items_published ON showcase_items(published_at DESC);
