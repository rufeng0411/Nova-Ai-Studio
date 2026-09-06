#!/usr/bin/env node
/**
 * Publish the six design showcase cases to admin + front-visible catalog.
 * Shadow mode: also sync media/catalog into deploy/marketing/showcase so /showcase/ shows them.
 * PD-SAAS-FORK
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BRIDGE = process.env.SERVER_URL || 'http://127.0.0.1:7990';
const WORKSPACE =
  process.env.SHOWCASE_WORKSPACE_CWD ||
  path.join(
    root,
    '.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/9a498782-6cab-4ca0-b3c7-796926e9af34',
  );
const OVERLAY = path.join(root, '.saas-dev-data/marketing-showcase');
const DEPLOY_SHOWCASE = path.join(root, 'deploy/marketing/showcase');

/** Old ids to archive when replaced */
const ARCHIVE_IDS = ['sc-design-mobile-ui-suite', 'sc-design-zhiye-outdoor'];

const CARDS = [
  {
    id: 'sc-design-jurassic-shop',
    sort_order: 10,
    name_zh: '侏罗纪岛',
    name_en: 'Jurassic Island',
    annotation_zh: '泡泡玛特风潮玩电商：Q 版侏罗纪动物人偶 + AI 生图。',
    annotation_en: 'Pop Mart–style collectible shop with Q Jurassic dolls + AI art.',
    badge_zh: '电商 · HTML+图',
    badge_en: 'Shop · HTML+PNG',
    taskDir: 'artifacts/task-20260803-a86a8b88',
    primary: 'index.html',
    thumbFile: 'hero.png',
    files: ['index.html', 'hero.png', 'dino-01.png', 'dino-02.png', 'dino-03.png', 'dino-04.png'],
  },
  {
    id: 'sc-design-lanxi-site',
    sort_order: 20,
    name_zh: '澜析 LANXI',
    name_en: 'LANXI',
    annotation_zh: '协作分析 SaaS 杂志风官网：定价、产品叙事与分层信息架构。',
    annotation_en: 'Magazine-style SaaS product/pricing website for LANXI.',
    badge_zh: '网站 · HTML',
    badge_en: 'Site · HTML',
    taskDir: 'artifacts/task-20260803-684507f7',
    primary: 'index.html',
    thumbFile: 'preview-check.png',
    files: ['index.html', 'img-hero.png', 'img-insight.png', 'preview-check.png'],
  },
  {
    id: 'sc-design-soccer-app-ui',
    sort_order: 30,
    name_zh: '绿茵场',
    name_en: 'PitchLens',
    annotation_zh: '足球数据分析五屏：赛程 / 比赛中心 / 阵容 / 球员 / 积分榜（深浅色可切换）。',
    annotation_en: 'Football analytics five screens with dark/light theme toggle.',
    badge_zh: 'App UI · HTML',
    badge_en: 'App UI · HTML',
    taskDir: 'artifacts/task-20260803-d6c16c17',
    primary: 'index.html',
    thumbFile: 'thumb-cover.png',
    files: [
      'index.html',
      'screen-1.html',
      'screen-2.html',
      'screen-3.html',
      'screen-4.html',
      'screen-5.html',
      'thumb-cover.png',
    ],
  },
  {
    id: 'sc-design-industrial-set',
    sort_order: 40,
    name_zh: '衡造 Lumen One',
    name_en: 'Hengzao Lumen One',
    annotation_zh: '台式氛围灯专业工业设计渲染组图（英雄 / 三向 / 材质 / 正交）。',
    annotation_en: 'Industrial design renders for desk lamp Lumen One.',
    badge_zh: '工设 · PNG组',
    badge_en: 'ID · PNG set',
    taskDir: 'artifacts/task-20260803-90b55758',
    primary: 'index.html',
    thumbFile: '01-hero.png',
    files: [
      'index.html',
      '01-hero.png',
      '02-three-quarter.png',
      '03-material.png',
      '04-ortho.png',
    ],
  },
  {
    id: 'sc-design-kv-social',
    sort_order: 50,
    name_zh: '澄野 CHENGYE',
    name_en: 'CHENGYE',
    annotation_zh: '生活方式品牌春季主 KV + 四画幅社媒套装。',
    annotation_en: 'Lifestyle brand spring KV and four-ratio social set.',
    badge_zh: '平面 · PNG包',
    badge_en: 'Visuals · PNG pack',
    taskDir: 'artifacts/task-20260803-de7ebdff',
    primary: 'preview.html',
    thumbFile: 'kv-portrait.png',
    files: [
      'preview.html',
      'kv-portrait.html',
      'kv-portrait.png',
      'kv-base.png',
      'card-1x1.html',
      'card-1x1.png',
      'card-base-1x1.png',
      'card-16x9.html',
      'card-16x9.png',
      'card-9x16.html',
      'card-9x16.png',
    ],
  },
  {
    id: 'sc-design-zhiye-dash',
    sort_order: 60,
    name_zh: '织野.ZHÌYĚ · DTC 户外服饰',
    name_en: 'ZHÌYĚ DTC Outdoor',
    annotation_zh: '织野增长复盘 Dashboard：KPI、渠道、异常与下周动作一页纸。',
    annotation_en: 'ZHÌYĚ growth review dashboard one-pager.',
    badge_zh: 'Dashboard · HTML',
    badge_en: 'Dashboard · HTML',
    taskDir: 'artifacts/task-20260803-0d251d18',
    primary: 'index.html',
    thumbFile: 'preview.png',
    files: ['index.html', 'preview.png'],
  },
];

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
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} => ${res.status} ${text.slice(0, 240)}`);
  }
  return data;
}

function copyInto(destRoot, id, taskAbs, files) {
  const dest = path.join(destRoot, 'media', id);
  fs.mkdirSync(dest, { recursive: true });
  const copied = [];
  for (const f of files) {
    const src = path.join(taskAbs, f);
    if (!fs.existsSync(src)) {
      console.warn(`  miss ${f}`);
      continue;
    }
    fs.copyFileSync(src, path.join(dest, f));
    copied.push(f);
  }
  return { dest, copied };
}

function resolveThumbFile(taskAbs, preferred) {
  if (preferred && fs.existsSync(path.join(taskAbs, preferred))) return preferred;
  const names = fs.readdirSync(taskAbs);
  return (
    names.find((n) => /thumb-cover|preview|hero|01-hero|kv-portrait/i.test(n) && /\.(png|jpe?g|webp)$/i.test(n)) ||
    names.find((n) => /\.(png|jpe?g|webp)$/i.test(n)) ||
    preferred
  );
}

async function main() {
  const token = await login();
  console.log(await api(token, 'GET', '/api/saas/admin/showcase/flags'));

  for (const oldId of ARCHIVE_IDS) {
    try {
      await api(token, 'POST', `/api/saas/admin/showcase/items/${oldId}/unpublish`, {
        status: 'archived',
      });
      console.log(`archived ${oldId}`);
    } catch (e) {
      console.warn(`skip archive ${oldId}: ${e.message}`);
    }
  }

  const jsonPath = path.join(root, 'docs/showcase-card-recommendation-20260803.json');
  const cardsJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).cards;
  const byId = Object.fromEntries(cardsJson.map((c) => [c.id, c]));

  for (const card of CARDS) {
    const taskAbs = path.join(WORKSPACE, card.taskDir);
    if (!fs.existsSync(taskAbs)) throw new Error(`missing_task:${taskAbs}`);
    const thumbFile = resolveThumbFile(taskAbs, card.thumbFile);
    const files = [...new Set([...card.files, thumbFile].filter(Boolean))];
    console.log(`\n== ${card.id} ==`);
    const o = copyInto(OVERLAY, card.id, taskAbs, files);
    const d = copyInto(DEPLOY_SHOWCASE, card.id, taskAbs, files);
    console.log(`  overlay=${o.copied.length} deploy=${d.copied.length} thumb=${thumbFile}`);

    const meta = byId[card.id] || {};
    const href = `/showcase/media/${card.id}/${card.primary}`;
    const thumb = `/showcase/media/${card.id}/${thumbFile}`;

    await api(token, 'POST', '/api/saas/admin/showcase/items/import', {
      id: card.id,
      sectionId: 'design',
      name_zh: card.name_zh,
      name_en: card.name_en,
      annotation_zh: card.annotation_zh,
      annotation_en: card.annotation_en,
      badge_zh: card.badge_zh,
      badge_en: card.badge_en,
      prompt_zh: meta.prompt_zh || '',
      prompt_en: meta.prompt_en || '',
      href,
      thumb,
      source_artifact_paths: [],
      sort_order: card.sort_order,
      star: 0,
    });

    const pub = await api(token, 'POST', `/api/saas/admin/showcase/items/${card.id}/publish`, {});
    console.log(`  published href=${pub.item?.href}`);

    copyInto(OVERLAY, card.id, taskAbs, files);
    copyInto(DEPLOY_SHOWCASE, card.id, taskAbs, files);
  }

  const overlayCatalog = path.join(OVERLAY, 'shared/catalog.js');
  const deployCatalog = path.join(DEPLOY_SHOWCASE, 'shared/catalog.js');
  if (fs.existsSync(overlayCatalog)) {
    fs.mkdirSync(path.dirname(deployCatalog), { recursive: true });
    fs.copyFileSync(overlayCatalog, deployCatalog);
    console.log('\nsynced catalog.js → deploy/marketing/showcase/shared/');
  }

  const items = await api(token, 'GET', '/api/saas/admin/showcase/items?sectionId=design&status=published');
  console.log(
    '\nDONE',
    (items.items || [])
      .filter((i) => i.status === 'published')
      .map((i) => `${i.sort_order}:${i.id}:${i.name_zh}`)
      .join(' | '),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
