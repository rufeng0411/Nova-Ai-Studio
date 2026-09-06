#!/usr/bin/env node
/**
 * PD-SAAS-FORK 0731: offline compile gate for four-line research/distill cases.
 * Live Gateway L2 still required for production GO; this gate proves SDM compile KPIs.
 */
process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST ??= "1";
process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES ??= "1";
process.env.PILOTDECK_DISTILL_SDM ??= "shadow";
process.env.PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY ??= "shadow";
process.env.PILOTDECK_SDM_HEAL_RESEARCH_LITE ??= "shadow";
process.env.PILOTDECK_BLOCK_SILENT_RESEARCH_ADD ??= "shadow";
process.env.PILOTDECK_SAAS_MODE ??= "1";

const {
  CASE_75A2313F,
  CASE_F84F63E3,
  CASE_A0676B9C,
  CASE_DISTILL_WUXIAOBO,
} = await import("../tests/fixtures/four-line-0731-research-distill-cases.ts");
const {
  resolveAuthoritativeSdmSlots,
  resolveChecklistAuthoritySlots,
  enrichResearchReportAuthoritySlots,
  detectChecklistAuthorityTemplateId,
} = await import("../src/saas/deliverables/deliverableChecklistAuthority.ts");
const { parseNumberedDeliverableList } = await import("../src/saas/taskState/sessionDeliverableManifest.ts");
const { mergeNumberedSlotsWithProfile } = await import("../src/saas/taskState/mergeNumberedSlotsWithProfile.ts");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const rows = [];

{
  const slots = resolveAuthoritativeSdmSlots({
    userGoal: CASE_75A2313F.goal,
    capabilitySlug: CASE_75A2313F.slug,
    parseNumberedList: parseNumberedDeliverableList,
    mergeWithProfile: mergeNumberedSlotsWithProfile,
  });
  const emptySlug = resolveAuthoritativeSdmSlots({
    userGoal: CASE_75A2313F.goal,
    capabilitySlug: "",
    parseNumberedList: parseNumberedDeliverableList,
    mergeWithProfile: mergeNumberedSlotsWithProfile,
  });
  assert(slots.length === 1 && slots[0].pathHint === CASE_75A2313F.expectedPathHint, "75a industry slug");
  assert(emptySlug.length === 1 && emptySlug[0].pathHint === CASE_75A2313F.expectedPathHint, "75a empty slug");
  assert(!slots.some((s) => /\.docx$/i.test(s.pathHint ?? "")), "75a no docx");
  rows.push({ case: "75a2313f", ok: true, slots: slots.map((s) => s.pathHint) });
}

{
  const slots = resolveAuthoritativeSdmSlots({
    userGoal: CASE_F84F63E3.goal,
    capabilitySlug: CASE_F84F63E3.slug,
    parseNumberedList: parseNumberedDeliverableList,
    mergeWithProfile: mergeNumberedSlotsWithProfile,
  });
  assert(slots.length === 1 && slots[0].pathHint === CASE_F84F63E3.expectedPathHint, "f84f user");
  rows.push({ case: "f84f63e3", ok: true, slots: slots.map((s) => s.pathHint) });
}

{
  assert(detectChecklistAuthorityTemplateId(CASE_A0676B9C.goal) === "research-report", "a067 tpl");
  const slots = enrichResearchReportAuthoritySlots(
    resolveChecklistAuthoritySlots("research-report"),
    "research-report",
  );
  const s1 = new Set(slots.find((s) => s.id.endsWith("_1"))?.pathHints ?? []);
  const s2 = new Set(slots.find((s) => s.id.endsWith("_2"))?.pathHints ?? []);
  assert([...s1].every((h) => !s2.has(h)), "a067 hints disjoint");
  rows.push({
    case: "a0676b9c",
    ok: true,
    slots: slots.map((s) => ({ id: s.id, hints: s.pathHints })),
  });
}

{
  const slots = resolveAuthoritativeSdmSlots({
    userGoal: CASE_DISTILL_WUXIAOBO.goal,
    parseNumberedList: parseNumberedDeliverableList,
    mergeWithProfile: mergeNumberedSlotsWithProfile,
  });
  assert(slots.length === 1, "distill single slot");
  assert(slots[0].kind === "markdown", "distill md");
  assert(!slots.some((s) => /01-sources|03-report|\.docx/i.test(s.pathHint ?? "")), "distill no pack");
  rows.push({ case: "e26bc87e", ok: true, slots: slots.map((s) => s.pathHint) });
}

console.log(JSON.stringify({ ok: true, rows }, null, 2));
console.log("[four-line-0731-offline] PASS");
