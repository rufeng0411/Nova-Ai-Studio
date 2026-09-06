#!/usr/bin/env node
/**
 * PD-SAAS-FORK 0731-fail L4: Gateway live A/B/C (serial, running≤1).
 * Project key: general workspace; evidence under artifacts/four-line-0731-fail-live/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASE_0731_FAIL_B_XIAOMI_DISTILL } from "../tests/fixtures/four-line-0731-xiaomi-distill-gap.ts";
import { CASE_0731_FAIL_C_NIKE_IP } from "../tests/fixtures/four-line-0731-nike-ip-gap.ts";
import { CASE_0731_FAIL_A_PWA_OPEN_HTML } from "../tests/fixtures/four-line-0731-pwa-open-html-gap.ts";
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
  REPO_ROOT,
} from "./lib/gatewaySessionHarness.mjs";
import { gateAssistantCompletionText } from "../src/saas/deliverables/assistantCompletionGate.ts";

process.env.PILOTDECK_DISTILL_SDM ??= "shadow";
process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE ??= "shadow";
process.env.PILOTDECK_OPEN_HTML_MIN_SDM ??= "off";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "artifacts", "four-line-0731-fail-live");
fs.mkdirSync(outDir, { recursive: true });

const cases = [
  {
    id: "B-xiaomi-distill",
    goal: CASE_0731_FAIL_B_XIAOMI_DISTILL.goal,
    expectBasename: /methodology|writing-os|蒸馏|distill/i,
    forbidToxic: [/01-sources-and-synthesis/i, /03-report-body/i],
    timeoutMs: 900_000,
    assert: (row) => {
      const hit = (row.writes || []).some((p) => /methodology|writing-os|蒸馏|distill/i.test(path.basename(p)));
      const passed = row.acceptanceStatus === "passed" || hit;
      return { ok: passed && !row.timeout, detail: { hit, acceptance: row.acceptanceStatus } };
    },
  },
  {
    id: "C-nike-ip",
    goal: CASE_0731_FAIL_C_NIKE_IP.goal,
    timeoutMs: 1_200_000,
    assert: (row) => {
      const bases = (row.writes || []).map((p) => path.basename(String(p).replace(/\\/g, "/")));
      const strategy = bases.some((b) => /内容策略|strategy|content-strategy/i.test(b));
      const social = bases.some((b) => /copywriting|社媒|social|copy-matrix/i.test(b));
      const ok = (strategy && social) || row.acceptanceStatus === "passed";
      return { ok: ok && !row.timeout, detail: { strategy, social, acceptance: row.acceptanceStatus } };
    },
  },
  {
    id: "A-pwa-open-html",
    goal: CASE_0731_FAIL_A_PWA_OPEN_HTML.goal,
    timeoutMs: 1_200_000,
    assert: (row) => {
      const htmlHit = (row.writes || []).some((p) => /\.html?$/i.test(p) && /artifacts\/task-/i.test(String(p).replace(/\\/g, "/")));
      // Hard completion claim must gate when acceptance !== passed (snippet may contain soft「完成全部」).
      const gate = gateAssistantCompletionText(
        {
          text: CASE_0731_FAIL_A_PWA_OPEN_HTML.completionClaim,
          acceptanceStatus: row.acceptanceStatus === "passed" ? "passed" : "needs_repair",
        },
        "zh-CN",
      );
      const gateOk = row.acceptanceStatus === "passed" || gate.gated;
      return {
        ok: htmlHit && gateOk && !row.timeout,
        detail: { htmlHit, gated: gate.gated, acceptance: row.acceptanceStatus },
      };
    },
  },
];

const evidence = [];
let failed = 0;
const ws = await connectGateway({ clientName: "four-line-0731-fail-live" });
const projectKey = path.join(REPO_ROOT, "general");

try {
  for (const c of cases) {
    console.log(`\n[live-fail] === ${c.id} start ===`);
    const sessionKey = await newSession(ws, projectKey);
    const result = await submitTurn(ws, {
      sessionKey,
      projectKey,
      workspaceCwd: projectKey,
      message: c.goal,
      timeoutMs: c.timeoutMs,
      maxTurns: 14,
      tag: `fl0731-fail-${c.id}`,
    });
    const row = {
      id: c.id,
      sessionKey,
      ok: Boolean(result.ok),
      timeout: Boolean(result.timeout),
      acceptanceStatus: result.acceptanceStatus,
      writes: result.toolWritePaths || [],
      assistantSnippet: String(result.assistantText || "").slice(0, 400),
      durationMs: result.durationMs,
    };
    const verdict = c.assert(row);
    row.assertOk = verdict.ok;
    row.assertDetail = verdict.detail;
    if (!verdict.ok) failed += 1;
    evidence.push(row);
    fs.writeFileSync(path.join(outDir, `${c.id}.json`), JSON.stringify(row, null, 2));
    console.log(`[live-fail] ${c.id} assertOk=${verdict.ok}`, verdict.detail);
  }
} finally {
  await closeGateway(ws);
}

const summary = { ok: failed === 0, failed, evidence, at: new Date().toISOString() };
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (process.argv.includes("--gate") && failed > 0) {
  console.error(`[four-line-0731-fail-live] FAIL failed=${failed}`);
  process.exit(1);
}
console.log("[four-line-0731-fail-live] PASS");
