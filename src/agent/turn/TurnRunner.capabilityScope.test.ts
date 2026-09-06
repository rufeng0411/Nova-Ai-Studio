import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalMessage } from "../../model/index.js";
import type { AgentTranscriptWriter } from "../../session/transcript/TranscriptWriter.js";
import type { AgentLoop } from "../loop/AgentLoop.js";
import type { AgentTurnResult } from "../protocol/result.js";
import { loadStabilityEvents } from "../../telemetry/stabilityEvents.js";
import { TurnRunner } from "./TurnRunner.js";

type CapturedLoopInput = {
  capabilityCompletionMode?: "consultation" | "report";
  sessionDeliverableManifest?: {
    profileId?: string;
    slots: Array<{ pathHint?: string }>;
  };
  sessionTaskDirectory?: {
    taskArtifactDir: string;
  };
  messages: CanonicalMessage[];
};

function makeSuccessResult(sessionId: string, turnId: string): AgentTurnResult {
  const now = "2026-07-19T00:00:00.000Z";
  return {
    type: "success",
    sessionId,
    turnId,
    finalMessage: {
      role: "assistant",
      content: [{ type: "text", text: "完成" }],
    },
    stopReason: "completed",
    usage: {},
    permissionDenials: [],
    turns: 1,
    startedAt: now,
    completedAt: now,
  };
}

function createHarness(options?: { transcriptPath?: string }) {
  const captured: CapturedLoopInput[] = [];
  const manifests: Array<{ slots: Array<{ pathHint?: string }> }> = [];
  const directories: Array<{ taskArtifactDir: string }> = [];

  const loop = {
    async *run(input: CapturedLoopInput) {
      captured.push(input);
      const result = makeSuccessResult("session-capability-scope", "turn-capability-scope");
      yield {
        type: "turn_completed",
        sessionId: result.sessionId,
        turnId: result.turnId,
        result,
      };
      return { result, messages: input.messages };
    },
  } as unknown as AgentLoop;

  const transcript: AgentTranscriptWriter = {
    recordAcceptedInput() {},
    recordDurableMessage() {},
    recordTurnResult() {},
    recordSessionDeliverableManifest(_sessionId, _turnId, manifest) {
      manifests.push(manifest);
    },
    recordSessionTaskDirectory(_sessionId, _turnId, directory) {
      directories.push(directory);
    },
  };

  return {
    captured,
    manifests,
    directories,
    runner: new TurnRunner(
      loop,
      transcript,
      undefined,
      () => new Date("2026-07-19T00:00:00.000Z"),
      undefined,
      { cwd: process.cwd(), transcriptPath: options?.transcriptPath ?? "" },
    ),
  };
}

async function consumeRun(runner: TurnRunner, input: {
  userText: string;
  capabilityContext: Record<string, unknown>;
}): Promise<void> {
  const stream = runner.run({
    sessionId: "session-capability-scope",
    turnId: "turn-capability-scope",
    messages: [],
    input: { type: "text", text: input.userText },
    capabilityContext: input.capabilityContext,
  } as Parameters<TurnRunner["run"]>[0]);
  for await (const _event of stream) {
    // Consume the complete turn.
  }
}

describe("TurnRunner capability scope v2", () => {
  const keys = [
    "PILOTDECK_CAPABILITY_SCOPE_V2",
    "PILOTDECK_QUALITY_CANARY_SLUGS",
    "PILOTDECK_SESSION_DELIVERABLE_MANIFEST",
    "PILOTDECK_SESSION_TASK_DIRECTORY",
    "PILOTDECK_STABILITY_LOG",
  ] as const;
  const saved: Record<string, string | undefined> = {};
  const tempDirs: string[] = [];

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
    }
    process.env.PILOTDECK_CAPABILITY_SCOPE_V2 = "enforce";
    process.env.PILOTDECK_QUALITY_CANARY_SLUGS = "mkt-last30days,ala-strategy-advisor";
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_SESSION_TASK_DIRECTORY = "1";
  });

  afterEach(() => {
    for (const key of keys) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps strategy consultation fileless on the real TurnRunner path", async () => {
    const harness = createHarness();
    await consumeRun(harness.runner, {
      userText: "请分析这个品牌下一步的战略选择",
      capabilityContext: {
        slug: "ala-strategy-advisor",
        displayName: "战略顾问",
        source: "capability_hub",
      },
    });

    expect(harness.captured).toHaveLength(1);
    expect(harness.captured[0]?.capabilityCompletionMode).toBe("consultation");
    expect(harness.captured[0]?.sessionDeliverableManifest).toBeUndefined();
    expect(harness.captured[0]?.sessionTaskDirectory).toBeUndefined();
    expect(harness.manifests).toHaveLength(0);
    expect(harness.directories).toHaveLength(0);
  });

  it("anchors strategy report to one slot in the current task directory", async () => {
    const harness = createHarness();
    await consumeRun(harness.runner, {
      userText: "请生成一份战略报告",
      capabilityContext: {
        slug: "ala-strategy-advisor",
        displayName: "战略顾问",
        source: "capability_hub",
      },
    });

    expect(harness.captured).toHaveLength(1);
    const input = harness.captured[0];
    expect(input?.capabilityCompletionMode).toBe("report");
    expect((input?.sessionDeliverableManifest as { completionMode?: string } | undefined)?.completionMode)
      .toBe("report");
    expect(input?.sessionDeliverableManifest?.slots).toHaveLength(1);
    expect(input?.sessionDeliverableManifest?.slots[0]?.pathHint).toMatch(
      /^artifacts\/task-20260719-[a-z0-9]{8}\/strategy-report\.md$/,
    );
    expect(input?.sessionTaskDirectory?.taskArtifactDir).toMatch(
      /^artifacts\/task-20260719-[a-z0-9]{8}$/,
    );
  });

  it("keeps an incomplete strategy report in report mode for a continuation-only turn", async () => {
    const dir = mkdtempSync(join(tmpdir(), "capability-scope-resume-"));
    tempDirs.push(dir);
    const transcriptPath = join(dir, "session.jsonl");
    const taskArtifactDir = "artifacts/task-20260719-report001";
    const priorManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "请生成战略报告并保存为 competitor.md",
      slots: [{
        id: "required_file_1",
        label: "competitor.md",
        kind: "markdown",
        pathHint: "competitor.md",
        required: true,
        status: "active",
      }],
      profileId: "default",
      capabilitySlug: "ala-strategy-advisor",
      completionMode: "report",
      compiledAtTurnId: "turn-initial",
      taskArtifactDir,
      taskDirKey: "report001",
    };
    writeFileSync(transcriptPath, [
      JSON.stringify({
        type: "session_deliverable_manifest",
        sessionId: "session-capability-scope",
        turnId: "turn-initial",
        sequence: 1,
        createdAt: "2026-07-19T00:00:00.000Z",
        manifest: priorManifest,
      }),
      JSON.stringify({
        type: "session_task_directory",
        sessionId: "session-capability-scope",
        turnId: "turn-initial",
        sequence: 2,
        createdAt: "2026-07-19T00:00:01.000Z",
        taskArtifactDir,
        taskDirKey: "report001",
        goalVersion: 1,
        allocatedAt: "2026-07-19T00:00:01.000Z",
      }),
    ].join("\n") + "\n", "utf8");

    const harness = createHarness({ transcriptPath });
    await consumeRun(harness.runner, {
      userText: "继续",
      capabilityContext: {
        slug: "ala-strategy-advisor",
        displayName: "战略顾问",
        source: "capability_hub",
      },
    });

    expect(harness.captured).toHaveLength(1);
    const input = harness.captured[0];
    expect(input?.capabilityCompletionMode).toBe("report");
    expect(input?.sessionDeliverableManifest?.slots[0]?.pathHint).toBe("competitor.md");
    expect(input?.sessionTaskDirectory?.taskArtifactDir).toBe(taskArtifactDir);
    expect((input?.sessionDeliverableManifest as typeof priorManifest | undefined)?.sessionGoalAnchor)
      .toBe("请生成战略报告并保存为 competitor.md");
    expect(JSON.stringify(input?.sessionDeliverableManifest)).not.toContain("<task-resume>");

    const resumeHarness = createHarness({ transcriptPath });
    await consumeRun(resumeHarness.runner, {
      userText: "<task-resume><user_goal>请生成另一份战略报告 leaked.md</user_goal></task-resume>",
      capabilityContext: {
        slug: "ala-strategy-advisor",
        displayName: "战略顾问",
        source: "capability_hub",
      },
    });
    const resumeInput = resumeHarness.captured[0];
    expect(resumeInput?.capabilityCompletionMode).toBe("report");
    expect(resumeInput?.sessionDeliverableManifest?.slots[0]?.pathHint).toBe("competitor.md");
    expect((resumeInput?.sessionDeliverableManifest as typeof priorManifest | undefined)?.sessionGoalAnchor)
      .toBe("请生成战略报告并保存为 competitor.md");
    expect(JSON.stringify(resumeInput?.sessionDeliverableManifest)).not.toContain("leaked.md");
  });

  it("does not inherit a prior report for a new strategy consultation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "capability-scope-consult-"));
    tempDirs.push(dir);
    const transcriptPath = join(dir, "session.jsonl");
    writeFileSync(transcriptPath, `${JSON.stringify({
      type: "session_deliverable_manifest",
      sessionId: "session-capability-scope",
      turnId: "turn-initial",
      sequence: 1,
      createdAt: "2026-07-19T00:00:00.000Z",
      manifest: {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: "请生成战略报告",
        slots: [{
          id: "required_file_1",
          label: "strategy-report.md",
          pathHint: "strategy-report.md",
          required: true,
          status: "active",
        }],
        capabilitySlug: "ala-strategy-advisor",
        completionMode: "report",
      },
    })}\n`, "utf8");

    const harness = createHarness({ transcriptPath });
    await consumeRun(harness.runner, {
      userText: "请分析当前战略选择有哪些利弊",
      capabilityContext: {
        slug: "ala-strategy-advisor",
        displayName: "战略顾问",
        source: "capability_hub",
      },
    });

    expect(harness.captured[0]?.capabilityCompletionMode).toBe("consultation");
    expect(harness.captured[0]?.sessionDeliverableManifest).toBeUndefined();
    expect(harness.captured[0]?.sessionTaskDirectory).toBeUndefined();
  });

  it("does not bootstrap a strategy report from a task-resume envelope without session SDM", async () => {
    const harness = createHarness();
    await consumeRun(harness.runner, {
      userText: "<task-resume><user_goal>请生成战略报告 competitor.md</user_goal></task-resume>",
      capabilityContext: {
        slug: "ala-strategy-advisor",
        displayName: "战略顾问",
        source: "capability_hub",
      },
    });

    expect(harness.captured[0]?.capabilityCompletionMode).toBe("consultation");
    expect(harness.captured[0]?.sessionDeliverableManifest).toBeUndefined();
    expect(harness.captured[0]?.sessionTaskDirectory).toBeUndefined();
  });

  it("records one bounded text-free shadow comparison without changing legacy behavior", async () => {
    const dir = mkdtempSync(join(tmpdir(), "capability-scope-shadow-"));
    tempDirs.push(dir);
    const logPath = join(dir, "stability-events.jsonl");
    process.env.PILOTDECK_CAPABILITY_SCOPE_V2 = "shadow";
    process.env.PILOTDECK_QUALITY_CANARY_SLUGS = "mkt-last30days";
    process.env.PILOTDECK_STABILITY_LOG = logPath;

    const harness = createHarness();
    await consumeRun(harness.runner, {
      userText: "用 last30days 分析最近热点 SENSITIVE_SHADOW_TEXT_123",
      capabilityContext: {
        slug: "mkt-last30days",
        displayName: "近 30 天热点",
        source: "capability_hub",
        majorCategory: "marketing",
      },
    });

    expect(harness.captured[0]?.capabilityCompletionMode).toBeUndefined();
    expect(harness.captured[0]?.sessionDeliverableManifest?.profileId).toBe("content");
    expect(harness.captured[0]?.sessionDeliverableManifest?.slots).toHaveLength(3);

    let events = await loadStabilityEvents(logPath);
    for (let attempt = 0; attempt < 20 && events.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      events = await loadStabilityEvents(logPath);
    }
    const shadowEvents = events.filter((event) => event.event === "capability_scope_shadow");
    expect(shadowEvents).toHaveLength(1);
    expect(shadowEvents[0]).toMatchObject({
      reason: "mkt-last30days",
      detail: {
        slug: "mkt-last30days",
        legacyCompletionMode: "unset",
        proposedCompletionMode: "report",
        legacyProfileId: "content",
        proposedProfileId: "last30days",
        legacySlotCount: 3,
        proposedSlotCount: 1,
        completionModeChanged: true,
        profileChanged: true,
        slotCountChanged: true,
      },
    });
    const serialized = JSON.stringify(shadowEvents[0]);
    expect(serialized).not.toContain("SENSITIVE_SHADOW_TEXT_123");
    expect(serialized.length).toBeLessThan(700);
  });
});
