#!/usr/bin/env node
/**
 * Publish all passed/passed_soft Wave-B cards (marketing/copy/PR/GEO/fullcase/compliance).
 * Skips failed cards. Syncs overlay + deploy/marketing/showcase; regenerates catalog.
 * Fullcase/compliance → left-rail viewer shells. PD-SAAS-FORK
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BRIDGE = process.env.SERVER_URL || 'http://127.0.0.1:7990';
const WORKSPACE =
  process.env.SHOWCASE_WORKSPACE_CWD ||
  path.join(
    root,
    '.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/9a498782-6cab-4ca0-b3c7-796926e9af34',
  );
const OVERLAY = path.join(root, '.saas-dev-data/marketing-showcase');
const DEPLOY = path.join(root, 'deploy/marketing/showcase');
const PROGRESS = path.join(root, 'artifacts/Showcase-Batch-20260803/progress.jsonl');
const REC = path.join(root, 'docs/showcase-card-recommendation-20260803.json');

const SECTIONS = ['marketing', 'copy', 'office', 'geo', 'fullcase', 'compliance'];
const SKIP = new Set(['sc-geo-competitor', 'sc-geo-optimize', 'sc-pr-cyber-deck']);

async function login() {
  const res = await fetch(`${BRIDGE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  const data = await res.json();
  if (!data.token) throw new Error('login_no_token');
  return data.token;
}

async function api(token, method, urlPath, body) {
  const res = await fetch(`${BRIDGE}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${urlPath} => ${res.status} ${text.slice(0, 300)}`);
  return data;
}

function loadLatestOk() {
  const lines = fs.readFileSync(PROGRESS, 'utf8').split('\n').filter(Boolean);
  /** @type {Map<string, Record<string, unknown>>} */
  const latest = new Map();
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (!row?.id || row.status === 'running') continue;
      latest.set(String(row.id), row);
    } catch {
      // skip
    }
  }
  return [...latest.values()].filter(
    (r) =>
      SECTIONS.includes(String(r.section_id)) &&
      (r.status === 'passed' || r.status === 'passed_soft') &&
      !SKIP.has(String(r.id)) &&
      r.taskDir &&
      fs.existsSync(String(r.taskDir)),
  );
}

function listFilesRecursive(dir, base = dir) {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFilesRecursive(abs, base));
    else out.push(path.relative(base, abs).replace(/\\/g, '/'));
  }
  return out;
}

function copyTree(taskAbs, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const files = listFilesRecursive(taskAbs);
  const copied = [];
  for (const rel of files) {
    if (/\.(jsonl|log)$/i.test(rel)) continue;
    const src = path.join(taskAbs, rel);
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(src, to);
    copied.push(rel);
  }
  return copied;
}

function pickPrimary(taskAbs, meta) {
  const must = Array.isArray(meta?.must_deliver) ? meta.must_deliver.map(String) : [];
  const primary = String(meta?.primary_deliverable || must[0] || '');
  const files = listFilesRecursive(taskAbs);
  const lower = new Map(files.map((f) => [f.toLowerCase(), f]));
  const tryNames = [
    primary,
    ...must,
    'index.html',
    'plan.html',
    'report.html',
    'campaign-plan.html',
    'preview.html',
  ].filter(Boolean);
  for (const n of tryNames) {
    const base = n.replace(/\\/g, '/').split('/').pop();
    if (!base) continue;
    if (lower.has(base.toLowerCase())) return lower.get(base.toLowerCase());
    const hit = files.find((f) => f.toLowerCase().endsWith('/' + base.toLowerCase()));
    if (hit) return hit;
  }
  return (
    files.find((f) => /\.html?$/i.test(f)) ||
    files.find((f) => /\.md$/i.test(f)) ||
    files.find((f) => /\.pptx$/i.test(f)) ||
    files[0]
  );
}

function writeMdShell(destDir, mdRel, title) {
  const shell = 'preview.html';
  const html = `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;font-family:"Noto Sans SC","PingFang SC",sans-serif;background:#111;color:#e8e6e1}
.wrap{max-width:820px;margin:0 auto;padding:48px 28px 80px}
h1{font-size:22px;letter-spacing:2px;margin:0 0 24px;font-weight:600}
pre{white-space:pre-wrap;line-height:1.75;font-size:14.5px;background:#1a1a1a;padding:28px;border-radius:12px;border:1px solid #2a2a2a}
a{color:#9ab59a}
</style></head><body><div class="wrap">
<h1>${escapeHtml(title)}</h1>
<pre id="c">加载中…</pre>
<p><a href="${mdRel}">打开原稿 Markdown</a></p>
</div>
<script>
fetch(${JSON.stringify(mdRel)}).then(r=>r.text()).then(t=>{document.getElementById('c').textContent=t}).catch(()=>{document.getElementById('c').textContent='无法加载文稿'});
</script></body></html>`;
  fs.writeFileSync(path.join(destDir, shell), html, 'utf8');
  return shell;
}

function writePptxShell(destDir, pptxRel, title) {
  const shell = 'preview.html';
  const html = `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(900px 500px at 20% 0%,#1c2420,#0d0d0d 60%);color:#e8e6e1;font-family:"Noto Sans SC",sans-serif}
.card{width:min(520px,90vw);padding:40px;border:1px solid #2a322c;border-radius:16px;background:#141816}
h1{font-size:22px;margin:0 0 12px;letter-spacing:2px}
p{color:#9aa39a;line-height:1.6}
a{display:inline-block;margin-top:22px;padding:12px 20px;border-radius:999px;background:#5c6b57;color:#faf8f3;text-decoration:none;letter-spacing:1px}
</style></head><body><div class="card">
<h1>${escapeHtml(title)}</h1>
<p>本案例主成果为可下载的 PowerPoint（.pptx）。点击下方按钮获取原稿。</p>
<a href="${pptxRel}" download>下载 presentation.pptx</a>
</div></body></html>`;
  fs.writeFileSync(path.join(destDir, shell), html, 'utf8');
  return shell;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildViewerCase(id, meta, files, mediaPrefix) {
  const kindOf = (f) => {
    if (/\.html?$/i.test(f)) return 'html';
    if (/\.md$/i.test(f)) return 'md';
    if (/\.(png|jpe?g|webp|gif)$/i.test(f)) return 'img';
    if (/\.mp4$/i.test(f)) return 'video';
    if (/\.pptx$/i.test(f)) return 'html';
    return 'md';
  };
  const usable = files.filter((f) => /\.(html?|md|png|jpe?g|webp|gif|mp4|pptx)$/i.test(f));
  const defaultPath =
    usable.find((f) => /\.html?$/i.test(f)) ||
    usable.find((f) => /\.md$/i.test(f)) ||
    usable[0] ||
    'README.md';
  return {
    id,
    title: meta.name_zh || id,
    templateName: meta.binding_label_zh || meta.hub_binding || '',
    templateHint: '流程模板 / 能力',
    tagline: meta.annotation_zh || '',
    prompt: meta.prompt_zh || '',
    rootLabel: `artifacts/${id}`,
    defaultPath,
    files: usable.map((f) => ({
      path: f,
      label: f.split('/').pop(),
      kind: kindOf(f),
      src: `${mediaPrefix}/${f}`,
    })),
  };
}

function writeViewerShell(deployRoot, caseId, title) {
  const file = `viewer-${caseId}.html`;
  const html = `<!DOCTYPE html>
<html lang="zh-CN" class="fc-html">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0a0a0a" />
  <title>${escapeHtml(title)} · Nova Studio N2</title>
  <link rel="icon" href="/showcase/assets/nova-logo-mark.png" />
  <link rel="stylesheet" href="/shared/tokens.css?v=17" />
  <link rel="stylesheet" href="shared/fullcase.css?v=16" />
  <script>window.FC_CASE = ${JSON.stringify(caseId)};</script>
</head>
<body class="fc-body">
  <div class="fc-shell">
    <header class="fc-top">
      <a class="fc-back" href="/showcase/" id="fc-back">← 返回</a>
      <div class="fc-top__main">
        <h1 class="fc-title"><span class="fc-star" aria-hidden="true">*</span><span id="fc-title"></span></h1>
        <span class="fc-template__hint">能力 / 模板</span>
        <span class="fc-template-name" id="fc-template"></span>
      </div>
      <button type="button" class="fc-copy" id="fc-copy">复制提示词</button>
    </header>
    <details class="fc-prompt-bar" id="fc-prompt-bar">
      <summary>
        <span class="fc-prompt-label">生成提示词</span>
        <span class="fc-prompt-preview" id="fc-prompt-preview"></span>
        <span class="fc-prompt-chevron" aria-hidden="true">&gt;</span>
      </summary>
      <p class="fc-prompt-full" id="fc-prompt"></p>
    </details>
    <div class="fc-main">
      <aside class="fc-tree" aria-label="成果文件">
        <div class="fc-tree__head">成果文件</div>
        <ul class="fc-tree__list" id="fc-tree"></ul>
      </aside>
      <section class="fc-preview" aria-label="预览">
        <div class="fc-preview__bar"><span class="fc-preview__path" id="fc-path">选择左侧文件</span></div>
        <div class="fc-preview__stage" id="fc-stage">
          <div class="fc-empty" id="fc-empty">从左侧选择文件预览</div>
          <div class="fc-error fc-hidden" id="fc-error">无法加载此文件</div>
          <div class="fc-frame-host fc-hidden" id="fc-frame-host"><iframe class="fc-frame" id="fc-frame" title="Preview"></iframe></div>
          <article class="fc-md fc-hidden" id="fc-md"></article>
          <div class="fc-img-wrap fc-hidden" id="fc-img-wrap"><img id="fc-img" alt="" /></div>
          <div class="fc-video-wrap fc-hidden" id="fc-video-wrap"><video id="fc-video" controls playsinline></video></div>
        </div>
      </section>
    </div>
  </div>
  <script src="shared/fullcases.js?v=20"></script>
  <script src="shared/fullcase-viewer.js?v=16"></script>
</body>
</html>`;
  fs.writeFileSync(path.join(deployRoot, file), html, 'utf8');
  fs.writeFileSync(path.join(OVERLAY, file), html, 'utf8');
  return file;
}

function mergeFullcasesJs(cases) {
  const existingPath = path.join(DEPLOY, 'shared/fullcases.js');
  let existing = {};
  if (fs.existsSync(existingPath)) {
    const code = fs.readFileSync(existingPath, 'utf8');
    const m = code.match(/window\.NOVA_FULLCASES\s*=\s*(\{[\s\S]*\});?\s*$/);
    if (m) {
      try {
        // eslint-disable-next-line no-new-func
        existing = Function(`return (${m[1]})`)();
      } catch {
        existing = {};
      }
    }
  }
  const merged = { ...existing };
  for (const c of cases) merged[c.id] = c;
  const body =
    '/**\n * 全案 / 合规 左右栏目录（自动合并更新）\n */\n' +
    'window.NOVA_FULLCASES = ' +
    JSON.stringify(merged, null, 2) +
    ';\n';
  fs.mkdirSync(path.join(DEPLOY, 'shared'), { recursive: true });
  fs.mkdirSync(path.join(OVERLAY, 'shared'), { recursive: true });
  fs.writeFileSync(path.join(DEPLOY, 'shared/fullcases.js'), body, 'utf8');
  fs.writeFileSync(path.join(OVERLAY, 'shared/fullcases.js'), body, 'utf8');
}

async function shotThumb(browser, hrefAbsFile, outPng) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
  try {
    await page.goto('file://' + hrefAbsFile.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: outPng, type: 'png' });
    return true;
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

function resolveThumb(dest, preferredNames) {
  const names = fs.readdirSync(dest);
  for (const p of preferredNames) {
    if (names.includes(p)) return p;
  }
  return (
    names.find((n) => /thumb|preview|hero|cover/i.test(n) && /\.(png|jpe?g|webp)$/i.test(n)) ||
    names.find((n) => /\.(png|jpe?g|webp)$/i.test(n)) ||
    null
  );
}

async function main() {
  const token = await login();
  const rec = JSON.parse(fs.readFileSync(REC, 'utf8'));
  const byId = Object.fromEntries((rec.cards || []).map((c) => [c.id, c]));
  const rows = loadLatestOk();
  console.log(`publish queue=${rows.length} skip=${[...SKIP].join(',')}`);

  // Rename office section → 公关 in live DB
  try {
    await api(token, 'PUT', '/api/saas/admin/showcase/sections/office', {
      title_zh: '公关',
      title_en: 'PR & Comms',
      lead_zh: '危机、媒体日、Pitch 与公关战略——专业传播交付',
      lead_en: 'Crisis, media day, pitch, and PR strategy — professional comms',
    });
    console.log('section office → 公关');
  } catch (e) {
    console.warn('section update:', e.message);
  }

  const browser = await chromium.launch({ headless: true });
  /** @type {Array<Record<string, unknown>>} */
  const viewerCases = [];
  const published = [];

  try {
    for (const row of rows.sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      const id = String(row.id);
      const meta = byId[id] || {};
      const taskAbs = String(row.taskDir);
      const sectionId = String(row.section_id);
      console.log(`\n== ${id} (${sectionId}) ==`);

      const destOverlay = path.join(OVERLAY, 'media', id);
      const destDeploy = path.join(DEPLOY, 'media', id);
      const copied = copyTree(taskAbs, destOverlay);
      copyTree(taskAbs, destDeploy);
      console.log(`  copied=${copied.length}`);

      let primary = pickPrimary(taskAbs, meta);
      const isRail = sectionId === 'fullcase' || sectionId === 'compliance';
      let href;

      if (isRail) {
        const vc = buildViewerCase(id, meta, copied, `/showcase/media/${id}`);
        viewerCases.push(vc);
        const shell = writeViewerShell(DEPLOY, id, meta.name_zh || id);
        href = `/showcase/${shell}`;
      } else {
        const sourcePrimary = primary;
        const ext = path.extname(sourcePrimary || '').toLowerCase();
        if (ext === '.md') {
          writeMdShell(destOverlay, sourcePrimary, meta.name_zh || id);
          writeMdShell(destDeploy, sourcePrimary, meta.name_zh || id);
          primary = 'preview.html';
        } else if (ext === '.pptx' || ext === '.xlsx') {
          const shellHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><title>${escapeHtml(meta.name_zh || id)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#eee;font-family:"Noto Sans SC",sans-serif}
a{display:inline-block;margin-top:18px;padding:12px 20px;border-radius:999px;background:#5c6b57;color:#faf8f3;text-decoration:none}</style></head>
<body><div style="text-align:center;padding:40px"><h1>${escapeHtml(meta.name_zh || id)}</h1>
<p style="color:#9aa39a">点击下载主成果文件</p>
<a href="${sourcePrimary}" download>下载 ${sourcePrimary}</a></div></body></html>`;
          fs.writeFileSync(path.join(destOverlay, 'preview.html'), shellHtml, 'utf8');
          fs.writeFileSync(path.join(destDeploy, 'preview.html'), shellHtml, 'utf8');
          primary = 'preview.html';
        }
        href = `/showcase/media/${id}/${primary}`;
      }

      // thumb
      let thumbFile = resolveThumb(destDeploy, [
        'thumb-cover.png',
        'thumb-3x4.jpg',
        'preview.png',
        'plan-preview.png',
        'hero.png',
      ]);
      if (!thumbFile && /\.html?$/i.test(primary) && !isRail) {
        const absHtml = path.join(destDeploy, primary);
        const out = path.join(destDeploy, 'thumb-cover.png');
        const ok = await shotThumb(browser, absHtml, out);
        if (ok) {
          fs.copyFileSync(out, path.join(destOverlay, 'thumb-cover.png'));
          thumbFile = 'thumb-cover.png';
        }
      }
      if (!thumbFile) {
        // tiny placeholder
        thumbFile = 'thumb-cover.png';
        // skip binary write — use existing from overlay if any
      }
      const thumb = thumbFile
        ? `/showcase/media/${id}/${thumbFile}`
        : '/showcase/assets/nova-logo-mark.png';

      await api(token, 'POST', '/api/saas/admin/showcase/items/import', {
        id,
        sectionId,
        name_zh: meta.name_zh || id,
        name_en: meta.name_en || id,
        annotation_zh: meta.annotation_zh || '',
        annotation_en: meta.annotation_en || '',
        badge_zh: meta.badge_zh || '',
        badge_en: meta.badge_en || '',
        prompt_zh: meta.prompt_zh || '',
        prompt_en: meta.prompt_en || '',
        href,
        thumb,
        source_artifact_paths: [],
        sort_order: Number(meta.sort_order) || 50,
        star: meta.star ? 1 : 0,
      });
      const pub = await api(token, 'POST', `/api/saas/admin/showcase/items/${id}/publish`, {});
      console.log(`  published ${pub.item?.href || href}`);
      published.push(id);
    }
  } finally {
    await browser.close();
  }

  if (viewerCases.length) {
    mergeFullcasesJs(viewerCases);
    console.log(`fullcases.js cases+=${viewerCases.length}`);
  }

  // Patch site.js isFullcase for viewer shells
  const siteJs = path.join(DEPLOY, 'shared/site.js');
  if (fs.existsSync(siteJs)) {
    let code = fs.readFileSync(siteJs, 'utf8');
    const next =
      "function isFullcase(href) {\n    return /fullcase-|viewer-sc-(fullcase|compliance)-/i.test(href) || /viewer-sc-/i.test(href);\n  }";
    if (code.includes('function isFullcase')) {
      code = code.replace(/function isFullcase\(href\)\s*\{[\s\S]*?\n  \}/, next);
      fs.writeFileSync(siteJs, code, 'utf8');
      fs.copyFileSync(siteJs, path.join(OVERLAY, 'shared/site.js'));
      console.log('patched site.js isFullcase');
    }
  }

  const overlayCatalog = path.join(OVERLAY, 'shared/catalog.js');
  const deployCatalog = path.join(DEPLOY, 'shared/catalog.js');
  if (fs.existsSync(overlayCatalog)) {
    fs.copyFileSync(overlayCatalog, deployCatalog);
    console.log('synced catalog.js → deploy');
  } else {
    console.warn('overlay catalog.js missing — publish should have regenerated it');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        published: published.length,
        ids: published,
        skipped: [...SKIP],
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
