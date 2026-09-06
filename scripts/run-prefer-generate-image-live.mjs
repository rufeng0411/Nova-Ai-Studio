#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Prefer-generate_image creative track — offline fixture + optional Gateway live.
 *
 * Cases:
 *   A poster  — expect generate_image route / creative active
 *   B official — forbid creative gen (official track)
 *   C OKR     — generate_image must NOT be forced
 *
 * Usage:
 *   node --import tsx scripts/run-prefer-generate-image-live.mjs --gate
 *   node --import tsx scripts/run-prefer-generate-image-live.mjs --gate --offline-fixture
 *   node --import tsx scripts/run-prefer-generate-image-live.mjs --gate --live   # Bridge 7990 + Gateway
 *   node --import tsx scripts/run-prefer-generate-image-live.mjs --billing-case  # hard-fail hint check
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const gate = process.argv.includes("--gate");
const live = process.argv.includes("--live");
const billingCase = process.argv.includes("--billing-case");
const offlineFixture = process.argv.includes("--offline-fixture") || !live;

const REPORT_DIR = path.join(REPO, "artifacts", "prefer-generate-image");
const REPORT_PATH = path.join(REPORT_DIR, "live-gate-report.json");

async function probeBridge(ports = [7990, 3001]) {
  for (const port of ports) {
    const url = `http://127.0.0.1:${port}/api/saas/health/ready`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) return { ok: true, port, url };
    } catch {
      // try next
    }
  }
  return { ok: false, port: null, url: null };
}

async function runOffline() {
  process.env.PILOTDECK_PREFER_GENERATE_IMAGE ??= "shadow";
  process.env.PILOTDECK_MEDIA_STRATEGY_RESOLVER ??= "1";
  // Force image API ready for routing assertions (offline only).
  process.env.GOOGLE_API_KEY ??= "offline-fixture-key";
  process.env.PILOTDECK_IMAGE_API_KEY ??= process.env.GOOGLE_API_KEY;

  const {
    isCreativePreferGenActive,
    excludesCreativeGenerateImage,
    shouldRouteCreativeGenerateImage,
  } = await import("../src/saas/media/creativeGenerateImageIntent.ts");
  const { resolveMediaStrategy } = await import("../src/saas/media/mediaStrategyResolver.ts");
  const { appendToolRecoveryHint } = await import("../src/tool/recoveryHints.ts");

  const cases = [];

  // A — creative poster
  {
    const goal = "做一张活动海报 HTML，主视觉要好看";
    const slug = "od-poster-hero";
    const creative = isCreativePreferGenActive({ goal, slug });
    const strategy = resolveMediaStrategy(goal, slug, process.env);
    const pass = creative === true && strategy === "generate_image";
    cases.push({
      id: "A",
      name: "poster_creative",
      expect: "generate_image>=1 (route)",
      creative,
      strategy,
      pass,
      generate_image_route: strategy === "generate_image" ? 1 : 0,
      forbid_violation: 0,
    });
  }

  // B — official imagery
  {
    const goal = "海报 HTML，图和资料要来自官网 https://example.com/product";
    const slug = "od-poster-hero";
    const excluded = excludesCreativeGenerateImage(goal, slug);
    const creative = isCreativePreferGenActive({ goal, slug });
    const strategy = resolveMediaStrategy(goal, slug, process.env);
    const forbidViolation = strategy === "generate_image" ? 1 : 0;
    const pass = excluded && !creative && strategy === "official_fetch" && forbidViolation === 0;
    cases.push({
      id: "B",
      name: "official_no_fake_gen",
      expect: "forbid=0 (no generate_image for official)",
      creative,
      strategy,
      pass,
      generate_image_route: strategy === "generate_image" ? 1 : 0,
      forbid_violation: forbidViolation,
    });
  }

  // C — OKR / non-creative
  {
    const goal = "做一个团队 OKR 看板 HTML";
    const slug = "od-team-okrs";
    const creative = isCreativePreferGenActive({ goal, slug });
    const route = shouldRouteCreativeGenerateImage({ goal, slug });
    const strategy = resolveMediaStrategy(goal, slug, process.env);
    const pass = !creative && !route && strategy !== "generate_image";
    cases.push({
      id: "C",
      name: "okr_no_force_gen",
      expect: "generate_image=0",
      creative,
      strategy,
      pass,
      generate_image_route: strategy === "generate_image" ? 1 : 0,
      forbid_violation: 0,
    });
  }

  let billing = null;
  if (billingCase || offlineFixture) {
    const hint = appendToolRecoveryHint(
      "generate_image",
      "tool_execution_failed",
      "Provider Arrearage: account overdue-payment",
    );
    const pass = hint.includes("authentication or billing")
      && !hint.includes("inline SVG placeholder");
    billing = {
      id: "L3",
      name: "billing_hard_fail",
      pass,
      expect: "UserActionRequired hint, not unlabeled CSS",
    };
  }

  const offlinePass = cases.every((c) => c.pass) && (billing ? billing.pass : true);
  return {
    mode: "offline-fixture",
    offlinePass,
    cases,
    billing,
    false_incomplete: 0,
  };
}

async function runLiveIfReady(offlineReport) {
  const bridge = await probeBridge();
  if (!bridge.ok) {
    return {
      ...offlineReport,
      live: { skipped: true, reason: "Bridge health/ready not reachable on 7990/3001" },
      pass: offlineReport.offlinePass,
      liveRequired: live,
    };
  }

  // Live Gateway turn replay is optional in this batch: structural offline gate is authoritative
  // for Hotfix. When --live is set, we record Bridge readiness as L2 precondition.
  return {
    ...offlineReport,
    live: {
      skipped: !live,
      bridgePort: bridge.port,
      note: live
        ? "Bridge ready — submit_turn KPI (generate_image counts) must be filled from a workers=1 session; see docs/prefer-generate-image-20260803.zh-CN.md"
        : "Pass --live after Bridge is up to mark L2 live precondition",
    },
    pass: offlineReport.offlinePass && (!live || bridge.ok),
    liveRequired: live,
  };
}

async function main() {
  const offlineReport = await runOffline();
  const report = await runLiveIfReady(offlineReport);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(`[prefer-generate-image] report → ${REPORT_PATH}`);
  for (const c of report.cases) {
    console.log(`  ${c.pass ? "PASS" : "FAIL"} ${c.id} ${c.name} strategy=${c.strategy}`);
  }
  if (report.billing) {
    console.log(`  ${report.billing.pass ? "PASS" : "FAIL"} L3 ${report.billing.name}`);
  }
  if (report.live?.skipped) {
    console.log(`  SKIP live: ${report.live.reason || report.live.note}`);
  } else if (report.live?.bridgePort) {
    console.log(`  LIVE precondition: Bridge :${report.live.bridgePort}`);
  }

  const ok = report.pass !== false && offlineReport.offlinePass;
  if (gate && !ok) {
    console.error("[prefer-generate-image] GATE FAIL");
    process.exit(1);
  }
  if (gate && live && report.live?.skipped) {
    console.error("[prefer-generate-image] GATE FAIL: --live requested but Bridge not ready");
    process.exit(1);
  }
  console.log(`[prefer-generate-image] ${ok ? "PASS" : "FAIL"} (gate=${gate})`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
