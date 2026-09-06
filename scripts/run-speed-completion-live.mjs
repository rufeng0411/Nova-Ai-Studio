#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 速度·完成度加固实机内容验收（Gateway + Bridge messages）。
 * 用法：SERVER_URL=http://127.0.0.1:7990 node scripts/run-speed-completion-live.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { bridgeCliSessionToCatalog } from './lib/bridgeCliSessionCatalog.mjs';
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
} from './lib/gatewaySessionHarness.mjs';
import {
  fetchSaasAuthToken,
  resolveGeneralWorkspaceCwd,
} from './lib/resolveGeneralWorkspaceCwd.mjs';
import { findTranscriptAbsPath } from './lib/threeCaseSpeedRcaJsonlKpi.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_URL = (process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'speed-completion-live-20260815');
const PROJECT_KEY = 'general';

const CASES = [
  {
    id: 'L2-CLARIFY',
    timeoutMs: 180_000,
    maxTurns: 2,
    message: '生成PPT',
    assert(ctx) {
      const text = String(ctx.turn?.assistantText ?? '');
      const asked = /补充主题|上传源文件|直接开始做|请补充|确认几个|关键信息|主题/u.test(text)
        || (ctx.turn?.toolCalls?.ask_user_question ?? 0) > 0;
      const wrotePptx = (ctx.turn?.toolWritePaths ?? []).some((p) => /\.pptx$/i.test(p));
      const filmTools = ['generate_video', 'render_html_video', 'render_hyperframes']
        .some((name) => (ctx.turn?.toolCalls?.[name] ?? 0) > 0);
      return {
        ok: asked && !wrotePptx && !filmTools,
        detail: { asked, wrotePptx, filmTools, textHead: text.slice(0, 240) },
      };
    },
  },
  {
    id: 'L2-SCRIPT',
    timeoutMs: 540_000,
    maxTurns: 8,
    message: [
      '写一个短视频口播脚本，主题：智能手表开箱 30 秒。',
      '须交付：脚本.md',
      '不要做成视频，不要 mp4，不要 HTML 录屏。',
      '直接开始做，写入系统分配任务目录。',
    ].join('\n'),
    assert(ctx) {
      const paths = collectPaths(ctx);
      const hasMd = paths.some((p) => /(?:^|\/)脚本\.md$/i.test(p) || /\.md$/i.test(p));
      const wroteExact = paths.some((p) => /(?:^|\/)脚本\.md$/i.test(p));
      const hasMp4 = paths.some((p) => /\.mp4$/i.test(p));
      const slots = ctx.manifest?.slots ?? [];
      const videoSlots = slots.filter((s) => s.kind === 'video' || /\.mp4$/i.test(String(s.pathHint ?? '')));
      const filmTools = ['generate_video', 'render_html_video', 'render_hyperframes']
        .some((name) => (ctx.turn?.toolCalls?.[name] ?? 0) > 0);
      const profileOk = !ctx.manifest?.profileId || ctx.manifest.profileId === 'script-md' || ctx.manifest.profileId === 'default';
      return {
        ok: wroteExact && hasMd && !hasMp4 && videoSlots.length === 0 && !filmTools && profileOk,
        detail: {
          hasMd,
          wroteExact,
          hasMp4,
          videoSlots: videoSlots.map((s) => s.id),
          filmTools,
          profileId: ctx.manifest?.profileId ?? null,
          paths,
        },
      };
    },
  },
  {
    id: 'L2-HTML',
    timeoutMs: 540_000,
    maxTurns: 8,
    message: [
      '写一份极简单页 HTML 简报，主题：北京早高峰通勤观察。',
      '须交付：report.html',
      '不要配图、不要调研包、不要 Word/PPT。',
      '直接开始做，写入系统分配任务目录。',
    ].join('\n'),
    assert(ctx) {
      const paths = collectPaths(ctx);
      const hasHtml = paths.some((p) => /report\.html$/i.test(p) || /\.html?$/i.test(p));
      const hasMp4 = paths.some((p) => /\.mp4$/i.test(p));
      const hintPolluted = (ctx.manifest?.slots ?? []).some((s) => /不要配图/i.test(String(s.pathHint ?? '')));
      const profileOk = ctx.manifest?.profileId === 'html' || ctx.manifest?.profileId === 'default';
      return {
        ok: hasHtml && !hasMp4 && !hintPolluted && profileOk,
        detail: {
          hasHtml,
          hasMp4,
          hintPolluted,
          profileOk,
          paths,
          profileId: ctx.manifest?.profileId ?? null,
        },
      };
    },
  },
  {
    id: 'L2-ATTACH',
    timeoutMs: 540_000,
    maxTurns: 8,
    message: [
      '根据附件生成一份 HTML 摘要，须交付：report.html，直接开始做。\n',
      '<attachment parsed path="brief.docx">\n',
      '季度经营摘要：营收同比增长 18%，毛利率 41%，重点推进华北渠道。\n',
      '须交付：01-sources.md\n',
      '</attachment>',
    ].join(''),
    assert(ctx) {
      const text = String(ctx.turn?.assistantText ?? '');
      const askedTopic = /请补充主题或上传源文件/u.test(text);
      const paths = collectPaths(ctx);
      const hasHtml = paths.some((p) => /\.html?$/i.test(p));
      const researchPack = paths.some((p) => /01-sources-and-synthesis|03-report-body/i.test(p));
      const slots = ctx.manifest?.slots ?? [];
      const researchSlots = slots.filter((s) => /01-sources-and-synthesis|03-report-body/i.test(String(s.pathHint ?? '')));
      const hintPolluted = slots.some((s) => /根据附件|须交付|直接开始做|\[L2-ATTACH\]|直接开\.html/i.test(String(s.pathHint ?? '')));
      const reportHintOk = slots.some((s) => /(?:^|\/)report\.html$/i.test(String(s.pathHint ?? '')));
      const profileOk = ctx.manifest?.profileId === 'html' || ctx.manifest?.profileId === 'default';
      return {
        ok: !askedTopic && hasHtml && !researchPack && researchSlots.length === 0 && !hintPolluted && reportHintOk && profileOk,
        detail: {
          askedTopic,
          hasHtml,
          researchPack,
          researchSlots: researchSlots.map((s) => s.pathHint),
          hintPolluted,
          reportHintOk,
          profileOk,
          profileId: ctx.manifest?.profileId ?? null,
          paths,
        },
      };
    },
  },
  {
    id: 'F3-E',
    timeoutMs: 540_000,
    maxTurns: 8,
    uploadDocx: true,
    message: [
      '根据附件生成一份 HTML 摘要。',
      '须交付：report.html',
      '不要调研包，不要 Word，不要 PPT。',
      '直接开始做，写入系统分配任务目录。',
    ].join('\n'),
    assert(ctx) {
      const paths = collectPaths(ctx);
      const hasHtml = paths.some((p) => /report\.html$/i.test(p) || /\.html?$/i.test(p));
      const researchPack = paths.some((p) => /01-sources-and-synthesis|03-report-body/i.test(p));
      const slots = ctx.manifest?.slots ?? [];
      const hintPolluted = slots.some((s) => /根据附件|须交付|直接开始做/i.test(String(s.pathHint ?? '')));
      const reportHintOk = slots.some((s) => /(?:^|\/)report\.html$/i.test(String(s.pathHint ?? '')));
      const profileOk = ctx.manifest?.profileId === 'html' || ctx.manifest?.profileId === 'default';
      const usedRealUpload = Boolean(ctx.uploadedFilePath);
      return {
        ok: usedRealUpload && hasHtml && !researchPack && !hintPolluted && reportHintOk && profileOk,
        detail: {
          usedRealUpload,
          uploadedFilePath: ctx.uploadedFilePath ?? null,
          hasHtml,
          researchPack,
          hintPolluted,
          reportHintOk,
          profileOk,
          profileId: ctx.manifest?.profileId ?? null,
          paths,
        },
      };
    },
  },
];

const CASE_FILTER = String(process.env.SPEED_LIVE_CASES ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

async function uploadRealDocx({ token, destDir }) {
  const source = path.join(REPO_ROOT, 'deploy', 'marketing', 'showcase', 'media', 'sc-fullcase-launch', 'press-release.docx');
  if (!fs.existsSync(source)) {
    throw new Error(`F3-E fixture missing: ${source}`);
  }
  const localCopy = path.join(destDir, 'brief.docx');
  fs.copyFileSync(source, localCopy);
  const form = new FormData();
  form.append('attachments', new Blob([fs.readFileSync(localCopy)]), 'brief.docx');
  const res = await fetch(`${SERVER_URL}/api/projects/${encodeURIComponent(PROJECT_KEY)}/upload-attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const json = await res.json().catch(() => ({}));
  const file = Array.isArray(json.files) ? json.files[0] : null;
  if (!res.ok || !file?.path) {
    throw new Error(`F3-E multipart upload failed: ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  }
  fs.writeFileSync(path.join(destDir, 'upload.json'), `${JSON.stringify({ status: res.status, file }, null, 2)}\n`);
  return {
    name: file.name || 'brief.docx',
    path: file.path,
    mimeType: file.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

function collectPaths(ctx) {
  const fromTurn = ctx.turn?.toolWritePaths ?? [];
  const fromMeta = (ctx.meta?.slotBindings ?? []).flatMap((b) => [b.resolvedPath, b.path].filter(Boolean));
  const fromCert = (ctx.meta?.acceptanceCertificate?.slots ?? []).flatMap((s) => [
    s.resolvedPath,
    ...(s.resolvedPaths ?? []),
  ].filter(Boolean));
  const fromManifest = (ctx.manifest?.slots ?? []).map((s) => s.resolvedPath).filter(Boolean);
  return [...new Set([...fromTurn, ...fromMeta, ...fromCert, ...fromManifest].map((p) => String(p).replace(/\\/g, '/')))];
}

async function apiJson(url, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60_000),
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text?.slice(0, 400) };
      }
      return { status: res.status, ok: res.ok, json };
    } catch (error) {
      lastError = error;
      await delay(1500 * attempt);
    }
  }
  throw lastError;
}

async function fetchMessages(token, sessionId) {
  const qs = new URLSearchParams({ projectName: PROJECT_KEY, limit: '200', direction: 'backward' });
  return apiJson(`${SERVER_URL}/api/sessions/${encodeURIComponent(sessionId)}/messages?${qs}`, { token });
}

function readEnvelopeFromJsonl(sessionId) {
  const transcriptPath = findTranscriptAbsPath(sessionId);
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { transcriptPath: transcriptPath ?? null, manifest: null, meta: null };
  }
  let manifest = null;
  let meta = null;
  for (const line of fs.readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.type === 'session_deliverable_manifest' && row.manifest) manifest = row.manifest;
      if (row.type === 'turn_acceptance_meta') meta = row;
    } catch {
      // skip malformed
    }
  }
  return { transcriptPath, manifest, meta };
}

async function waitEnvelope(token, sessionId, waitMs = 45_000) {
  const deadline = Date.now() + waitMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await fetchMessages(token, sessionId);
      if (last.json?.sessionDeliverableManifest || last.json?.latestTurnAcceptanceMeta) return last;
    } catch (error) {
      last = { status: 0, ok: false, json: { error: error instanceof Error ? error.message : String(error) } };
    }
    const fromDisk = readEnvelopeFromJsonl(sessionId);
    if (fromDisk.manifest || fromDisk.meta) {
      return {
        status: last?.status ?? 200,
        ok: true,
        json: {
          sessionDeliverableManifest: fromDisk.manifest,
          latestTurnAcceptanceMeta: fromDisk.meta,
          messages: last?.json?.messages ?? [],
          source: 'jsonl',
          transcriptPath: fromDisk.transcriptPath,
        },
      };
    }
    await delay(2000);
  }
  return last;
}

function extractUserCopy(messages = []) {
  return messages
    .filter((m) => m.role === 'assistant')
    .map((m) => {
      const c = m.content;
      if (typeof c === 'string') return c;
      if (!Array.isArray(c)) return '';
      return c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
    })
    .join('\n');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const token = await fetchSaasAuthToken(SERVER_URL);
  if (!token) {
    console.error('[speed-live] admin login failed');
    process.exit(1);
  }
  const workspaceCwd = await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL, token });
  if (!workspaceCwd) {
    console.error('[speed-live] general workspace cwd missing');
    process.exit(1);
  }

  const ws = await connectGateway({ clientName: 'speed-completion-live' });
  const rows = [];

  try {
    const selected = CASE_FILTER.length > 0
      ? CASES.filter((spec) => CASE_FILTER.includes(spec.id))
      : CASES;
    if (CASE_FILTER.length > 0 && selected.length === 0) {
      console.error(`[speed-live] no cases match SPEED_LIVE_CASES=${CASE_FILTER.join(',')}`);
      process.exit(1);
    }

    for (const spec of selected) {
      console.log(`[speed-live] ▶ ${spec.id}`);
      const caseDir = path.join(OUT_DIR, spec.id);
      fs.mkdirSync(caseDir, { recursive: true });
      let sessionKey;
      let turn;
      let uploadedFilePath;
      try {
        sessionKey = await newSession(ws, PROJECT_KEY);
        const uploaded = spec.uploadDocx
          ? await uploadRealDocx({ token, destDir: caseDir })
          : null;
        uploadedFilePath = uploaded?.path;
        turn = await submitTurn(ws, {
          sessionKey,
          projectKey: PROJECT_KEY,
          workspaceCwd,
          message: spec.message,
          tag: spec.id,
          skipMessageTag: true,
          timeoutMs: spec.timeoutMs,
          maxTurns: spec.maxTurns,
          ...(uploaded ? {
            attachments: [{
              type: 'file',
              name: uploaded.name,
              path: uploaded.path,
              mimeType: uploaded.mimeType,
            }],
          } : {}),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rows.push({ id: spec.id, ok: false, error: message });
        fs.writeFileSync(path.join(caseDir, 'error.json'), `${JSON.stringify({ error: message }, null, 2)}\n`);
        continue;
      }

      try {
        const bridged = await bridgeCliSessionToCatalog({ sessionKey, projectName: PROJECT_KEY }).catch(() => null);
        const sessionId = bridged?.sessionId ?? sessionKey;
        let envelope = null;
        try {
          envelope = await waitEnvelope(token, sessionId);
        } catch (error) {
          envelope = { status: 0, ok: false, json: { error: error instanceof Error ? error.message : String(error) } };
        }
        const fromDisk = readEnvelopeFromJsonl(sessionId);
        const manifest = envelope?.json?.sessionDeliverableManifest ?? fromDisk.manifest ?? null;
        const meta = envelope?.json?.latestTurnAcceptanceMeta ?? fromDisk.meta ?? null;
        if (!turn.assistantText) {
          turn.assistantText = extractUserCopy(envelope?.json?.messages ?? []);
        }
        const judged = spec.assert({ turn, manifest, meta, envelope, uploadedFilePath });
        const row = {
          id: spec.id,
          ok: Boolean(judged.ok),
          sessionId,
          durationMs: turn.durationMs,
          timeout: Boolean(turn.timeout),
          toolCalls: turn.toolCalls,
          toolWritePaths: turn.toolWritePaths,
          acceptanceStatus: meta?.acceptanceStatus ?? turn.acceptanceStatus,
          profileId: manifest?.profileId ?? null,
          slots: (manifest?.slots ?? []).map((s) => ({
            id: s.id,
            kind: s.kind,
            pathHint: s.pathHint,
            status: s.status,
          })),
          detail: judged.detail,
        };
        rows.push(row);
        fs.writeFileSync(path.join(caseDir, 'result.json'), `${JSON.stringify(row, null, 2)}\n`);
        console.log(`[speed-live] ${judged.ok ? 'PASS' : 'FAIL'} ${spec.id} ${turn.durationMs}ms profile=${row.profileId ?? '-'}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rows.push({ id: spec.id, ok: false, sessionId: sessionKey, error: message });
        fs.writeFileSync(path.join(caseDir, 'error.json'), `${JSON.stringify({ error: message }, null, 2)}\n`);
        console.log(`[speed-live] FAIL ${spec.id} envelope ${message}`);
      }
    }
  } finally {
    closeGateway(ws);
  }

  const summary = {
    startedAt: new Date().toISOString(),
    serverUrl: SERVER_URL,
    pass: rows.filter((r) => r.ok).length,
    total: rows.length,
    ok: rows.length > 0 && rows.every((r) => r.ok),
    rows,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`[speed-live] ${summary.pass}/${summary.total} PASS → ${path.relative(REPO_ROOT, OUT_DIR)}`);
  process.exit(summary.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
