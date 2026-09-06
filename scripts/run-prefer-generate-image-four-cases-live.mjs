#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Prefer-generate_image — 4-case Gateway live acceptance (strict PNG).
 *
 * A 创意海报：generate_image>=1 且盘内非空 PNG（非 preview 截图）
 * B 官图海报：generate_image=0；允许 VAP/fetch
 * C OKR：generate_image=0 + HTML
 * D 落地页：同 A
 *
 * Usage:
 *   node --import tsx scripts/run-prefer-generate-image-four-cases-live.mjs --gate
 * Env:
 *   SERVER_URL=http://127.0.0.1:7990
 *   PREFER_LIVE_TIMEOUT_MS=600000
 *   PREFER_LIVE_MAX_TURNS=10
 *   PREFER_STRICT_PNG=1  (default on)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
} from "./lib/gatewaySessionHarness.mjs";
import {
  fetchSaasAuthToken,
  resolveGeneralWorkspaceCwd,
} from "./lib/resolveGeneralWorkspaceCwd.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO, "artifacts", "prefer-generate-image");
const REPORT_PATH = path.join(OUT_DIR, "four-cases-live-report.json");
const gate = process.argv.includes("--gate");
const SERVER_URL = (process.env.SERVER_URL || "http://127.0.0.1:7990").replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.PREFER_LIVE_TIMEOUT_MS || 600_000);
const MAX_TURNS = Number(process.env.PREFER_LIVE_MAX_TURNS || 10);
const STRICT_PNG = process.env.PREFER_STRICT_PNG !== "0";
const MIN_PNG_BYTES = Number(process.env.PREFER_MIN_PNG_BYTES || 8_000);

function collectTaskDirs(workspaceCwd, writePaths) {
  const dirs = new Set();
  for (const p of writePaths || []) {
    const norm = String(p).replace(/\\/g, "/");
    const m = norm.match(/(artifacts\/task-[^/]+)/i);
    if (m) dirs.add(m[1]);
  }
  return [...dirs].map((rel) => ({
    rel,
    abs: workspaceCwd ? path.join(workspaceCwd, rel) : path.join(REPO, rel),
  }));
}

function listRealGeneratedPngs(workspaceCwd, writePaths) {
  const found = [];
  for (const { rel, abs } of collectTaskDirs(workspaceCwd, writePaths)) {
    if (!fs.existsSync(abs)) continue;
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(png|jpe?g|webp)$/i.test(ent.name)) continue;
        // HTML 截图预览不算谷歌生图成功
        if (/^preview\.png$/i.test(ent.name)) continue;
        if (/placeholder/i.test(ent.name)) continue;
        const st = fs.statSync(full);
        if (st.size < MIN_PNG_BYTES) continue;
        found.push({
          path: path.relative(workspaceCwd || REPO, full).replace(/\\/g, "/"),
          bytes: st.size,
          taskDir: rel,
        });
      }
    };
    walk(abs);
  }
  // Also check paths claimed by harness even if task dir parse missed
  for (const p of writePaths || []) {
    const norm = String(p).replace(/\\/g, "/");
    if (!/\.(png|jpe?g|webp)$/i.test(norm)) continue;
    if (/preview\.png$/i.test(norm) || /placeholder/i.test(norm)) continue;
    const abs = workspaceCwd
      ? path.join(workspaceCwd, norm)
      : path.isAbsolute(norm) ? norm : path.join(REPO, norm);
    if (!fs.existsSync(abs)) continue;
    const bytes = fs.statSync(abs).size;
    if (bytes < MIN_PNG_BYTES) continue;
    if (!found.some((f) => f.path === norm || f.path.endsWith(path.basename(norm)))) {
      found.push({ path: norm, bytes, taskDir: "(path)" });
    }
  }
  return found;
}

function htmlReferencesPng(workspaceCwd, writePaths, pngs) {
  const htmlPaths = (writePaths || []).filter((p) => /\.html?$/i.test(p));
  const names = new Set(pngs.map((p) => path.basename(p.path).toLowerCase()));
  for (const hp of htmlPaths) {
    const abs = workspaceCwd
      ? path.join(workspaceCwd, String(hp).replace(/\\/g, "/"))
      : path.join(REPO, String(hp).replace(/\\/g, "/"));
    if (!fs.existsSync(abs)) continue;
    const html = fs.readFileSync(abs, "utf8");
    for (const name of names) {
      if (html.toLowerCase().includes(name)) return true;
    }
    if (/<img[^>]+src=["'][^"']+\.(png|jpe?g|webp)/i.test(html)) return true;
  }
  return false;
}

function judgeCreativeGen(result, workspaceCwd) {
  const gen = Number(result.toolCalls?.generate_image || 0);
  const pngs = listRealGeneratedPngs(workspaceCwd, result.toolWritePaths);
  const referenced = htmlReferencesPng(workspaceCwd, result.toolWritePaths, pngs);
  const softPass = gen >= 1;
  const hardPass = softPass && pngs.length >= 1 && referenced;
  const pass = STRICT_PNG ? hardPass : softPass;
  return {
    pass,
    generate_image: gen,
    forbid_violation: 0,
    real_pngs: pngs,
    html_references_png: referenced,
    detail: pass
      ? `generate_image=${gen} pngs=${pngs.length} ref=${referenced} ${pngs.map((p) => `${p.path}(${p.bytes})`).join(",")}`
      : `FAIL gen=${gen} pngs=${pngs.length} ref=${referenced} strict=${STRICT_PNG}`,
  };
}

const CASES = [
  {
    id: "A",
    name: "poster_creative_generate_image",
    slug: "od-poster-hero",
    displayName: "宣传海报",
    goal: [
      "做一张竖版活动海报 HTML，主题「夏日新品发布会」，主视觉要有冲击力。",
      "直接开始做：必须先成功调用 generate_image，把真实 PNG 写到任务目录（如 hero.png / main-visual.png），",
      "确认文件已落盘且体积正常后，再 write_file index.html 用 <img src> 引用该 PNG。",
      "禁止纯 CSS/SVG 渐变冒充主视觉；生图失败须如实说明，勿假装完成。做完告诉我 PNG 与 HTML 路径。",
    ].join(""),
    judge: judgeCreativeGen,
  },
  {
    id: "B",
    name: "official_no_fake_generate_image",
    slug: "od-poster-hero",
    displayName: "宣传海报",
    goal: [
      "做一张产品海报 HTML，图和资料必须来自官网 https://www.apple.com/iphone/ ，禁止 AI 生图冒充官图。",
      "直接开始做：走官网取图/resolve_session_visual_assets，再写 HTML。",
      "写入系统分配任务目录；做完告诉我文件路径。",
    ].join(""),
    judge(result) {
      const gen = Number(result.toolCalls?.generate_image || 0);
      const vap = Number(result.toolCalls?.resolve_session_visual_assets || 0)
        + Number(result.toolCalls?.fetch_page_images || 0)
        + Number(result.toolCalls?.discover_visual_assets || 0)
        + Number(result.toolCalls?.web_fetch || 0);
      const forbid = gen > 0 ? 1 : 0;
      const pass = forbid === 0;
      return {
        pass,
        generate_image: gen,
        forbid_violation: forbid,
        vap_or_fetch: vap,
        detail: pass
          ? `forbid=0 generate_image=0 vap_or_fetch=${vap}`
          : `forbid_violation=${forbid} generate_image=${gen}`,
      };
    },
  },
  {
    id: "C",
    name: "okr_no_force_generate_image",
    slug: "od-team-okrs",
    displayName: "团队 OKR",
    goal: [
      "做一个团队 OKR 看板 HTML：3 个目标、每目标 2–3 个关键结果，简洁表格布局。",
      "直接开始做，纯排版即可，不要配图、不要 generate_image。",
      "写入系统分配任务目录；做完告诉我文件路径。",
    ].join(""),
    judge(result) {
      const gen = Number(result.toolCalls?.generate_image || 0);
      const wroteHtml = (result.toolWritePaths || []).some((p) => /\.html?$/i.test(p))
        || Number(result.toolCalls?.write_file || 0) >= 1;
      const pass = gen === 0 && (wroteHtml || result.ok === true);
      return {
        pass,
        generate_image: gen,
        forbid_violation: 0,
        detail: pass
          ? `generate_image=0 wrote=${wroteHtml}`
          : `generate_image=${gen} wrote=${wroteHtml}`,
      };
    },
  },
  {
    id: "D",
    name: "landing_hero_generate_image",
    slug: "od-saas-landing",
    displayName: "SaaS落地页",
    goal: [
      "做一个 SaaS 产品落地页 HTML，产品名 NovaFlow，一句话价值「团队协作更轻」。",
      "非官图：必须先成功 generate_image 出一张 Hero PNG 到任务目录，确认落盘后再写 index.html 用 <img> 引用。",
      "直接开始做；禁止纯 CSS/SVG 渐变冒充 Hero；生图失败须如实说明。做完告诉我 PNG 与 HTML 路径。",
    ].join(""),
    judge: judgeCreativeGen,
  },
];

async function runCase(ws, workspaceCwd, c) {
  const sessionKey = await newSession(ws, "general");
  console.log(`[prefer-4] ${c.id} start session=${sessionKey} slug=${c.slug}`);
  const result = await submitTurn(ws, {
    sessionKey,
    message: c.goal,
    projectKey: "general",
    workspaceCwd: workspaceCwd || "general",
    timeoutMs: TIMEOUT_MS,
    maxTurns: MAX_TURNS,
    tag: `prefer-${c.id.toLowerCase()}`,
    capabilityContext: {
      slug: c.slug,
      displayName: c.displayName,
      majorCategory: "creation",
    },
  });
  const judged = c.judge(result, workspaceCwd);
  const row = {
    id: c.id,
    name: c.name,
    slug: c.slug,
    sessionKey,
    ok: result.ok === true,
    timeout: Boolean(result.timeout),
    durationMs: result.durationMs,
    toolCalls: result.toolCalls || {},
    toolWritePaths: result.toolWritePaths || [],
    acceptanceStatus: result.acceptanceStatus,
    stopReason: result.stopReason,
    assistantPreview: String(result.assistantText || "").slice(0, 500),
    ...judged,
  };
  console.log(
    `[prefer-4] ${c.id} ${row.pass ? "PASS" : "FAIL"} ${row.detail} ` +
      `dur=${Math.round((row.durationMs || 0) / 1000)}s timeout=${row.timeout}`,
  );
  return row;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const token = await fetchSaasAuthToken(SERVER_URL);
  if (!token) {
    console.error(`[prefer-4] login failed at ${SERVER_URL}`);
    process.exit(1);
  }
  const workspaceCwd = await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL, token });
  console.log(
    `[prefer-4] server=${SERVER_URL} cwd=${workspaceCwd || "(none)"} ` +
      `timeout=${TIMEOUT_MS}ms strictPng=${STRICT_PNG}`,
  );

  const ws = await connectGateway({ clientName: "prefer-generate-image-4cases-strict" });
  const cases = [];
  try {
    for (const c of CASES) {
      cases.push(await runCase(ws, workspaceCwd, c));
    }
  } finally {
    closeGateway(ws);
  }

  const falseIncomplete = cases.filter((r) => r.timeout && !r.pass).length;
  const allPass = cases.every((r) => r.pass);
  const report = {
    capturedAt: new Date().toISOString(),
    serverUrl: SERVER_URL,
    workspaceCwd,
    timeoutMs: TIMEOUT_MS,
    maxTurns: MAX_TURNS,
    strictPng: STRICT_PNG,
    minPngBytes: MIN_PNG_BYTES,
    pass: allPass,
    false_incomplete: falseIncomplete,
    cases,
    kpi: {
      A_generate_image: cases.find((c) => c.id === "A")?.generate_image ?? null,
      A_real_pngs: cases.find((c) => c.id === "A")?.real_pngs ?? [],
      B_forbid_violation: cases.find((c) => c.id === "B")?.forbid_violation ?? null,
      C_generate_image: cases.find((c) => c.id === "C")?.generate_image ?? null,
      D_generate_image: cases.find((c) => c.id === "D")?.generate_image ?? null,
      D_real_pngs: cases.find((c) => c.id === "D")?.real_pngs ?? [],
    },
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[prefer-4] report → ${REPORT_PATH}`);
  console.log(`[prefer-4] ${allPass ? "ALL PASS" : "FAIL"} false_incomplete=${falseIncomplete}`);
  if (gate && !allPass) process.exit(1);
}

main().catch((err) => {
  console.error("[prefer-4] fatal", err);
  process.exit(1);
});
