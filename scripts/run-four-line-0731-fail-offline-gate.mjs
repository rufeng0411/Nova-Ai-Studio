#!/usr/bin/env node
/**
 * PD-SAAS-FORK 0731-fail: offline gate for false-incomplete cases A/B/C.
 * B/C: false_incomplete=0 (slotSatisfied); A: completion gate gated===true.
 */
process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST ??= "1";
process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES ??= "1";
process.env.PILOTDECK_DISTILL_SDM ??= "shadow";
process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE ??= "shadow";
process.env.PILOTDECK_OPEN_HTML_MIN_SDM ??= "off";
process.env.PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT ??= "1";
process.env.PILOTDECK_SAAS_MODE ??= "1";

const { CASE_0731_FAIL_B_XIAOMI_DISTILL } = await import(
  "../tests/fixtures/four-line-0731-xiaomi-distill-gap.ts"
);
const { CASE_0731_FAIL_C_NIKE_IP } = await import(
  "../tests/fixtures/four-line-0731-nike-ip-gap.ts"
);
const { CASE_0731_FAIL_A_PWA_OPEN_HTML } = await import(
  "../tests/fixtures/four-line-0731-pwa-open-html-gap.ts"
);
const {
  buildWritingStyleDistillSlots,
  parseNumberedLinesToSlots,
  resolveAuthoritativeSdmSlots,
  sanitizePollutedPathHints,
} = await import("../src/saas/deliverables/deliverableChecklistAuthority.ts");
const { slotSatisfiedByValidation } = await import(
  "../src/saas/deliverables/sdmSlotMatching.ts"
);
const { gateAssistantCompletionText } = await import(
  "../src/saas/deliverables/assistantCompletionGate.ts"
);
const { shouldBlockDeliverableSubagent } = await import(
  "../src/saas/deliverables/shouldBlockDeliverableSubagent.ts"
);
const { buildTaskArtifactDirPromptXml } = await import(
  "../src/saas/taskState/sessionTaskDirectoryCore.ts"
);
const { parseNumberedDeliverableList } = await import(
  "../src/saas/taskState/sessionDeliverableManifest.ts"
);
const { mergeNumberedSlotsWithProfile } = await import(
  "../src/saas/taskState/mergeNumberedSlotsWithProfile.ts"
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const rows = [];

{
  // B: methodology satisfies distill; compile excludes unconditional wuxiaobo for 小米
  const slots = buildWritingStyleDistillSlots(CASE_0731_FAIL_B_XIAOMI_DISTILL.goal);
  assert(slots.length === 1, "B distill single slot");
  assert(!slots[0].pathHints?.includes("wuxiaobo-writing-os.md"), "B no wuxiaobo hardcode");
  const ok = slotSatisfiedByValidation(slots[0], [...CASE_0731_FAIL_B_XIAOMI_DISTILL.verified], {
    taskArtifactDir: CASE_0731_FAIL_B_XIAOMI_DISTILL.taskDir,
  });
  assert(ok === true, "B methodology satisfies → false_incomplete=0");
  rows.push({ case: "B-xiaomi-distill", ok: true, false_incomplete: 0 });
}

{
  // C: 内容策略 + copywriting satisfy strategy/social slots
  const slots = sanitizePollutedPathHints(
    parseNumberedLinesToSlots(CASE_0731_FAIL_C_NIKE_IP.goal),
  );
  const strategy = slots.find((s) => /策略/i.test(s.label ?? ""));
  const social = slots.find((s) => /社媒/i.test(s.label ?? ""));
  assert(strategy, "C strategy slot");
  assert(social, "C social slot");
  assert(
    strategy.pathHints?.includes("内容策略.md"),
    "C strategy hints include 内容策略.md",
  );
  assert(
    social.pathHints?.includes("copywriting.md"),
    "C social hints include copywriting.md",
  );
  const verified = [...CASE_0731_FAIL_C_NIKE_IP.verified];
  assert(slotSatisfiedByValidation(strategy, verified) === true, "C strategy satisfied");
  assert(slotSatisfiedByValidation(social, verified) === true, "C social satisfied");
  const liveVerified = [...(CASE_0731_FAIL_C_NIKE_IP.verifiedLive ?? [])];
  if (liveVerified.length) {
    assert(slotSatisfiedByValidation(strategy, liveVerified) === true, "C live strategy.md satisfied");
    assert(slotSatisfiedByValidation(social, liveVerified) === true, "C live copy-matrix.md satisfied");
  }
  rows.push({ case: "C-nike-ip", ok: true, false_incomplete: 0 });
}

{
  // A: completion gate + deliverable subagent block + task-dir scan guard copy
  const gate = gateAssistantCompletionText(
    {
      text: CASE_0731_FAIL_A_PWA_OPEN_HTML.completionClaim,
      acceptanceStatus: "needs_repair",
    },
    "zh-CN",
  );
  assert(gate.gated === true, "A gated===true");
  assert(
    shouldBlockDeliverableSubagent({ userGoal: CASE_0731_FAIL_A_PWA_OPEN_HTML.goal }) === true,
    "A block deliverable subagent",
  );
  const xml = buildTaskArtifactDirPromptXml({
    taskArtifactDir: CASE_0731_FAIL_A_PWA_OPEN_HTML.taskDir,
    taskDirKey: "task-20260731-d6ad62e2",
    goalVersion: 1,
    allocatedAt: new Date().toISOString(),
    displayLabel: "pwa",
  });
  assert(/never scan artifacts\/\*\*/i.test(xml), "A prompt forbids artifacts/** glob");
  // Default OPEN_HTML_MIN_SDM=off → compile may still be empty; do not require min slots.
  const compiled = resolveAuthoritativeSdmSlots({
    userGoal: CASE_0731_FAIL_A_PWA_OPEN_HTML.goal,
    parseNumberedList: parseNumberedDeliverableList,
    mergeWithProfile: mergeNumberedSlotsWithProfile,
  });
  rows.push({
    case: "A-pwa-open-html",
    ok: true,
    gated: gate.gated,
    compiledSlots: compiled.length,
  });
}

console.log(JSON.stringify({ ok: true, rows }, null, 2));
console.log("[four-line-0731-fail-offline] PASS");
