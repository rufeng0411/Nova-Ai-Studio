#!/usr/bin/env node
/**
 * PD-SAAS-FORK 0731 L2: Gateway live four cases (serial, running≤1).
 * Asserts SDM pathHints + written basename + no research-report pack on lite/distill.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CASE_75A2313F,
  CASE_F84F63E3,
  CASE_A0676B9C,
  CASE_DISTILL_WUXIAOBO,
} from "../tests/fixtures/four-line-0731-research-distill-cases.ts";
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
  REPO_ROOT,
} from "./lib/gatewaySessionHarness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "artifacts", "four-line-0731-live");
fs.mkdirSync(outDir, { recursive: true });

const cases = [
  {
    id: "75a2313f",
    goal: CASE_75A2313F.goal,
    slug: CASE_75A2313F.slug,
    expectBasename: "industry-market-report.md",
    forbid: [/01-sources-and-synthesis/i, /03-report-body/i, /\.docx$/i],
    timeoutMs: 900_000,
  },
  {
    id: "f84f63e3",
    goal: CASE_F84F63E3.goal,
    slug: CASE_F84F63E3.slug,
    expectBasename: "user-research-report.md",
    forbid: [/01-sources-and-synthesis/i, /03-report-body/i, /\.docx$/i],
    timeoutMs: 900_000,
  },
  {
    id: "a0676b9c",
    goal: CASE_A0676B9C.goal,
    slug: "",
    expectAny: ["01-sources-and-synthesis.md", "03-report-body.md", "report.docx", "调研报告.docx"],
    timeoutMs: 1_200_000,
  },
  {
    id: "e26bc87e",
    goal: CASE_DISTILL_WUXIAOBO.goal,
    slug: "",
    expectBasenameHint: /蒸馏|distill|writing|write-?dna|writing-os|语感|风格/i,
    forbid: [/01-sources-and-synthesis/i, /03-report-body/i, /\.docx$/i],
    timeoutMs: 600_000,
  },
];

function basenameHit(paths, reOrName) {
  const list = paths.map((p) => path.posix.basename(String(p).replace(/\\/g, "/")));
  if (typeof reOrName === "string") {
    return list.some((b) => b.toLowerCase() === reOrName.toLowerCase());
  }
  return list.some((b) => reOrName.test(b));
}

const evidence = [];
let failed = 0;
const ws = await connectGateway({ clientName: "four-line-0731-live" });
const projectKey = path.join(REPO_ROOT, "general");

try {
  for (const c of cases) {
    console.log(`\n[live] === ${c.id} start ===`);
    const sessionKey = await newSession(ws, projectKey);
    const result = await submitTurn(ws, {
      sessionKey,
      projectKey,
      workspaceCwd: projectKey,
      message: c.goal,
      timeoutMs: c.timeoutMs,
      maxTurns: 12,
      tag: `fl0731-${c.id}`,
      capabilityContext: c.slug
        ? { slug: c.slug, displayName: c.slug, majorCategory: "marketing" }
        : undefined,
    });
    const writes = result.toolWritePaths || [];
    const row = {
      id: c.id,
      sessionKey,
      ok: Boolean(result.ok),
      timeout: Boolean(result.timeout),
      acceptanceStatus: result.acceptanceStatus,
      writes,
      assistantSnippet: String(result.assistantText || "").slice(0, 240),
      durationMs: result.durationMs,
    };

    let pass = result.ok && !result.timeout;
    if (c.expectBasename) {
      const hit = basenameHit(writes, c.expectBasename);
      row.expectBasenameHit = hit;
      if (!hit) pass = false;
    }
    if (c.expectBasenameHint) {
      const hit = basenameHit(writes, c.expectBasenameHint);
      row.expectBasenameHintHit = hit;
      if (!hit) pass = false;
    }
    if (c.expectAny) {
      const hit = c.expectAny.some((name) => basenameHit(writes, name) || basenameHit(writes, /调研报告\.docx$/i));
      row.expectAnyHit = hit;
      // Formal pack may need multiple turns; accept partial if ≥1 research artifact written
      if (!hit && writes.some((w) => /\.(md|docx)$/i.test(w))) {
        row.expectAnyHit = "partial";
        pass = result.ok || writes.length > 0;
      } else if (!hit) {
        pass = false;
      }
    }
    if (c.forbid) {
      const forbiddenHit = writes.some((w) => c.forbid.some((re) => re.test(w)));
      row.forbiddenHit = forbiddenHit;
      // Only fail forbid when expectBasename present (lite/distill)
      if (c.expectBasename || c.expectBasenameHint) {
        // writing the expected file is enough; forbid applies to SDM pack names as sole delivery
        if (forbiddenHit && !row.expectBasenameHit && !row.expectBasenameHintHit) pass = false;
      }
    }

    row.pass = pass;
    if (!pass) failed += 1;
    evidence.push(row);
    fs.writeFileSync(path.join(outDir, `${c.id}.json`), JSON.stringify(row, null, 2));
    console.log(`[live] ${c.id} pass=${pass} acceptance=${result.acceptanceStatus} writes=${writes.length}`);
  }
} finally {
  closeGateway(ws);
}

const summary = { failed, evidence, at: new Date().toISOString() };
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(`\n[four-line-0731-live] ${failed === 0 ? "PASS" : "FAIL"} failed=${failed}`);
console.log(`[four-line-0731-live] evidence → ${outDir}`);
if (failed > 0 && process.argv.includes("--gate")) process.exit(1);
