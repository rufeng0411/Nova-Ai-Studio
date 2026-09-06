#!/usr/bin/env node
/**
 * PD-SAAS-FORK: offline 0802 paddleboard + KM3 VAP replay gate.
 * Usage: node --import tsx scripts/run-vap-0802-replay.mjs [--gate]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATE = process.argv.includes("--gate");
const OUT = path.join(REPO, "artifacts", "vap-hardening-strict", "0802-replay.json");

async function main() {
  process.env.PILOTDECK_VISUAL_ASSET_PLATFORM ??= "shadow";
  process.env.PILOTDECK_VAP_OFFICIAL_FIRST ??= "1";
  process.env.PILOTDECK_VAP_QUERY_PACK ??= "generic";
  process.env.PILOTDECK_VAP_DIRECT_IMAGE_URL ??= "1";

  const { VAP_0802_REPLAY_CASES } = await import(
    pathToFileURL(path.join(REPO, "tests/fixtures/vap-20260802-paddleboard-km3.ts")).href
  );
  const { resolveSearchQueriesForGoal } = await import(
    pathToFileURL(
      path.join(REPO, "src/saas/media/visualAssetPlatform/searchDiscovery.ts"),
    ).href
  );
  const { isVapOfficialFirstEnabled } = await import(
    pathToFileURL(
      path.join(REPO, "src/saas/media/visualAssetPlatform/vapOutboundGate.ts"),
    ).href
  );
  const { looksLikeHttpsImageUrl } = await import(
    pathToFileURL(path.join(REPO, "src/tool/builtin/fetchMediaAsset.ts")).href
  );
  const { resolveVapOrchestratorBudgetMs } = await import(
    pathToFileURL(
      path.join(REPO, "src/saas/media/visualAssetPlatform/forceLadder.ts"),
    ).href
  );

  const results = [];
  for (const testCase of VAP_0802_REPLAY_CASES) {
    const q = await resolveSearchQueriesForGoal(testCase.userGoal, testCase.userGoal);
    const noCarBias = ![...q.webQueries, ...q.imageQueries].join("\n").match(
      /chery\.cn|autohome\.com\.cn|懂车帝/u,
    );
    const officialFirst = isVapOfficialFirstEnabled();
    const hasUrl = /https?:\/\//u.test(testCase.userGoal);
    const budget = resolveVapOrchestratorBudgetMs(testCase.userGoal);
    const budgetOk = !hasUrl || budget >= 60_000;
    const directOk = testCase.expect.directImageSample
      ? looksLikeHttpsImageUrl(testCase.expect.directImageSample)
      : true;
    const ok = Boolean(noCarBias && officialFirst && budgetOk && directOk);
    results.push({
      id: testCase.id,
      ok,
      noCarBias: Boolean(noCarBias),
      officialFirst,
      budget,
      budgetOk,
      directOk,
      pack: q.pack,
    });
    console.log(`${ok ? "PASS" : "FAIL"} ${testCase.id} pack=${q.pack} budget=${budget}`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  const failed = results.filter((r) => !r.ok);
  if (GATE && failed.length) {
    console.error("GATE FAIL", failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
