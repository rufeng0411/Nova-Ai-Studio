#!/usr/bin/env node
/**
 * PD-SAAS-FORK L2: viral-article-pack 实机 1 案（Gateway WS）。
 * 期望：capabilitySlug=viral-article-generator → 四文件落盘。
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
import { TRY_PROMPT_ZH } from "./lib/capabilityTryPrompts.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO, "artifacts", "viral-article-pack-live");
const TIMEOUT_MS = Number(process.env.VIRAL_LIVE_TIMEOUT_MS || 900_000);
const REQUIRED = ["article-brief.md", "article.md", "quotes.md", "channel-plan.md"];

function basenamesFromPaths(paths) {
  const out = new Set();
  for (const p of paths ?? []) {
    const n = String(p).replace(/\\/g, "/").split("/").pop()?.toLowerCase();
    if (n) out.add(n);
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const goal =
    process.env.VIRAL_LIVE_GOAL
    || `${TRY_PROMPT_ZH["viral-article-generator"]}\n选题：新能源车价格战；气质优先半佛/风控老炮。`;

  const ws = await connectGateway({ clientName: "viral-article-pack-live" });
  const sessionKey = await newSession(ws, "general");
  console.log(`[viral-live] session=${sessionKey} timeout=${TIMEOUT_MS}ms`);

  const result = await submitTurn(ws, {
    sessionKey,
    message: goal,
    projectKey: "general",
    timeoutMs: TIMEOUT_MS,
    maxTurns: 12,
    tag: "viral-pack",
    capabilityContext: {
      slug: "viral-article-generator",
      displayName: "爆款长文生成",
      majorCategory: "marketing",
    },
  });
  closeGateway(ws);

  const written = basenamesFromPaths(result.toolWritePaths);
  const missing = REQUIRED.filter((b) => !written.has(b));
  const report = {
    capturedAt: new Date().toISOString(),
    sessionKey,
    ok: result.ok === true && missing.length === 0,
    timeout: Boolean(result.timeout),
    durationMs: result.durationMs,
    acceptanceStatus: result.acceptanceStatus,
    written: [...written],
    missing,
    toolWritePaths: result.toolWritePaths ?? [],
    stopReason: result.stopReason,
    assistantPreview: String(result.assistantText ?? "").slice(0, 800),
  };
  const outFile = path.join(OUT_DIR, "live-report.json");
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[viral-live] ok=${report.ok} missing=${missing.join(",") || "-"} → ${outFile}`);
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error("[viral-live] fatal", err);
  process.exit(1);
});
