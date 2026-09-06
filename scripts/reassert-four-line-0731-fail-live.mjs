#!/usr/bin/env node
/** Post-hoc reassert live A/B/C evidence after pathHint fixes (no Gateway re-run). */
import fs from "node:fs";
import path from "node:path";
import { gateAssistantCompletionText } from "../src/saas/deliverables/assistantCompletionGate.ts";
import {
  parseNumberedLinesToSlots,
  sanitizePollutedPathHints,
} from "../src/saas/deliverables/deliverableChecklistAuthority.ts";
import { slotSatisfiedByValidation } from "../src/saas/deliverables/sdmSlotMatching.ts";
import { CASE_0731_FAIL_C_NIKE_IP } from "../tests/fixtures/four-line-0731-nike-ip-gap.ts";
import { CASE_0731_FAIL_A_PWA_OPEN_HTML } from "../tests/fixtures/four-line-0731-pwa-open-html-gap.ts";

process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE ??= "shadow";

const dir = path.join(process.cwd(), "artifacts", "four-line-0731-fail-live");
const b = JSON.parse(fs.readFileSync(path.join(dir, "B-xiaomi-distill.json"), "utf8"));
const c = JSON.parse(fs.readFileSync(path.join(dir, "C-nike-ip.json"), "utf8"));
const a = JSON.parse(fs.readFileSync(path.join(dir, "A-pwa-open-html.json"), "utf8"));

const bHit = (b.writes || []).some((p) => /methodology|writing-os|蒸馏|distill/i.test(p));

const slots = sanitizePollutedPathHints(parseNumberedLinesToSlots(CASE_0731_FAIL_C_NIKE_IP.goal));
const strategy = slots.find((s) => /策略/i.test(s.label ?? ""));
const social = slots.find((s) => /社媒/i.test(s.label ?? ""));
const livePaths = CASE_0731_FAIL_C_NIKE_IP.verifiedLive;
const cStrategy = slotSatisfiedByValidation(strategy, livePaths);
const cSocial = slotSatisfiedByValidation(social, livePaths);
const bases = (c.writes || []).map((p) => path.basename(String(p).replace(/\\/g, "/")));
const cWriteStrategy = bases.some((x) => /内容策略|strategy|content-strategy/i.test(x));
const cWriteSocial = bases.some((x) => /copywriting|社媒|social|copy-matrix/i.test(x));

const gate = gateAssistantCompletionText(
  {
    text: CASE_0731_FAIL_A_PWA_OPEN_HTML.completionClaim,
    acceptanceStatus: a.acceptanceStatus === "passed" ? "passed" : "needs_repair",
  },
  "zh-CN",
);
const htmlHit = (a.writes || []).some((p) => {
  const n = String(p).replace(/\\/g, "/");
  return /\.html?$/i.test(n) && /artifacts\/task-/i.test(n);
});

const rows = [
  { id: "B", ok: bHit, detail: { bHit, acceptance: b.acceptanceStatus } },
  {
    id: "C",
    ok: cStrategy && cSocial && cWriteStrategy && cWriteSocial,
    detail: { cStrategy, cSocial, cWriteStrategy, cWriteSocial, acceptance: c.acceptanceStatus },
  },
  {
    id: "A",
    ok: htmlHit && gate.gated,
    detail: { htmlHit, gated: gate.gated, acceptance: a.acceptanceStatus },
  },
];
const failed = rows.filter((r) => !r.ok).length;
const summary = { ok: failed === 0, failed, rows, at: new Date().toISOString() };
fs.writeFileSync(path.join(dir, "reassert-summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (failed > 0) process.exit(1);
console.log("[four-line-0731-fail-live-reassert] PASS");
