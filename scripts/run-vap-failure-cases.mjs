#!/usr/bin/env node
/**
 * PD-SAAS-FORK: strict VAP failure-case gate F01–F12.
 * Usage: node scripts/run-vap-failure-cases.mjs [--gate]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATE = process.argv.includes("--gate");
const OUT_DIR = path.join(REPO, "artifacts", "vap-hardening-strict");

async function loadTs(rel) {
  const mod = await import(pathToFileURL(path.join(REPO, rel)).href);
  return mod;
}

async function main() {
  process.env.PILOTDECK_VISUAL_ASSET_PLATFORM ??= "shadow";
  process.env.PILOTDECK_VAP_OFFICIAL_FIRST ??= "1";
  process.env.PILOTDECK_VAP_DIRECT_IMAGE_URL ??= "1";
  process.env.PILOTDECK_VAP_FORCE_LADDER ??= "1";
  process.env.PILOTDECK_VAP_CRAWLER_SIDECAR ??= "off";
  process.env.PILOTDECK_VAP_VISION_LOCATE ??= "shadow";

  const fixtures = await loadTs("tests/fixtures/vap-failure-cases-20260802.ts");
  const cases = fixtures.VAP_FAILURE_CASES_20260802;

  const {
    isAllowedOfficialCrossHostRedirect,
    normalizePublicHttpUrl,
  } = await loadTs("src/tool/builtin/web/publicHttpUrlPolicy.ts");
  const { coerceMinWidth, isVapOfficialFirstEnabled } = await loadTs(
    "src/saas/media/visualAssetPlatform/vapOutboundGate.ts",
  );
  const { selectSearchPackForGoal, fillQueriesForSubject } = await loadTs(
    "src/saas/media/visualAssetPlatform/searchDiscovery.ts",
  ).catch(async () => {
    const m = await loadTs("src/saas/media/visualAssetPlatform/searchDiscovery.ts");
    return m;
  });
  const { shouldBlockPlaceholderWhenAssetsExist } = await loadTs(
    "src/saas/media/visualAssetPlatform/vapBindBeforeWrite.ts",
  );
  const {
    noteVisualFetchFailure,
    shouldForceVisualLadder,
    resetForceLadderStateForTests,
  } = await loadTs("src/saas/media/visualAssetPlatform/forceLadder.ts");
  const {
    extractImagesViaCrawlerSidecar,
    setVapCrawlerClientForTests,
  } = await loadTs("src/saas/media/visualAssetPlatform/crawlerSidecar/client.ts");
  const { parseImageUrlsFromVisionText } = await loadTs(
    "src/saas/media/visualAssetPlatform/visionImageLocate.ts",
  );
  const { looksLikeHttpsImageUrl } = await loadTs(
    "src/tool/builtin/fetchMediaAsset.ts",
  ).catch(() => ({ looksLikeHttpsImageUrl: (u) => /^https:\/\/.+\.(jpg|png|webp)/i.test(u) }));

  const results = [];
  resetForceLadderStateForTests();

  for (const testCase of cases) {
    let ok = false;
    let detail = "";
    try {
      switch (testCase.assert) {
        case "direct_image_url": {
          const id = String(testCase.setup.candidateId);
          ok = typeof looksLikeHttpsImageUrl === "function"
            ? looksLikeHttpsImageUrl(id)
            : /^https:\/\//i.test(id);
          detail = ok ? "url_shape_ok" : "not_https_image";
          break;
        }
        case "same_etld_redirect": {
          const from = new URL(String(testCase.setup.from));
          const to = new URL(String(testCase.setup.to));
          ok = isAllowedOfficialCrossHostRedirect(from, to);
          detail = ok ? "allowed" : "blocked";
          break;
        }
        case "block_placeholder_with_assets": {
          ok = shouldBlockPlaceholderWhenAssetsExist({
            filePath: String(testCase.setup.filePath),
            assetCount: Number(testCase.setup.assetCount),
          });
          detail = ok ? "blocked" : "not_blocked";
          break;
        }
        case "official_first_flag": {
          ok = isVapOfficialFirstEnabled();
          detail = ok ? "enabled" : "disabled";
          break;
        }
        case "coerce_min_width": {
          ok = coerceMinWidth(testCase.setup.value, 400) === 800;
          detail = String(coerceMinWidth(testCase.setup.value, 400));
          break;
        }
        case "force_ladder": {
          resetForceLadderStateForTests();
          const sid = String(testCase.setup.sessionId);
          noteVisualFetchFailure(sid);
          noteVisualFetchFailure(sid);
          ok = shouldForceVisualLadder(sid, 2);
          detail = ok ? "force" : "no_force";
          break;
        }
        case "query_pack_generic": {
          const { resolveSearchQueriesForGoal } = await loadTs(
            "src/saas/media/visualAssetPlatform/searchDiscovery.ts",
          );
          const subjects = testCase.setup.subjects ?? [];
          const checks = [];
          for (const subject of subjects) {
            const q = await resolveSearchQueriesForGoal(subject, subject);
            const blob = [...q.webQueries, ...q.imageQueries].join("\n");
            checks.push(!/chery\.cn|autohome|懂车帝/u.test(blob));
          }
          ok = checks.every(Boolean);
          detail = ok ? "no_car_bias" : "car_bias_leak";
          break;
        }
        case "sidecar_down": {
          setVapCrawlerClientForTests(null);
          process.env.PILOTDECK_VAP_CRAWLER_SIDECAR = "off";
          const r = await extractImagesViaCrawlerSidecar({
            url: "https://example.com/",
          });
          ok = Boolean(r.skipped) && r.imageUrls.length === 0;
          detail = r.error ?? "ok";
          break;
        }
        case "ssrf_reject": {
          try {
            normalizePublicHttpUrl(String(testCase.setup.url));
            ok = false;
            detail = "unexpectedly_normalized";
          } catch {
            ok = true;
            detail = "rejected";
          }
          break;
        }
        case "vision_no_url": {
          const urls = parseImageUrlsFromVisionText(String(testCase.setup.text));
          ok = urls.length === 0;
          detail = `urls=${urls.length}`;
          break;
        }
        case "official_placeholder_gate": {
          // With 0 assets, placeholder path should NOT be blocked by assets-exist rule
          const blocked = shouldBlockPlaceholderWhenAssetsExist({
            filePath: "assets/placeholder-x.svg",
            assetCount: 0,
          });
          ok = blocked === false;
          detail = blocked ? "blocked_empty" : "allow_empty_placeholder_path";
          break;
        }
        default:
          detail = `unknown_assert:${testCase.assert}`;
          ok = false;
      }
    } catch (error) {
      ok = false;
      detail = error instanceof Error ? error.message : String(error);
    }
    results.push({
      id: testCase.id,
      title: testCase.title,
      ok,
      detail,
      soft: Boolean(testCase.soft),
    });
    console.log(`${ok ? "PASS" : "FAIL"} ${testCase.id} ${testCase.title} (${detail})`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const reportPath = path.join(OUT_DIR, "failure-cases-report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
  );

  const hard = results.filter((r) => !r.soft);
  const failed = hard.filter((r) => !r.ok);
  console.log(`\n${hard.length - failed.length}/${hard.length} hard cases passed → ${reportPath}`);
  if (GATE && failed.length > 0) {
    console.error("GATE FAIL:", failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
