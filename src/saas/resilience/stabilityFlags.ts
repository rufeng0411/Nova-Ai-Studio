// PD-SAAS-FORK: centralized kill-switches for the "Codex-grade task/dialogue stability" P0 work.
//
// Each gate wraps exactly one engine behavior change so it can be disabled via an env var in
// production WITHOUT a rebuild (same pattern as designCanvasGate / clarificationGate).
//
// Default = OFF (production-safe). Deploying the code therefore changes NOTHING on the line until
// an operator opts in. Gradual rollout: set the flag to "1" (canary tenant -> all). Instant
// rollback: set it back to "0" and recreate the container. dev:saas injects "1" for all of these
// (see scripts/lib/devLauncherCore.mjs) so local development always exercises the new paths.
//
// Accepted truthy: "1" | "true" | "on"   Accepted falsy: "0" | "false" | "off"   else -> fallback.

export type StabilityFlagName =
  | "PILOTDECK_TRANSIENT_INVISIBLE"
  | "PILOTDECK_COLD_RESUME"
  | "PILOTDECK_DEGENERATION_GUARD"
  | "PILOTDECK_PROGRESS_BUDGET"
  | "PILOTDECK_COMPLETION_GATE"
  | "PILOTDECK_PLAN_LEDGER"
  | "PILOTDECK_QUALITY_ACCEPT"
  | "PILOTDECK_TOOL_WATCHDOG"
  | "PILOTDECK_STREAM_DEGENERATION"
  | "PILOTDECK_TOOL_RESULT_COMPACTION"
  | "PILOTDECK_VERIFICATION_PASS"
  | "PILOTDECK_GOAL_STOP_CONDITIONS"
  | "PILOTDECK_VERIFICATION_LLM"
  | "PILOTDECK_SESSION_DELIVERABLE_MANIFEST"
  | "PILOTDECK_SESSION_TASK_DIRECTORY"
  | "PILOTDECK_STDA_ADD_PRESERVE_ROOT"
  | "PILOTDECK_SDM_HTML_SLOT_FUZZY"
  | "PILOTDECK_RECOVERY_SURFACE_V2"
  | "PILOTDECK_DELIVERABLE_CERTIFICATE_V2"
  | "PILOTDECK_CONTRACT_AUTHORITY_V2"
  | "PILOTDECK_FACTUAL_PREMISE_GUARD"
  | "PILOTDECK_COMPOSITE_SLOT_QUALITY"
  | "PILOTDECK_CAPABILITY_SCOPE_V2"
  | "PILOTDECK_GOAL_QUALITY_CONTRACT"
  | "PILOTDECK_OFFICIAL_MEDIA_V2"
  | "PILOTDECK_CONTENT_QUALITY_V2"
  | "PILOTDECK_EXPORT_SNAPSHOT_V2"
  | "PILOTDECK_VISUAL_ASSET_PLATFORM"
  | "PILOTDECK_DISCOVER_VISUAL_ASSETS"
  | "PILOTDECK_VISUAL_ASSET_PREP"
  | "PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS"
  | "PILOTDECK_VISUAL_BINDING_AUDIT"
  | "PILOTDECK_VAP_BIND_BEFORE_WRITE"
  | "PILOTDECK_SEQUENTIAL_DELIVERABLES"
  | "PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES"
  | "PILOTDECK_SDM_HTML_REPORT_ALIAS"
  | "PILOTDECK_RESEARCH_PASSED_GT_STRICT_HTML"
  | "PILOTDECK_ASSISTANT_COMPLETION_GATE"
  | "PILOTDECK_PPT_EXPORT_DEFAULT_POLICY"
  | "PILOTDECK_PARALLEL_OFFICE_EXPORT"
  | "PILOTDECK_PARALLEL_WRITE_FILE"
  | "PILOTDECK_HTML_FORMAL_ACCEPTANCE"
  | "PILOTDECK_AUTOORCH_PRESERVE_DELIVERABLE_TOOLS"
  | "PILOTDECK_NOVA_SLIDE_IMAGE_PARALLEL"
  | "PILOTDECK_HF_KEY_OPTIONAL_DEGRADE"
  | "PILOTDECK_ORCH_BYPASS_MATRIX_GEO"
  | "PILOTDECK_MATRIX_CORE_GT_PASS"
  | "PILOTDECK_PARALLEL_GEO_STAGES"
  | "PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT"
  | "PILOTDECK_OFFICE_EXTENSION_STRICT"
  | "PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT"
  | "PILOTDECK_SDM_GEO_KEYWORD_ALIAS"
  | "PILOTDECK_SDM_GEO_FAST_CHECK_ALIAS"
  | "PILOTDECK_REPAIR_ALIAS_SHORT_CIRCUIT"
  | "PILOTDECK_FOLDER_SDM_FILTER"
  | "PILOTDECK_HF_TRY_PROMPT_STRICT"
  | "PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY"
  | "PILOTDECK_SDM_HEAL_RESEARCH_LITE"
  | "PILOTDECK_DISTILL_SDM"
  | "PILOTDECK_BLOCK_SILENT_RESEARCH_ADD"
  | "PILOTDECK_OPEN_HTML_MIN_SDM"
  | "PILOTDECK_DELIVERABLE_BRIEF_CONTRACT"
  | "PILOTDECK_INFER_CAPABILITY_CONTEXT"
  | "PILOTDECK_TRY_PROMPT_CONTRACT_V2"
  | "PILOTDECK_TASK_STAGE_BUDGET"
  | "PILOTDECK_EXPENSIVE_INTENT_CLARIFY"
  | "PILOTDECK_KIND_MENTION_SANITIZE";

/** Node (Gateway) or Vite browser bundle — never bare `process.env` (UI imports this module). */
function readEnv(name: string): string | undefined {
  if (typeof process !== "undefined") {
    const fromProcess = process.env[name];
    if (fromProcess != null) return fromProcess;
  }
  // Gateway/tsx: import.meta exists but import.meta.env is undefined — must not throw.
  const viteEnv = typeof import.meta !== "undefined"
    ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    : undefined;
  if (viteEnv) {
    const fromVite = viteEnv[`VITE_${name}`];
    if (fromVite != null && fromVite !== "") return fromVite;
    if (name === "PILOTDECK_SAAS_MODE" && viteEnv.VITE_PILOTDECK_SAAS_MODE != null) {
      return viteEnv.VITE_PILOTDECK_SAAS_MODE === "true" ? "1" : "0";
    }
  }
  return undefined;
}

function isSaasModeDefault(): boolean {
  return readEnv("PILOTDECK_SAAS_MODE") === "1";
}

function namedFlagEnabled(name: string, fallback: boolean): boolean {
  const raw = readEnv(name);
  if (raw == null) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  if (value === "1" || value === "true" || value === "on") return true;
  return fallback;
}

function flagEnabled(name: StabilityFlagName, fallback: boolean): boolean {
  return namedFlagEnabled(name, fallback);
}

export type StabilityTriStateMode = "off" | "shadow" | "enforce";

function triStateFlagMode(name: StabilityFlagName): StabilityTriStateMode {
  const raw = readEnv(name);
  if (raw == null) return "off";
  const value = raw.trim().toLowerCase();
  if (value === "shadow") return "shadow";
  if (value === "enforce") return "enforce";
  return "off";
}

/** 0717 P1: prompt-only factual-premise assessment; independent and default off. */
export function factualPremiseGuardMode(): StabilityTriStateMode {
  return triStateFlagMode("PILOTDECK_FACTUAL_PREMISE_GUARD");
}

/** 0717 P1: directory-composite quality assessment; independent and default off. */
export function compositeSlotQualityMode(): StabilityTriStateMode {
  return triStateFlagMode("PILOTDECK_COMPOSITE_SLOT_QUALITY");
}

/** Binary interaction-mode gate; kept outside the published stability snapshot. */
export function isBinaryIntentGateEnabled(): boolean {
  return namedFlagEnabled("PILOTDECK_BINARY_INTENT_GATE", false);
}

/** Observe-only companion for the binary interaction-mode gate. */
export function isBinaryIntentGateShadowEnabled(): boolean {
  return namedFlagEnabled("PILOTDECK_BINARY_INTENT_GATE_SHADOW", false);
}

/**
 * P0-1: render transient network failures (fetch failed / socket hang up) invisible to the user
 * and let the engine auto-continue. Gates the riskier blocker reclassification + invisible model
 * retry; the existing leak guards stay always-on.
 */
export function isTransientInvisibleEnabled(): boolean {
  return flagEnabled("PILOTDECK_TRANSIENT_INVISIBLE", false);
}

/**
 * P0-2: server-anchored cold resume after a full-stack disconnect / process restart
 * (persistent idempotency + budget + recency window). UI is only the initiator.
 */
export function isColdResumeEnabled(): boolean {
  return flagEnabled("PILOTDECK_COLD_RESUME", false);
}

/**
 * P0-4: deliverable-level generation-degeneration guard. Scans finished .md/.html for repeated
 * table rows / paragraphs and flags needs_repair. High threshold to avoid false positives.
 */
export function isDegenerationGuardEnabled(): boolean {
  return flagEnabled("PILOTDECK_DEGENERATION_GUARD", false);
}

/**
 * P0-5: general no-progress budget (ProgressLedger across read/write/edit/thinking). Gates the
 * EXPANDED coverage only; the existing read-only no-progress tracker remains always-on.
 */
export function isProgressBudgetEnabled(): boolean {
  return flagEnabled("PILOTDECK_PROGRESS_BUDGET", false);
}

/**
 * P0-6: completion gate. When the model wants to stop on a profile+goal deliverable task, re-verify
 * the goal contract; if unmet and repairable, the engine takes over instead of ending the turn.
 */
export function isCompletionGateEnabled(): boolean {
  return flagEnabled("PILOTDECK_COMPLETION_GATE", false);
}

/**
 * P1-A: engine plan ledger. Derives an ordered step list from the task goal contract and lets the
 * loop reason about which steps are done / remaining (telemetry + repair-prompt enrichment only).
 * Observational by default; never blocks or extends a turn on its own.
 */
export function isPlanLedgerEnabled(): boolean {
  return flagEnabled("PILOTDECK_PLAN_LEDGER", false);
}

/**
 * P1-D: quality acceptance. Adds soft quality defects (inconsistent markdown table columns, below
 * a minimum meaningful length) to final acceptance. Soft-display only — never hard-hides a parseable
 * file, only marks needs_repair so the existing repair path can improve it.
 */
export function isQualityAcceptEnabled(): boolean {
  return flagEnabled("PILOTDECK_QUALITY_ACCEPT", false);
}

/**
 * P1-F: single-tool watchdog. Assigns each tool a soft deadline and records a timeout signal when a
 * batch overruns, so a single hung tool surfaces as telemetry / a guidance nudge instead of silently
 * stalling the turn. Non-destructive: it never kills an in-flight tool.
 */
export function isToolWatchdogEnabled(): boolean {
  return flagEnabled("PILOTDECK_TOOL_WATCHDOG", false);
}

/**
 * P1-C2: streaming-layer degeneration truncation (HIGH RISK). Detects runaway repetition while the
 * model is still streaming and signals an early, clean stop. Default OFF and intentionally only
 * enabled after sufficient observation of the offline detector.
 */
export function isStreamDegenerationEnabled(): boolean {
  return flagEnabled("PILOTDECK_STREAM_DEGENERATION", false);
}

/**
 * P2-E: in-turn context compaction. Summarizes older, large tool_result blocks (keeps the path +
 * a short head so they can be re-read on demand) to save tokens on long turns. Default OFF; runs
 * alongside, and never replaces, the existing whole-message auto-compaction.
 */
export function isToolResultCompactionEnabled(): boolean {
  return flagEnabled("PILOTDECK_TOOL_RESULT_COMPACTION", false);
}

/**
 * P2: verification pass scaffold (planner -> executor -> verifier decision layer). Decides whether
 * an independent verification pass is warranted before declaring a deliverable task done. Default
 * OFF; the orchestration itself is opt-in and observational until proven.
 */
export function isVerificationPassEnabled(): boolean {
  return flagEnabled("PILOTDECK_VERIFICATION_PASS", false);
}

/**
 * /goal Feature 2: natural-language goal stop conditions. When ON, a user-stated turn budget
 * ("N 轮内停") parsed into TaskGoalContract.maxTurnsHint clamps the effective turn budget. Pure &
 * deterministic — it can only make a turn end sooner (same safety property as the completion gate).
 * Default OFF; dev auto-enables it (zero model cost).
 */
export function isGoalStopConditionsEnabled(): boolean {
  return flagEnabled("PILOTDECK_GOAL_STOP_CONDITIONS", false);
}

/**
 * /goal Feature 1: observe-only LLM second-pass verification. When ON (and the verification-pass
 * decision recommends it), the engine runs ONE short, fail-open model call to independently review
 * the delivered result and records the verdict as telemetry. It NEVER triggers repair or surfaces a
 * user bubble (observe-only). Default OFF; dev does NOT auto-enable it (real model cost).
 */
export function isVerificationLlmEnabled(): boolean {
  return flagEnabled("PILOTDECK_VERIFICATION_LLM", false);
}

/**
 * Goal Loop Phase 3: session-level deliverable manifest. Establishes stable delivery slots at
 * task start; drives expectedManifest, UI summary table, and repair missing sets. Default OFF.
 */
export function isSessionDeliverableManifestEnabled(): boolean {
  return flagEnabled("PILOTDECK_SESSION_DELIVERABLE_MANIFEST", false);
}

/**
 * STDA: system-assigned artifacts/task-{YYYYMMDD}-{id8}/ directory per goalVersion.
 * Default ON in SaaS mode; pairs with session deliverable manifest for four-line alignment.
 */
export function isSessionTaskDirectoryEnabled(): boolean {
  return flagEnabled("PILOTDECK_SESSION_TASK_DIRECTORY", isSaasModeDefault());
}

/**
 * STDA add/remove/replace: reuse primary task root instead of allocating a new artifacts/task-* dir.
 * Default ON in SaaS mode.
 */
export function isStdaAddPreserveRootEnabled(): boolean {
  return flagEnabled("PILOTDECK_STDA_ADD_PRESERVE_ROOT", isSaasModeDefault());
}

/**
 * SDM html slot fuzzy match: report-*.html satisfies legacy index.html slots (transition).
 */
export function isSdmHtmlSlotFuzzyEnabled(): boolean {
  return flagEnabled("PILOTDECK_SDM_HTML_SLOT_FUZZY", isSaasModeDefault());
}

/**
 * Recovery UX v2: actionable "continue" copy follows auto-continue; strip duplicate hints.
 * UI mirror: VITE_RECOVERY_SURFACE_V2. Dev default ON; production default OFF.
 */
export function isRecoverySurfaceV2Enabled(): boolean {
  return flagEnabled("PILOTDECK_RECOVERY_SURFACE_V2", false);
}

/** 终验收证书 v2：off | shadow | enforce（enforce 时 passed 须证书 complete） */
export function deliverableCertificateV2Mode(): "off" | "shadow" | "enforce" {
  const raw = readEnv("PILOTDECK_DELIVERABLE_CERTIFICATE_V2");
  if (raw == null) return "off";
  const value = raw.trim().toLowerCase();
  if (value === "shadow") return "shadow";
  if (value === "enforce" || value === "1" || value === "true" || value === "on") return "enforce";
  return "off";
}

/** PD-SAAS-FORK (0717 P0-2): strict contract-unit binding authority — off | shadow | enforce. */
export function contractAuthorityV2Mode(): "off" | "shadow" | "enforce" {
  const raw = readEnv("PILOTDECK_CONTRACT_AUTHORITY_V2");
  if (raw == null) return "off";
  const value = raw.trim().toLowerCase();
  if (value === "off" || value === "0" || value === "false") return "off";
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  return "off";
}

export function isContractAuthorityV2Enabled(): boolean {
  return contractAuthorityV2Mode() !== "off";
}

export function isContractAuthorityEnforced(): boolean {
  return contractAuthorityV2Mode() === "enforce";
}

export function isExportSnapshotV2Enabled(): boolean {
  return flagEnabled("PILOTDECK_EXPORT_SNAPSHOT_V2", false);
}

// PD-SAAS-FORK: P0-1 single tri-state capability-scope rollout with exact-slug canaries.
export function capabilityScopeV2Mode(): StabilityTriStateMode {
  return triStateFlagMode("PILOTDECK_CAPABILITY_SCOPE_V2");
}

function isCapabilityScopeV2CanarySlug(slug: string | undefined): boolean {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();
  if (!normalizedSlug) return false;
  const canarySlugs = String(readEnv("PILOTDECK_QUALITY_CANARY_SLUGS") ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return canarySlugs.length === 0 || canarySlugs.includes(normalizedSlug);
}

export function isCapabilityScopeV2EnforcedForSlug(slug: string | undefined): boolean {
  return capabilityScopeV2Mode() === "enforce" && isCapabilityScopeV2CanarySlug(slug);
}

export function isCapabilityScopeV2ShadowedForSlug(slug: string | undefined): boolean {
  return capabilityScopeV2Mode() === "shadow" && isCapabilityScopeV2CanarySlug(slug);
}

/** PD-SAAS-FORK P0-2: independent quality-contract persistence/enforcement mode. */
export function goalQualityContractMode(): StabilityTriStateMode {
  return triStateFlagMode("PILOTDECK_GOAL_QUALITY_CONTRACT");
}

/** PD-SAAS-FORK P0-6: one rollout key for official-media FSM and hard tool policy. */
export function officialMediaV2Mode(): StabilityTriStateMode {
  return triStateFlagMode("PILOTDECK_OFFICIAL_MEDIA_V2");
}

/** PD-SAAS-FORK P0-7: one rollout key for content-quality acceptance. */
export function contentQualityV2Mode(): StabilityTriStateMode {
  return triStateFlagMode("PILOTDECK_CONTENT_QUALITY_V2");
}

/** PD-SAAS-FORK VAP: Visual Asset Platform master switch. */
export function visualAssetPlatformMode(): StabilityTriStateMode {
  return triStateFlagMode("PILOTDECK_VISUAL_ASSET_PLATFORM");
}

export function isDiscoverVisualAssetsEnabled(): boolean {
  if (visualAssetPlatformMode() === "off") return false;
  return flagEnabled("PILOTDECK_DISCOVER_VISUAL_ASSETS", true);
}

export function isVisualAssetPrepEnabled(): boolean {
  if (visualAssetPlatformMode() === "off") return false;
  return flagEnabled("PILOTDECK_VISUAL_ASSET_PREP", true);
}

export function isAutoResolveVisualAssetsEnabled(): boolean {
  if (visualAssetPlatformMode() === "off") return false;
  return flagEnabled("PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS", true);
}

/** PD-SAAS-FORK VAP P0-B: deliverable visual binding audit (shadow/enforce). */
export function visualBindingAuditMode(): StabilityTriStateMode {
  if (visualAssetPlatformMode() === "off") return "off";
  return triStateFlagMode("PILOTDECK_VISUAL_BINDING_AUDIT");
}

/** PD-SAAS-FORK VAP P0-C: block premature visual deliverable writes. */
export function isVapBindBeforeWriteEnabled(): boolean {
  if (visualAssetPlatformMode() === "off") return false;
  return namedFlagEnabled("PILOTDECK_VAP_BIND_BEFORE_WRITE", false);
}

/**
 * PD-SAAS-FORK ES9 P0-F / workbench yield: linear 1→N stage gate.
 * Supports off | shadow | enforce; legacy `1`/`true`/`on` → enforce, `0` → off.
 */
export function sequentialDeliverablesMode(): StabilityTriStateMode {
  if (!isSessionDeliverableManifestEnabled()) return "off";
  const raw = readEnv("PILOTDECK_SEQUENTIAL_DELIVERABLES");
  if (raw == null) return "off";
  const value = raw.trim().toLowerCase();
  if (value === "shadow") return "shadow";
  if (value === "enforce" || value === "1" || value === "true" || value === "on") {
    return "enforce";
  }
  return "off";
}

/** True only in enforce (write gate active). */
export function isSequentialDeliverablesEnabled(): boolean {
  return sequentialDeliverablesMode() === "enforce";
}

/** Shadow: compute would-block + telemetry, do not block writes. */
export function isSequentialDeliverablesShadowEnabled(): boolean {
  return sequentialDeliverablesMode() === "shadow";
}

/** PD-SAAS-FORK workbench yield: synthetic must-deliver contract for SDM/model. */
export function deliverableBriefContractMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_DELIVERABLE_BRIEF_CONTRACT");
  if (raw == null) return isSaasModeDefault() ? "shadow" : "off";
  const value = raw.trim().toLowerCase();
  if (value === "shadow" || value === "1" || value === "true" || value === "on") {
    return "shadow";
  }
  if (value === "enforce") return "enforce";
  return "off";
}

/** PD-SAAS-FORK workbench yield: high-confidence free-text capabilityContext infer. */
export function inferCapabilityContextMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_INFER_CAPABILITY_CONTEXT");
  if (raw == null) return isSaasModeDefault() ? "shadow" : "off";
  const value = raw.trim().toLowerCase();
  if (value === "shadow" || value === "1" || value === "true" || value === "on") {
    return "shadow";
  }
  if (value === "enforce") return "enforce";
  return "off";
}

/** PD-SAAS-FORK workbench yield: Hub try-prompt structure density (gen-time). */
export function isTryPromptContractV2Enabled(): boolean {
  return namedFlagEnabled("PILOTDECK_TRY_PROMPT_CONTRACT_V2", true);
}

/** PD-SAAS-FORK ES9: geo/launch/IP checklist templates via deliverable-checklist-authority.json */
export function isChecklistAuthorityTemplatesEnabled(): boolean {
  return flagEnabled("PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES", isSaasModeDefault());
}

/** PD-SAAS-FORK ES9: plain report.html + landing↔index alias for html SDM slots */
export function isSdmHtmlReportAliasEnabled(): boolean {
  return flagEnabled("PILOTDECK_SDM_HTML_REPORT_ALIAS", isSaasModeDefault());
}

/** PD-SAAS-FORK ES9: pending required html slots veto research GT reconciled pass */
export function isResearchPassedGtStrictHtmlEnabled(): boolean {
  return flagEnabled("PILOTDECK_RESEARCH_PASSED_GT_STRICT_HTML", isSaasModeDefault());
}

/** PD-SAAS-FORK ES9: shadow gate — block assistant "task complete" when acceptance !== passed */
export function assistantCompletionGateMode(): "off" | "shadow" | "enforce" {
  const raw = readEnv("PILOTDECK_ASSISTANT_COMPLETION_GATE");
  if (raw == null) return isSaasModeDefault() ? "shadow" : "off";
  const value = raw.trim().toLowerCase();
  if (value === "off" || value === "0" || value === "false") return "off";
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  return "off";
}

export function isAssistantCompletionGateEnabled(): boolean {
  return assistantCompletionGateMode() !== "off";
}

/** PD-SAAS-FORK 0731: research-report docx slot accepts report-like Chinese/English basenames (not any unique docx). */
export function researchDocxBasenameFuzzyMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY");
  if (raw == null) return isSaasModeDefault() ? "shadow" : "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  if (value === "off" || value === "0" || value === "false") return "off";
  return "off";
}

/** PD-SAAS-FORK 0731: heal toxic authority_research-report_* → lite must-deliver (≤1/session). */
export function sdmHealResearchLiteMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_SDM_HEAL_RESEARCH_LITE");
  if (raw == null) return isSaasModeDefault() ? "shadow" : "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  if (value === "off" || value === "0" || value === "false") return "off";
  return "off";
}

/** PD-SAAS-FORK 0731: compile SDM for 深度蒸馏 goals. */
export function distillSdmMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_DISTILL_SDM");
  if (raw == null) return isSaasModeDefault() ? "shadow" : "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  if (value === "off" || value === "0" || value === "false") return "off";
  return "off";
}

/** PD-SAAS-FORK 0731: block silent html/pdf ADD on lite research sessions. */
export function blockSilentResearchAddMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_BLOCK_SILENT_RESEARCH_ADD");
  if (raw == null) return isSaasModeDefault() ? "shadow" : "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  if (value === "off" || value === "0" || value === "false") return "off";
  return "off";
}

/**
 * PD-SAAS-FORK 0731-fail-A: open HTML / PWA minimal SDM observation.
 * Default off — shadow only telemetry; this batch does not change compile return.
 */
export function openHtmlMinSdmMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_OPEN_HTML_MIN_SDM");
  if (raw == null) return "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  if (value === "off" || value === "0" || value === "false") return "off";
  return "off";
}

/** PD-SAAS-FORK: PPT intent routing + quality bar (native editable / Nova / doc→ppt). */
export function isPptExportDefaultPolicyEnabled(): boolean {
  return flagEnabled("PILOTDECK_PPT_EXPORT_DEFAULT_POLICY", isSaasModeDefault());
}

/** PD-SAAS-FORK full-chain-speed P0-2: parallel office export (off|shadow|enforce). */
export function parallelOfficeExportMode(): "off" | "shadow" | "enforce" {
  const raw = readEnv("PILOTDECK_PARALLEL_OFFICE_EXPORT");
  if (raw == null) return isSaasModeDefault() ? "shadow" : "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  return "off";
}

export function isParallelOfficeExportEnabled(): boolean {
  return parallelOfficeExportMode() !== "off";
}

/** PD-SAAS-FORK sticky-stage: observe-only stage ledger. Unset stays off; launcher/pack inject shadow. Enforce is P1. */
export function isTaskStageBudgetMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_TASK_STAGE_BUDGET");
  if (raw == null) return "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  return "off";
}

/** PD-SAAS-FORK: named-files vs imperative slides fuse. Unset stays off; launcher/pack inject shadow. */
export function isExpensiveIntentClarifyMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_EXPENSIVE_INTENT_CLARIFY");
  if (raw == null) return "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  return "off";
}

/** PD-SAAS-FORK: PDF/PPT mentions are not required kinds. Unset stays off; launcher/pack inject enforce. */
export function isKindMentionSanitizeMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_KIND_MENTION_SANITIZE");
  if (raw == null) return "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  return "off";
}

/** PD-SAAS-FORK speed-completion: parallel write_file (off|shadow|enforce). */
export function parallelWriteFileMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_PARALLEL_WRITE_FILE");
  if (raw == null) return "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  return "off";
}

/** PD-SAAS-FORK: formal-HTML morphology — shadow does not veto acceptance. */
export function htmlFormalAcceptanceMode(): StabilityTriStateMode {
  const raw = readEnv("PILOTDECK_HTML_FORMAL_ACCEPTANCE");
  if (raw == null) return "shadow";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "off" || value === "0" || value === "false") return "off";
  return "shadow";
}

/** PD-SAAS-FORK full-chain-speed P0-3: preserve write/export tools under autoOrch. */
export function isAutoorchPreserveDeliverableToolsEnabled(): boolean {
  return flagEnabled("PILOTDECK_AUTOORCH_PRESERVE_DELIVERABLE_TOOLS", true);
}

/** PD-SAAS-FORK full-chain-speed P1-1: max parallel Nova slide generate_image (0=off). */
export function novaSlideImageParallelLimit(): number {
  const raw = readEnv("PILOTDECK_NOVA_SLIDE_IMAGE_PARALLEL");
  if (raw == null) return isSaasModeDefault() ? 4 : 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** PD-SAAS-FORK full-chain-speed P1-3: HyperFrames missing Key degrade path. */
export function isHfKeyOptionalDegradeEnabled(): boolean {
  return flagEnabled("PILOTDECK_HF_KEY_OPTIONAL_DEGRADE", false);
}

/** PD-SAAS-FORK three-case RCA P0-A: bypass autoOrch for matrix/humanize/GEO full-case goals. */
export function isOrchBypassMatrixGeoEnabled(): boolean {
  return flagEnabled("PILOTDECK_ORCH_BYPASS_MATRIX_GEO", isSaasModeDefault());
}

/** PD-SAAS-FORK three-case RCA P1-A: matrix core slots satisfied → ground truth pass. */
export function isMatrixCoreGtPassEnabled(): boolean {
  return flagEnabled("PILOTDECK_MATRIX_CORE_GT_PASS", isSaasModeDefault());
}

/** PD-SAAS-FORK three-case RCA P1-B: GEO stage parallelGroup (off|shadow|enforce). */
export function parallelGeoStagesMode(): "off" | "shadow" | "enforce" {
  const raw = readEnv("PILOTDECK_PARALLEL_GEO_STAGES");
  if (raw == null) return isSaasModeDefault() ? "shadow" : "off";
  const value = raw.trim().toLowerCase();
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  return "off";
}

export function isParallelGeoStagesEnabled(): boolean {
  return parallelGeoStagesMode() !== "off";
}

/** PD-SAAS-FORK P0′-3: block agent/Task tools on deliverable-class sessions. */
export function isBlockDeliverableSubagentEnabled(): boolean {
  return flagEnabled("PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT", isSaasModeDefault());
}

/** PD-SAAS-FORK P0′-5: strict docx/png extension matching (off|shadow|enforce). */
export function officeExtensionStrictMode(): "off" | "shadow" | "enforce" {
  const raw = readEnv("PILOTDECK_OFFICE_EXTENSION_STRICT");
  if (raw == null) return isSaasModeDefault() ? "shadow" : "off";
  const value = raw.trim().toLowerCase();
  if (value === "off" || value === "0" || value === "false") return "off";
  if (value === "enforce") return "enforce";
  if (value === "shadow" || value === "1" || value === "true" || value === "on") return "shadow";
  return "off";
}

export function isOfficeExtensionStrictEnabled(): boolean {
  return officeExtensionStrictMode() !== "off";
}

/** PD-SAAS-FORK: default Chinese deliverable basenames aligned with task title unless English required. */
export function isDeliverableChineseFilenameDefaultEnabled(): boolean {
  return flagEnabled("PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT", isSaasModeDefault());
}

/** PD-SAAS-FORK Razer batch: Chinese GEO keyword filenames satisfy keywords.md/html slots. */
export function isSdmGeoKeywordAliasEnabled(): boolean {
  return flagEnabled("PILOTDECK_SDM_GEO_KEYWORD_ALIAS", isSaasModeDefault());
}

/** PD-SAAS-FORK Razer RCA 案1: Chinese audit/optimized/report filenames satisfy geo-fast-check slots. */
export function isSdmGeoFastCheckAliasEnabled(): boolean {
  return flagEnabled("PILOTDECK_SDM_GEO_FAST_CHECK_ALIAS", isSaasModeDefault());
}

/** PD-SAAS-FORK Razer batch: stop deliverable_repair when alias-satisfied slots all green. */
export function isRepairAliasShortCircuitEnabled(): boolean {
  return flagEnabled("PILOTDECK_REPAIR_ALIAS_SHORT_CIRCUIT", isSaasModeDefault());
}

/** PD-SAAS-FORK Razer batch: folder snapshot filters orphan html via SDM scope. */
export function isFolderSdmFilterEnabled(): boolean {
  return flagEnabled("PILOTDECK_FOLDER_SDM_FILTER", isSaasModeDefault());
}

/** PD-SAAS-FORK Razer batch: HF Hub try-prompt must not embed gateway-live templates. */
export function isHfTryPromptStrictEnabled(): boolean {
  return flagEnabled("PILOTDECK_HF_TRY_PROMPT_STRICT", isSaasModeDefault());
}

/** Snapshot of every stability flag, for telemetry / debug endpoints. */
export function stabilityFlagSnapshot(): Record<StabilityFlagName, boolean> {
  return {
    PILOTDECK_TRANSIENT_INVISIBLE: isTransientInvisibleEnabled(),
    PILOTDECK_COLD_RESUME: isColdResumeEnabled(),
    PILOTDECK_DEGENERATION_GUARD: isDegenerationGuardEnabled(),
    PILOTDECK_PROGRESS_BUDGET: isProgressBudgetEnabled(),
    PILOTDECK_COMPLETION_GATE: isCompletionGateEnabled(),
    PILOTDECK_PLAN_LEDGER: isPlanLedgerEnabled(),
    PILOTDECK_QUALITY_ACCEPT: isQualityAcceptEnabled(),
    PILOTDECK_TOOL_WATCHDOG: isToolWatchdogEnabled(),
    PILOTDECK_STREAM_DEGENERATION: isStreamDegenerationEnabled(),
    PILOTDECK_TOOL_RESULT_COMPACTION: isToolResultCompactionEnabled(),
    PILOTDECK_VERIFICATION_PASS: isVerificationPassEnabled(),
    PILOTDECK_GOAL_STOP_CONDITIONS: isGoalStopConditionsEnabled(),
    PILOTDECK_VERIFICATION_LLM: isVerificationLlmEnabled(),
    PILOTDECK_SESSION_DELIVERABLE_MANIFEST: isSessionDeliverableManifestEnabled(),
    PILOTDECK_SESSION_TASK_DIRECTORY: isSessionTaskDirectoryEnabled(),
    PILOTDECK_STDA_ADD_PRESERVE_ROOT: isStdaAddPreserveRootEnabled(),
    PILOTDECK_SDM_HTML_SLOT_FUZZY: isSdmHtmlSlotFuzzyEnabled(),
    PILOTDECK_RECOVERY_SURFACE_V2: isRecoverySurfaceV2Enabled(),
    PILOTDECK_DELIVERABLE_CERTIFICATE_V2: deliverableCertificateV2Mode() !== "off",
    PILOTDECK_CONTRACT_AUTHORITY_V2: isContractAuthorityV2Enabled(),
    PILOTDECK_FACTUAL_PREMISE_GUARD: factualPremiseGuardMode() !== "off",
    PILOTDECK_COMPOSITE_SLOT_QUALITY: compositeSlotQualityMode() !== "off",
    PILOTDECK_CAPABILITY_SCOPE_V2: capabilityScopeV2Mode() === "enforce",
    PILOTDECK_GOAL_QUALITY_CONTRACT: goalQualityContractMode() !== "off",
    PILOTDECK_OFFICIAL_MEDIA_V2: officialMediaV2Mode() !== "off",
    PILOTDECK_CONTENT_QUALITY_V2: contentQualityV2Mode() !== "off",
    PILOTDECK_EXPORT_SNAPSHOT_V2: isExportSnapshotV2Enabled(),
    PILOTDECK_VISUAL_ASSET_PLATFORM: visualAssetPlatformMode() !== "off",
    PILOTDECK_DISCOVER_VISUAL_ASSETS: isDiscoverVisualAssetsEnabled(),
    PILOTDECK_VISUAL_ASSET_PREP: isVisualAssetPrepEnabled(),
    PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS: isAutoResolveVisualAssetsEnabled(),
    PILOTDECK_VISUAL_BINDING_AUDIT: visualBindingAuditMode() !== "off",
    PILOTDECK_VAP_BIND_BEFORE_WRITE: isVapBindBeforeWriteEnabled(),
    PILOTDECK_SEQUENTIAL_DELIVERABLES: isSequentialDeliverablesEnabled(),
    PILOTDECK_DELIVERABLE_BRIEF_CONTRACT: deliverableBriefContractMode() !== "off",
    PILOTDECK_INFER_CAPABILITY_CONTEXT: inferCapabilityContextMode() !== "off",
    PILOTDECK_TRY_PROMPT_CONTRACT_V2: isTryPromptContractV2Enabled(),
    PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES: isChecklistAuthorityTemplatesEnabled(),
    PILOTDECK_SDM_HTML_REPORT_ALIAS: isSdmHtmlReportAliasEnabled(),
    PILOTDECK_RESEARCH_PASSED_GT_STRICT_HTML: isResearchPassedGtStrictHtmlEnabled(),
    PILOTDECK_ASSISTANT_COMPLETION_GATE: isAssistantCompletionGateEnabled(),
    PILOTDECK_PPT_EXPORT_DEFAULT_POLICY: isPptExportDefaultPolicyEnabled(),
    PILOTDECK_PARALLEL_OFFICE_EXPORT: isParallelOfficeExportEnabled(),
    PILOTDECK_PARALLEL_WRITE_FILE: parallelWriteFileMode() === "enforce",
    PILOTDECK_HTML_FORMAL_ACCEPTANCE: htmlFormalAcceptanceMode() === "enforce",
    PILOTDECK_AUTOORCH_PRESERVE_DELIVERABLE_TOOLS: isAutoorchPreserveDeliverableToolsEnabled(),
    PILOTDECK_NOVA_SLIDE_IMAGE_PARALLEL: novaSlideImageParallelLimit() > 0,
    PILOTDECK_HF_KEY_OPTIONAL_DEGRADE: isHfKeyOptionalDegradeEnabled(),
    PILOTDECK_ORCH_BYPASS_MATRIX_GEO: isOrchBypassMatrixGeoEnabled(),
    PILOTDECK_MATRIX_CORE_GT_PASS: isMatrixCoreGtPassEnabled(),
    PILOTDECK_PARALLEL_GEO_STAGES: isParallelGeoStagesEnabled(),
    PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT: isBlockDeliverableSubagentEnabled(),
    PILOTDECK_OFFICE_EXTENSION_STRICT: isOfficeExtensionStrictEnabled(),
    PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT: isDeliverableChineseFilenameDefaultEnabled(),
    PILOTDECK_SDM_GEO_KEYWORD_ALIAS: isSdmGeoKeywordAliasEnabled(),
    PILOTDECK_SDM_GEO_FAST_CHECK_ALIAS: isSdmGeoFastCheckAliasEnabled(),
    PILOTDECK_REPAIR_ALIAS_SHORT_CIRCUIT: isRepairAliasShortCircuitEnabled(),
    PILOTDECK_FOLDER_SDM_FILTER: isFolderSdmFilterEnabled(),
    PILOTDECK_HF_TRY_PROMPT_STRICT: isHfTryPromptStrictEnabled(),
    PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY: researchDocxBasenameFuzzyMode() !== "off",
    PILOTDECK_SDM_HEAL_RESEARCH_LITE: sdmHealResearchLiteMode() !== "off",
    PILOTDECK_DISTILL_SDM: distillSdmMode() !== "off",
    PILOTDECK_BLOCK_SILENT_RESEARCH_ADD: blockSilentResearchAddMode() !== "off",
    PILOTDECK_OPEN_HTML_MIN_SDM: openHtmlMinSdmMode() !== "off",
    PILOTDECK_TASK_STAGE_BUDGET: isTaskStageBudgetMode() !== "off",
    PILOTDECK_EXPENSIVE_INTENT_CLARIFY: isExpensiveIntentClarifyMode() !== "off",
    PILOTDECK_KIND_MENTION_SANITIZE: isKindMentionSanitizeMode() !== "off",
  };
}
