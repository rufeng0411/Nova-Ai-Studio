import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildCapabilityBindingAppendPrompt } from "../../src/saas/capabilityBindingPrompt.js";
import { resolveProfile } from "../../src/saas/deliverableCapabilityProfiles.js";
import * as stabilityFlags from "../../src/saas/resilience/stabilityFlags.js";
import { resolveContinuationAction } from "../../src/saas/taskContinuationPolicy.js";
import { compileSessionDeliverableManifest } from "../../src/saas/taskState/sessionDeliverableManifest.js";
import { buildTaskGoalContract } from "../../src/saas/taskState/taskGoalContract.js";

type CapabilityCompletionModeModule = {
  resolveCapabilityCompletionMode(input: {
    capabilityContext?: { slug?: string };
    userText: string;
  }): "consultation" | "report" | undefined;
  isToolAllowedForCapabilityCompletionMode(
    toolName: string,
    mode: "consultation" | "report" | undefined,
  ): boolean;
};

type CapabilityScopeFlagModule = typeof stabilityFlags & {
  capabilityScopeV2Mode?: () => "off" | "shadow" | "enforce";
  isCapabilityScopeV2EnforcedForSlug?: (slug: string | undefined) => boolean;
};

const buildScopedCapabilityBindingPrompt = buildCapabilityBindingAppendPrompt as unknown as (
  context: { slug: string; displayName: string },
  options: { completionMode: "consultation" | "report" },
) => string;

const ENV_KEYS = [
  "PILOTDECK_CAPABILITY_SCOPE_V2",
  "PILOTDECK_QUALITY_CANARY_SLUGS",
  "PILOTDECK_SESSION_DELIVERABLE_MANIFEST",
] as const;

async function loadCompletionModeModule(): Promise<CapabilityCompletionModeModule | null> {
  const moduleUrl = new URL(
    "../../src/saas/intent/capabilityCompletionMode.ts",
    import.meta.url,
  ).href;
  try {
    return await import(/* @vite-ignore */ moduleUrl) as CapabilityCompletionModeModule;
  } catch {
    return null;
  }
}

describe("P0-1 capability scope v2", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.PILOTDECK_CAPABILITY_SCOPE_V2 = "enforce";
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("resolves completion mode from the exact capability and current user input", async () => {
    const completionMode = await loadCompletionModeModule();
    expect(completionMode).not.toBeNull();
    if (!completionMode) return;

    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "ala-strategy-advisor" },
      userText: "请分析一下这个品牌接下来应该怎么走",
    })).toBe("consultation");
    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "ala-strategy-advisor" },
      userText: "请生成一份战略报告",
    })).toBe("report");
    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "ala-strategy-advisor" },
      userText: "保存为 north-star.html",
    })).toBe("report");
    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "ala-strategy-advisor" },
      userText: "请分析附件 input.pdf 的战略信息",
    })).toBe("consultation");
    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "ala-strategy-advisor" },
      userText: "我需要了解竞品文件里的策略",
    })).toBe("consultation");
    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "ala-strategy-advisor" },
      userText: "给我看看竞品文件里的策略",
    })).toBe("consultation");
    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "ala-strategy-advisor" },
      userText: "<task-resume><user_goal>请生成战略报告 competitor.md</user_goal></task-resume>",
    })).toBe("consultation");
    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "mkt-last30days" },
      userText: "分析近 30 天热点",
    })).toBe("report");
    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "mkt-last30days-extra" },
      userText: "分析近 30 天热点",
    })).toBeUndefined();

    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "ala-fact-checker" },
      userText: "帮我核查这条新闻是否属实",
    })).toBe("consultation");
    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "ala-fact-checker" },
      userText: "须交付：output.md，写入系统分配任务目录，核查 LV 大秀事实",
    })).toBe("report");

    expect(completionMode.isToolAllowedForCapabilityCompletionMode("web_search", "consultation")).toBe(true);
    expect(completionMode.isToolAllowedForCapabilityCompletionMode("read_file", "consultation")).toBe(true);
    expect(completionMode.isToolAllowedForCapabilityCompletionMode("write_file", "consultation")).toBe(false);
    expect(completionMode.isToolAllowedForCapabilityCompletionMode("bash", "consultation")).toBe(false);
  });

  it.each([
    "产出一份战略报告",
    "产出 competitor.md",
    "导出 competitor.md",
    "交付 competitor.md",
  ])("treats explicit output request %s as report mode", async (userText) => {
    const completionMode = await loadCompletionModeModule();
    expect(completionMode).not.toBeNull();
    if (!completionMode) return;

    expect(completionMode.resolveCapabilityCompletionMode({
      capabilityContext: { slug: "ala-strategy-advisor" },
      userText,
    })).toBe("report");
  });

  it.each([
    "产出 competitor.md",
    "导出 competitor.md",
    "交付 competitor.md",
  ])("keeps the explicit output basename for %s", (userText) => {
    const manifest = compileSessionDeliverableManifest({
      userGoal: userText,
      capabilitySlug: "ala-strategy-advisor",
      majorCategory: "office",
      completionMode: "report",
    });
    expect(manifest?.slots).toHaveLength(1);
    expect(manifest?.slots[0]?.pathHint).toBe("competitor.md");
  });

  it("enforces only exact canary slugs", () => {
    const flags = stabilityFlags as CapabilityScopeFlagModule;
    expect(typeof flags.capabilityScopeV2Mode).toBe("function");
    expect(typeof flags.isCapabilityScopeV2EnforcedForSlug).toBe("function");
    if (!flags.capabilityScopeV2Mode || !flags.isCapabilityScopeV2EnforcedForSlug) return;

    process.env.PILOTDECK_QUALITY_CANARY_SLUGS = "mkt-last30days";
    expect(flags.capabilityScopeV2Mode()).toBe("enforce");
    expect(flags.isCapabilityScopeV2EnforcedForSlug("mkt-last30days")).toBe(true);
    expect(flags.isCapabilityScopeV2EnforcedForSlug("mkt-last30days-extra")).toBe(false);
    expect(flags.isCapabilityScopeV2EnforcedForSlug("ala-strategy-advisor")).toBe(false);

    process.env.PILOTDECK_CAPABILITY_SCOPE_V2 = "shadow";
    expect(flags.capabilityScopeV2Mode()).toBe("shadow");
    expect(flags.isCapabilityScopeV2EnforcedForSlug("mkt-last30days")).toBe(false);
  });

  it("keeps mkt-last30days on one authoritative slot by default", () => {
    const profile = resolveProfile(
      "mkt-last30days",
      "marketing",
      "分析近 30 天热点",
    );
    expect(profile.id).toBe("last30days");
    expect(profile.requiredBasenameGroups).toEqual([["marketing-deliverable.md"]]);

    const contract = buildTaskGoalContract({
      userGoal: "用 last30days 分析最近热点",
      capabilitySlug: "mkt-last30days",
      majorCategory: "marketing",
      profileId: profile.id,
    });
    expect(contract.requiredFiles).not.toContain("01-topics.md");
    expect(contract.requiredFiles).not.toContain("02-longform.md");
    expect(contract.requiredFiles).not.toContain("03-social-slices.md");

    const manifest = compileSessionDeliverableManifest({
      userGoal: "用 last30days 分析最近热点",
      capabilitySlug: "mkt-last30days",
      majorCategory: "marketing",
    });
    expect(manifest?.slots).toHaveLength(1);
    expect(manifest?.slots[0]?.pathHint).toBe("marketing-deliverable.md");
  });

  it("restores the legacy broad contract when the single scope switch is off", () => {
    process.env.PILOTDECK_CAPABILITY_SCOPE_V2 = "off";
    const profile = resolveProfile(
      "mkt-last30days",
      "marketing",
      "用 last30days 分析最近热点",
    );
    expect(profile.id).toBe("content");

    const manifest = compileSessionDeliverableManifest({
      userGoal: "用 last30days 分析最近热点",
      capabilitySlug: "mkt-last30days",
      majorCategory: "marketing",
    });
    expect(manifest?.slots.map((slot) => slot.pathHint)).toEqual([
      "01-topics.md",
      "02-longform.md",
      "03-social-slices.md",
    ]);
  });

  it("uses the explicit last30days basename without adding fallback slots", () => {
    const manifest = compileSessionDeliverableManifest({
      userGoal: "分析最近热点。须交付：korea-trends.html。写入系统分配任务目录。",
      capabilitySlug: "mkt-last30days",
      majorCategory: "marketing",
    });
    expect(manifest?.slots).toHaveLength(1);
    expect(manifest?.slots[0]?.pathHint).toBe("korea-trends.html");
  });

  it("preserves the explicit three-file content-flywheel contract", () => {
    const byName = compileSessionDeliverableManifest({
      userGoal: "运行 content-flywheel，生成完整三文件内容矩阵",
      capabilitySlug: "mkt-last30days",
      majorCategory: "marketing",
    });
    expect(byName?.slots.map((slot) => slot.pathHint)).toEqual([
      "01-topics.md",
      "02-longform.md",
      "03-social-slices.md",
    ]);

    const byBasenames = compileSessionDeliverableManifest({
      userGoal: "须交付：01-topics.md、02-longform.md、03-social-slices.md。写入系统分配任务目录。",
      capabilitySlug: "mkt-last30days",
      majorCategory: "marketing",
    });
    expect(byBasenames?.slots.map((slot) => slot.pathHint)).toEqual([
      "01-topics.md",
      "02-longform.md",
      "03-social-slices.md",
    ]);

    const oneNamedLegacyFile = compileSessionDeliverableManifest({
      userGoal: "请只生成 01-topics.md",
      capabilitySlug: "mkt-last30days",
      majorCategory: "marketing",
    });
    expect(oneNamedLegacyFile?.slots.map((slot) => slot.pathHint)).toEqual([
      "01-topics.md",
    ]);
  });

  it("compiles strategy advisor only in report mode", () => {
    const consultation = compileSessionDeliverableManifest({
      userGoal: "请分析一下这个品牌接下来应该怎么走",
      capabilitySlug: "ala-strategy-advisor",
      majorCategory: "office",
      completionMode: "consultation",
    } as Parameters<typeof compileSessionDeliverableManifest>[0] & {
      completionMode: "consultation";
    });
    expect(consultation).toBeNull();

    const report = compileSessionDeliverableManifest({
      userGoal: "请生成一份战略报告",
      capabilitySlug: "ala-strategy-advisor",
      majorCategory: "office",
      completionMode: "report",
    } as Parameters<typeof compileSessionDeliverableManifest>[0] & {
      completionMode: "report";
    });
    expect(report?.slots).toHaveLength(1);
    expect(report?.slots[0]?.pathHint).toBe("strategy-report.md");

    const explicit = compileSessionDeliverableManifest({
      userGoal: "请生成战略报告。须交付：north-star.html。写入系统分配任务目录。",
      capabilitySlug: "ala-strategy-advisor",
      majorCategory: "office",
      completionMode: "report",
    } as Parameters<typeof compileSessionDeliverableManifest>[0] & {
      completionMode: "report";
    });
    expect(explicit?.slots).toHaveLength(1);
    expect(explicit?.slots[0]?.pathHint).toBe("north-star.html");

    const plainBasename = compileSessionDeliverableManifest({
      userGoal: "请把结论保存为 north-star.html",
      capabilitySlug: "ala-strategy-advisor",
      majorCategory: "office",
      completionMode: "report",
    } as Parameters<typeof compileSessionDeliverableManifest>[0] & {
      completionMode: "report";
    });
    expect(plainBasename?.slots).toHaveLength(1);
    expect(plainBasename?.slots[0]?.pathHint).toBe("north-star.html");

    const basenameOnly = compileSessionDeliverableManifest({
      userGoal: "competitor.md",
      capabilitySlug: "ala-strategy-advisor",
      majorCategory: "office",
      completionMode: "report",
    } as Parameters<typeof compileSessionDeliverableManifest>[0] & {
      completionMode: "report";
    });
    expect(basenameOnly?.slots).toHaveLength(1);
    expect(basenameOnly?.slots[0]?.pathHint).toBe("competitor.md");

    const attachmentIsNotOutput = compileSessionDeliverableManifest({
      userGoal: "请生成基于附件 input.pdf 的战略报告",
      capabilitySlug: "ala-strategy-advisor",
      majorCategory: "office",
      completionMode: "report",
    } as Parameters<typeof compileSessionDeliverableManifest>[0] & {
      completionMode: "report";
    });
    expect(attachmentIsNotOutput?.slots).toHaveLength(1);
    expect(attachmentIsNotOutput?.slots[0]?.pathHint).toBe("strategy-report.md");
  });

  it("suppresses repair and auto-continuation for strategy consultation", () => {
    const action = resolveContinuationAction({
      userGoal: "请分析品牌战略",
      assistantText: "下面是我的建议。",
      capabilitySlug: "ala-strategy-advisor",
      completionMode: "consultation",
      planningOrSetupStop: true,
      validationResult: {
        verified: [],
        missing: ["strategy-report.md"],
        broken: [],
        acceptance: "needs_repair",
      },
    } as Parameters<typeof resolveContinuationAction>[0] & {
      completionMode: "consultation";
    });
    expect(action).toBe("none");
  });

  it("adds exact-slug prompt constraints without inventing a second contract", () => {
    const consultation = buildScopedCapabilityBindingPrompt(
      { slug: "ala-strategy-advisor", displayName: "战略顾问" },
      { completionMode: "consultation" },
    );
    expect(consultation).toContain("咨询模式");
    expect(consultation).toContain("不得创建任务文件");

    const report = buildScopedCapabilityBindingPrompt(
      { slug: "ala-strategy-advisor", displayName: "战略顾问" },
      { completionMode: "report" },
    );
    expect(report).toContain("报告模式");
    expect(report).toContain("strategy-report.md");

    const last30days = buildScopedCapabilityBindingPrompt(
      { slug: "mkt-last30days", displayName: "近 30 天热点" },
      { completionMode: "report" },
    );
    expect(last30days).toContain("只生成一个成果");
    expect(last30days).toContain("marketing-deliverable.md");
  });
});
