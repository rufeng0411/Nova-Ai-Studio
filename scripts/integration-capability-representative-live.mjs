#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Capability hub representative live runs via Gateway harness.
 * Usage:
 *   node scripts/integration-capability-representative-live.mjs
 *   CAP_LIVE_LIMIT=10 node scripts/integration-capability-representative-live.mjs
 *   CAP_LIVE_DRY=1 node scripts/integration-capability-representative-live.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRY_PROMPT_ZH } from './lib/capabilityTryPrompts.mjs';
import {
  connectGateway,
  newSession,
  submitTurn,
  closeGateway,
  readGatewayToken,
} from './lib/gatewaySessionHarness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'full-test');
const OUT_FILE = path.join(OUT_DIR, 'capability-live-matrix.json');

const SUFFIX = '直接开始做，做完告诉我文件路径。';
const TIMEOUT_MS = Number(process.env.CAP_LIVE_TIMEOUT_MS || 300_000);
const LIMIT = Number(process.env.CAP_LIVE_LIMIT || 0);
const DRY = process.env.CAP_LIVE_DRY === '1' || process.argv.includes('--dry');

/** Plan appendix: per-pill / spot-check representatives */
const REPRESENTATIVE_MATRIX = [
  { pill: 'user_market', slug: 'mkt-customer-research', category: 'marketing' },
  { pill: 'market_landscape', slug: 'df-deep-research', category: 'marketing' },
  { pill: 'competitive_intel', slug: 'geo-competitor-analysis', category: 'marketing' },
  { pill: 'brand_sentiment', slug: 'mkt-competitor-profiling', category: 'marketing' },
  { pill: 'ai_search_research', slug: 'pd-geo', category: 'marketing' },
  { pill: 'web_fetch', slug: 'tool-web-search', category: 'marketing' },
  { pill: 'plan_direction', slug: 'mkt-annual-plan', category: 'marketing' },
  { pill: 'campaign_full', slug: 'mkt-campaign-brief', category: 'marketing' },
  { pill: 'brand_geo', slug: 'geo-brand-positioning', category: 'marketing' },
  { pill: 'copy', slug: 'ala-editor', category: 'marketing' },
  { pill: 'ad_visual', slug: 'od-image-gen', category: 'marketing' },
  { pill: 'web_page', slug: 'od-pricing-page', category: 'marketing' },
  { pill: 'social', slug: 'social-creative-matrix', category: 'marketing' },
  { pill: 'video', slug: 'hf-website-to-video', category: 'marketing' },
  { pill: 'deck_report', slug: 'create-nanobanana-ppt', category: 'marketing' },
  { pill: 'cn_social', slug: 'yixiaoer', category: 'marketing' },
  { pill: 'seo_visibility', slug: 'geo-citability', category: 'marketing' },
  { pill: 'office_docs', slug: 'anth-docx', category: 'office' },
  { pill: 'office_slides', slug: 'nova-ppt-aesthetic-slides', category: 'office' },
  { pill: 'office_sheets', slug: 'office-ecom', category: 'office' },
  { pill: 'office_collab', slug: 'ala-meeting-notes', category: 'office' },
  { pill: 'creation_image', slug: 'od-image-gen', category: 'creation' },
  { pill: 'creation_video', slug: 'hf-website-to-video', category: 'creation' },
  { pill: 'creation_writing', slug: 'humanizer', category: 'creation' },
  { pill: 'dev_code', slug: 'ala-code-reviewer', category: 'development' },
  { pill: 'dev_fullstack', slug: 'ala-fullstack-developer', category: 'development' },
  { pill: 'dev_python', slug: 'ala-python-expert', category: 'development' },
  { pill: 'brainstorm', slug: 'brainstorm-structured', category: 'brainstorming' },
  { pill: 'persona', slug: 'persona-buffett', category: 'brainstorming' },
  { pill: 'edu_tutor', slug: 'edu-tutor-skills', category: 'education' },
  { pill: 'edu_research', slug: 'karpathy-guidelines', category: 'education' },
  { pill: 'hub_pack_brand', slug: 'hub-pack-brand-website', category: 'marketing' },
  { pill: 'hub_pack_pm', slug: 'hub-pack-pm-toolkit', category: 'marketing' },
  { pill: 'mcp_firecrawl', slug: 'mcp-firecrawl', category: 'marketing' },
  { pill: 'od_mobile', slug: 'od-mobile-app', category: 'creation' },
  { pill: 'video_db', slug: 'video-db-python', category: 'development' },
  { pill: 'hub_pack_aso', slug: 'hub-pack-aso', category: 'marketing' },
  { pill: 'nova_research', slug: 'nova-research-general', category: 'marketing' },
  { pill: 'geo_keyword', slug: 'geo-keyword-research', category: 'marketing' },
  { pill: 'mkt_review', slug: 'mkt-review-mining', category: 'marketing' },
];

function loadCatalogSlugs() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const items = catalog.skills ?? catalog.capabilities ?? catalog.items ?? [];
  const visible = new Set(
    items
      .filter((c) => !c.hidden_in_hub)
      .map((c) => c.slug || c.id)
      .filter(Boolean),
  );
  return visible;
}

function buildPrompt(slug) {
  const base = TRY_PROMPT_ZH[slug];
  if (!base) return `用「${slug}」完成一项最小演示任务，产出存 artifacts/。${SUFFIX}`;
  return `${base} ${SUFFIX}`;
}

function classifyResult(row) {
  if (row.skipReason) return 'SKIP';
  if (row.timeout) return 'TIMEOUT';
  if (row.ok) return 'PASS';
  if (/api.?key|401|403|credential|missing.*key/i.test(row.detail || '')) return 'SKIP-KEY';
  return 'FAIL';
}

async function runOne(ws, sessionKey, entry) {
  const { slug, pill } = entry;
  const prompt = buildPrompt(slug);
  if (DRY) {
    return {
      slug,
      pill,
      prompt,
      status: 'DRY',
      ok: true,
      skipReason: 'CAP_LIVE_DRY',
    };
  }
  try {
    readGatewayToken();
  } catch (e) {
    return {
      slug,
      pill,
      status: 'SKIP',
      ok: false,
      skipReason: 'NO_GATEWAY_TOKEN',
      detail: String(e.message || e),
    };
  }

  const result = await submitTurn(ws, {
    sessionKey,
    projectKey: 'general',
    message: prompt,
    tag: `cap-${slug}`,
    timeoutMs: TIMEOUT_MS,
    maxTurns: 6,
  });

  const detail = result.error || (result.timeout ? 'timeout' : '');
  const skipKey = /api.?key|401|403|credential|imagen|google.*key/i.test(detail);
  return {
    slug,
    pill,
    status: classifyResult({ ...result, ok: result.ok && !result.recoveryExhausted, detail, skipReason: skipKey ? 'SKIP-KEY' : undefined }),
    ok: result.ok && !result.recoveryExhausted,
    timeout: result.timeout,
    durationMs: result.durationMs,
    recoveryAttempts: result.recoveryAttempts,
    recoveryExhausted: result.recoveryExhausted,
    toolCalls: result.toolCalls,
    skipReason: skipKey ? 'SKIP-KEY' : undefined,
    detail,
  };
}

async function main() {
  const visible = loadCatalogSlugs();
  let matrix = REPRESENTATIVE_MATRIX.filter((e) => visible.has(e.slug) || TRY_PROMPT_ZH[e.slug]);
  const seen = new Set();
  matrix = matrix.filter((e) => {
    if (seen.has(e.slug)) return false;
    seen.add(e.slug);
    return true;
  });
  if (LIMIT > 0) matrix = matrix.slice(0, LIMIT);

  console.log(`[cap-live] ${matrix.length} representatives (timeout=${TIMEOUT_MS}ms dry=${DRY})`);

  const results = [];
  let ws = null;
  let sessionKey = null;

  if (!DRY) {
    try {
      ws = await connectGateway();
      sessionKey = await newSession(ws, 'general');
    } catch (e) {
      for (const entry of matrix) {
        results.push({
          slug: entry.slug,
          pill: entry.pill,
          status: 'SKIP',
          ok: false,
          skipReason: 'GATEWAY_DOWN',
          detail: String(e.message || e),
        });
      }
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const summary = summarize(results, matrix.length);
      fs.writeFileSync(OUT_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
      console.log(`[cap-live] gateway unavailable → ${OUT_FILE}`);
      process.exit(0);
    }
  }

  for (const entry of matrix) {
    console.log(`\n[cap-live] → ${entry.slug} (${entry.pill})`);
    const row = await runOne(ws, sessionKey, entry);
    results.push(row);
    console.log(`[cap-live] ${row.status} ${entry.slug} ${row.durationMs ? `${row.durationMs}ms` : ''}`);
  }

  if (ws) closeGateway(ws);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const summary = summarize(results, matrix.length);
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`\n[cap-live] ${summary.passRate}% pass (excl skip) → ${OUT_FILE}`);

  const scored = results.filter((r) => r.status !== 'SKIP' && r.status !== 'SKIP-KEY' && r.status !== 'DRY');
  const passRate = scored.length ? (scored.filter((r) => r.ok).length / scored.length) * 100 : 100;
  if (passRate < 90 && scored.length >= 3) process.exit(1);
}

function summarize(results, total) {
  const pass = results.filter((r) => r.status === 'PASS' || (r.ok && r.status === 'DRY')).length;
  const fail = results.filter((r) => r.status === 'FAIL' || r.status === 'TIMEOUT').length;
  const skip = results.filter((r) => r.status === 'SKIP' || r.status === 'SKIP-KEY' || r.skipReason).length;
  const scored = results.filter((r) => !r.skipReason && r.status !== 'SKIP' && r.status !== 'SKIP-KEY' && r.status !== 'DRY');
  const passRate = scored.length ? Math.round((scored.filter((r) => r.ok).length / scored.length) * 100) : 100;
  return {
    capturedAt: new Date().toISOString(),
    total,
    pass,
    fail,
    skip,
    passRate,
    representatives: REPRESENTATIVE_MATRIX,
    results,
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
