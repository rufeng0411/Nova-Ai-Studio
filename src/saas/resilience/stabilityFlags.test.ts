import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compositeSlotQualityMode,
  contentQualityV2Mode,
  factualPremiseGuardMode,
  goalQualityContractMode,
  isColdResumeEnabled,
  isCompletionGateEnabled,
  isDegenerationGuardEnabled,
  isGoalStopConditionsEnabled,
  isPlanLedgerEnabled,
  isProgressBudgetEnabled,
  isQualityAcceptEnabled,
  isStreamDegenerationEnabled,
  isToolResultCompactionEnabled,
  isToolWatchdogEnabled,
  isTransientInvisibleEnabled,
  isVerificationLlmEnabled,
  isSdmHtmlSlotFuzzyEnabled,
  isVerificationPassEnabled,
  officialMediaV2Mode,
  isTaskStageBudgetMode,
  isExpensiveIntentClarifyMode,
  isKindMentionSanitizeMode,
  stabilityFlagSnapshot,
  type StabilityFlagName,
} from "./stabilityFlags.js";

const FLAGS: StabilityFlagName[] = [
  "PILOTDECK_TRANSIENT_INVISIBLE",
  "PILOTDECK_COLD_RESUME",
  "PILOTDECK_DEGENERATION_GUARD",
  "PILOTDECK_PROGRESS_BUDGET",
  "PILOTDECK_COMPLETION_GATE",
  "PILOTDECK_PLAN_LEDGER",
  "PILOTDECK_QUALITY_ACCEPT",
  "PILOTDECK_TOOL_WATCHDOG",
  "PILOTDECK_STREAM_DEGENERATION",
  "PILOTDECK_TOOL_RESULT_COMPACTION",
  "PILOTDECK_VERIFICATION_PASS",
  "PILOTDECK_GOAL_STOP_CONDITIONS",
  "PILOTDECK_VERIFICATION_LLM",
  "PILOTDECK_SESSION_DELIVERABLE_MANIFEST",
  "PILOTDECK_SESSION_TASK_DIRECTORY",
  "PILOTDECK_STDA_ADD_PRESERVE_ROOT",
  "PILOTDECK_SDM_HTML_SLOT_FUZZY",
  "PILOTDECK_RECOVERY_SURFACE_V2",
  "PILOTDECK_DELIVERABLE_CERTIFICATE_V2",
  "PILOTDECK_CONTRACT_AUTHORITY_V2",
  "PILOTDECK_FACTUAL_PREMISE_GUARD",
  "PILOTDECK_COMPOSITE_SLOT_QUALITY",
  "PILOTDECK_CAPABILITY_SCOPE_V2",
  "PILOTDECK_GOAL_QUALITY_CONTRACT",
  "PILOTDECK_OFFICIAL_MEDIA_V2",
  "PILOTDECK_CONTENT_QUALITY_V2",
  "PILOTDECK_EXPORT_SNAPSHOT_V2",
  "PILOTDECK_TASK_STAGE_BUDGET",
  "PILOTDECK_EXPENSIVE_INTENT_CLARIFY",
  "PILOTDECK_KIND_MENTION_SANITIZE",
];

const ALL_OFF: Partial<Record<StabilityFlagName, boolean>> = {
  PILOTDECK_TRANSIENT_INVISIBLE: false,
  PILOTDECK_COLD_RESUME: false,
  PILOTDECK_DEGENERATION_GUARD: false,
  PILOTDECK_PROGRESS_BUDGET: false,
  PILOTDECK_COMPLETION_GATE: false,
  PILOTDECK_PLAN_LEDGER: false,
  PILOTDECK_QUALITY_ACCEPT: false,
  PILOTDECK_TOOL_WATCHDOG: false,
  PILOTDECK_STREAM_DEGENERATION: false,
  PILOTDECK_TOOL_RESULT_COMPACTION: false,
  PILOTDECK_VERIFICATION_PASS: false,
  PILOTDECK_GOAL_STOP_CONDITIONS: false,
  PILOTDECK_VERIFICATION_LLM: false,
  PILOTDECK_SESSION_DELIVERABLE_MANIFEST: false,
  PILOTDECK_SESSION_TASK_DIRECTORY: false,
  PILOTDECK_STDA_ADD_PRESERVE_ROOT: false,
  PILOTDECK_SDM_HTML_SLOT_FUZZY: false,
  PILOTDECK_RECOVERY_SURFACE_V2: false,
  PILOTDECK_DELIVERABLE_CERTIFICATE_V2: false,
  PILOTDECK_CONTRACT_AUTHORITY_V2: false,
  PILOTDECK_FACTUAL_PREMISE_GUARD: false,
  PILOTDECK_COMPOSITE_SLOT_QUALITY: false,
  PILOTDECK_CAPABILITY_SCOPE_V2: false,
  PILOTDECK_GOAL_QUALITY_CONTRACT: false,
  PILOTDECK_OFFICIAL_MEDIA_V2: false,
  PILOTDECK_CONTENT_QUALITY_V2: false,
  PILOTDECK_EXPORT_SNAPSHOT_V2: false,
  PILOTDECK_TASK_STAGE_BUDGET: false,
  PILOTDECK_EXPENSIVE_INTENT_CLARIFY: false,
  PILOTDECK_KIND_MENTION_SANITIZE: false,
};

describe("stabilityFlags", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const flag of FLAGS) {
      saved[flag] = process.env[flag];
      delete process.env[flag];
    }
  });

  afterEach(() => {
    for (const flag of FLAGS) {
      if (saved[flag] === undefined) delete process.env[flag];
      else process.env[flag] = saved[flag];
    }
  });

  it("defaults every flag to OFF when unset (production-safe deploy)", () => {
    expect(isTransientInvisibleEnabled()).toBe(false);
    expect(isColdResumeEnabled()).toBe(false);
    expect(isDegenerationGuardEnabled()).toBe(false);
    expect(isProgressBudgetEnabled()).toBe(false);
    expect(isCompletionGateEnabled()).toBe(false);
    expect(isPlanLedgerEnabled()).toBe(false);
    expect(isQualityAcceptEnabled()).toBe(false);
    expect(isToolWatchdogEnabled()).toBe(false);
    expect(isStreamDegenerationEnabled()).toBe(false);
    expect(isToolResultCompactionEnabled()).toBe(false);
    expect(isVerificationPassEnabled()).toBe(false);
    expect(isGoalStopConditionsEnabled()).toBe(false);
    expect(isVerificationLlmEnabled()).toBe(false);
    expect(factualPremiseGuardMode()).toBe("off");
    expect(compositeSlotQualityMode()).toBe("off");
    expect(goalQualityContractMode()).toBe("off");
    expect(officialMediaV2Mode()).toBe("off");
    expect(contentQualityV2Mode()).toBe("off");
    expect(stabilityFlagSnapshot()).toMatchObject(ALL_OFF);
    expect(stabilityFlagSnapshot().PILOTDECK_PARALLEL_WRITE_FILE).toBe(false);
    expect(stabilityFlagSnapshot().PILOTDECK_HTML_FORMAL_ACCEPTANCE).toBe(false);
    expect(isTaskStageBudgetMode()).toBe("off");
    expect(stabilityFlagSnapshot().PILOTDECK_TASK_STAGE_BUDGET).toBe(false);
    expect(isExpensiveIntentClarifyMode()).toBe("off");
    expect(stabilityFlagSnapshot().PILOTDECK_EXPENSIVE_INTENT_CLARIFY).toBe(false);
    expect(isKindMentionSanitizeMode()).toBe("off");
    expect(stabilityFlagSnapshot().PILOTDECK_KIND_MENTION_SANITIZE).toBe(false);
  });

  it("treats task stage budget 1/shadow as shadow and keeps enforce explicit", () => {
    process.env.PILOTDECK_TASK_STAGE_BUDGET = "shadow";
    expect(isTaskStageBudgetMode()).toBe("shadow");
    process.env.PILOTDECK_TASK_STAGE_BUDGET = "1";
    expect(isTaskStageBudgetMode()).toBe("shadow");
    process.env.PILOTDECK_TASK_STAGE_BUDGET = "enforce";
    expect(isTaskStageBudgetMode()).toBe("enforce");
    process.env.PILOTDECK_TASK_STAGE_BUDGET = "off";
    expect(isTaskStageBudgetMode()).toBe("off");
  });

  it("treats expensive intent clarify 1/shadow as shadow and keeps enforce explicit", () => {
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "shadow";
    expect(isExpensiveIntentClarifyMode()).toBe("shadow");
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "1";
    expect(isExpensiveIntentClarifyMode()).toBe("shadow");
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "true";
    expect(isExpensiveIntentClarifyMode()).toBe("shadow");
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "enforce";
    expect(isExpensiveIntentClarifyMode()).toBe("enforce");
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "off";
    expect(isExpensiveIntentClarifyMode()).toBe("off");
  });

  it("treats kind mention sanitize 1/shadow as shadow and keeps enforce explicit", () => {
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "shadow";
    expect(isKindMentionSanitizeMode()).toBe("shadow");
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "1";
    expect(isKindMentionSanitizeMode()).toBe("shadow");
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "true";
    expect(isKindMentionSanitizeMode()).toBe("shadow");
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "enforce";
    expect(isKindMentionSanitizeMode()).toBe("enforce");
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "off";
    expect(isKindMentionSanitizeMode()).toBe("off");
  });

  it("treats 1 / true / on (any case, with whitespace) as enabled", () => {
    for (const value of ["1", "true", "on", "TRUE", " On ", "\tyes-typo"]) {
      process.env.PILOTDECK_COLD_RESUME = value;
      // "yes-typo" is not a recognized truthy token -> falls back to OFF
      const expected = ["1", "true", "on", "true", "on"].includes(value.trim().toLowerCase());
      expect(isColdResumeEnabled()).toBe(expected);
    }
  });

  it("treats 0 / false / off as a hard kill switch", () => {
    for (const value of ["0", "false", "off", "OFF", " False "]) {
      process.env.PILOTDECK_DEGENERATION_GUARD = value;
      expect(isDegenerationGuardEnabled()).toBe(false);
    }
  });

  it("falls back to OFF for unrecognized values", () => {
    process.env.PILOTDECK_COMPLETION_GATE = "maybe";
    expect(isCompletionGateEnabled()).toBe(false);
  });

  it("flags are independent of one another", () => {
    process.env.PILOTDECK_TRANSIENT_INVISIBLE = "1";
    process.env.PILOTDECK_PROGRESS_BUDGET = "1";
    process.env.PILOTDECK_PLAN_LEDGER = "1";
    process.env.PILOTDECK_VERIFICATION_PASS = "1";
    expect(stabilityFlagSnapshot()).toMatchObject({
      ...ALL_OFF,
      PILOTDECK_TRANSIENT_INVISIBLE: true,
      PILOTDECK_PROGRESS_BUDGET: true,
      PILOTDECK_PLAN_LEDGER: true,
      PILOTDECK_VERIFICATION_PASS: true,
    });
  });

  it("each new P1/P2 flag toggles on independently", () => {
    process.env.PILOTDECK_QUALITY_ACCEPT = "1";
    expect(isQualityAcceptEnabled()).toBe(true);
    process.env.PILOTDECK_TOOL_WATCHDOG = "true";
    expect(isToolWatchdogEnabled()).toBe(true);
    process.env.PILOTDECK_STREAM_DEGENERATION = "on";
    expect(isStreamDegenerationEnabled()).toBe(true);
    process.env.PILOTDECK_TOOL_RESULT_COMPACTION = "1";
    expect(isToolResultCompactionEnabled()).toBe(true);
  });

  it("toggles the /goal flags independently", () => {
    process.env.PILOTDECK_GOAL_STOP_CONDITIONS = "1";
    expect(isGoalStopConditionsEnabled()).toBe(true);
    expect(isVerificationLlmEnabled()).toBe(false);
    process.env.PILOTDECK_VERIFICATION_LLM = "true";
    expect(isVerificationLlmEnabled()).toBe(true);
  });

  it("reports Contract Authority shadow mode as enabled in the flag snapshot", () => {
    process.env.PILOTDECK_CONTRACT_AUTHORITY_V2 = "shadow";

    expect(stabilityFlagSnapshot().PILOTDECK_CONTRACT_AUTHORITY_V2).toBe(true);
  });

  it("keeps P1 tri-state flags independent from each other and P0 flags", () => {
    process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2 = "enforce";
    process.env.PILOTDECK_CONTRACT_AUTHORITY_V2 = "enforce";
    expect(factualPremiseGuardMode()).toBe("off");
    expect(compositeSlotQualityMode()).toBe("off");

    process.env.PILOTDECK_FACTUAL_PREMISE_GUARD = "shadow";
    expect(factualPremiseGuardMode()).toBe("shadow");
    expect(compositeSlotQualityMode()).toBe("off");

    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "enforce";
    expect(factualPremiseGuardMode()).toBe("shadow");
    expect(compositeSlotQualityMode()).toBe("enforce");
  });

  it("keeps content and official-media quality rollout independent", () => {
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "enforce";
    process.env.PILOTDECK_OFFICIAL_MEDIA_V2 = "shadow";

    expect(contentQualityV2Mode()).toBe("enforce");
    expect(officialMediaV2Mode()).toBe("shadow");
    expect(stabilityFlagSnapshot()).toMatchObject({
      PILOTDECK_CONTENT_QUALITY_V2: true,
      PILOTDECK_OFFICIAL_MEDIA_V2: true,
    });
  });

  it("isSdmHtmlSlotFuzzyEnabled does not throw when import.meta.env is undefined (Gateway/tsx)", () => {
    delete process.env.PILOTDECK_SDM_HTML_SLOT_FUZZY;
    delete process.env.PILOTDECK_SAAS_MODE;
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
    const savedEnv = meta.env;
    try {
      meta.env = undefined;
      expect(() => isSdmHtmlSlotFuzzyEnabled()).not.toThrow();
      expect(isSdmHtmlSlotFuzzyEnabled()).toBe(false);
      process.env.PILOTDECK_SAAS_MODE = "1";
      expect(isSdmHtmlSlotFuzzyEnabled()).toBe(true);
    } finally {
      meta.env = savedEnv;
    }
  });
});
