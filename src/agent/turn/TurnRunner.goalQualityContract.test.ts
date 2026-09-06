import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CanonicalMessage } from "../../model/index.js";
import type { AgentLoop } from "../loop/AgentLoop.js";
import type { AgentTurnResult } from "../protocol/result.js";
import type {
  SessionGoalQualityContract,
} from "../../saas/constraints/goalQualityContract.js";
import type {
  BoundedQualityShadowDiff,
  QualityContractMode,
} from "../../saas/constraints/qualityCanaryPolicy.js";
import type {
  TrustedExecutionScope,
} from "../../saas/constraints/capabilityScopeContract.js";
import type { AgentTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";
import { JsonlTranscriptWriter } from "../../session/transcript/JsonlTranscriptWriter.js";
import { TurnRunner } from "./TurnRunner.js";

type CapturedQualityLoopInput = {
  messages: CanonicalMessage[];
  trustedExecutionScope?: TrustedExecutionScope;
  sessionGoalQualityContract?: SessionGoalQualityContract;
  qualityContractHash?: string;
  qualityContractMode?: QualityContractMode;
  qualityContractShadowDiff?: BoundedQualityShadowDiff;
  trustedUserExplicitUrls?: string[];
};

function successResult(): AgentTurnResult {
  const now = "2026-07-19T00:00:00.000Z";
  return {
    type: "success",
    sessionId: "session-quality-runner",
    turnId: "turn-quality-runner",
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

async function consume(
  runner: TurnRunner,
  trustedExecutionScope: TrustedExecutionScope,
): Promise<Array<{ type: string; [key: string]: unknown }>> {
  const events: Array<{ type: string; [key: string]: unknown }> = [];
  const stream = runner.run({
    sessionId: "session-quality-runner",
    turnId: "turn-quality-runner",
    messages: [],
    input: {
      type: "text",
      text: [
        "制作鸣镝 G700 的 6 页 PPT，输出 presentation.pptx。",
        "只用品牌官方图片，禁止 AI 生图。",
        "官方素材页：https://brand.example.com/product?campaign=spring",
      ].join("\n"),
    },
    capabilityContext: {
      slug: "nova-ppt-aesthetic-slides",
      displayName: "Nova 美学幻灯",
    },
    trustedExecutionScope,
  } as Parameters<TurnRunner["run"]>[0]);
  for await (const event of stream) {
    events.push(event as { type: string; [key: string]: unknown });
  }
  return events;
}

async function transcriptEntries(path: string): Promise<AgentTranscriptEntry[]> {
  const raw = await readFile(path, "utf8");
  return raw
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AgentTranscriptEntry);
}

describe("TurnRunner goal-quality contract integration", () => {
  let directory = "";
  let transcriptPath = "";
  let writer: JsonlTranscriptWriter;
  let captured: CapturedQualityLoopInput[] = [];
  let runner: TurnRunner;
  const envKeys = [
    "PILOTDECK_GOAL_QUALITY_CONTRACT",
    "PILOTDECK_GOAL_QUALITY_CANARY_SLUGS",
    "PILOTDECK_GOAL_QUALITY_CANARY_TENANTS",
    "PILOTDECK_SESSION_DELIVERABLE_MANIFEST",
    "PILOTDECK_SESSION_TASK_DIRECTORY",
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const key of envKeys) savedEnv[key] = process.env[key];
    process.env.PILOTDECK_GOAL_QUALITY_CONTRACT = "shadow";
    process.env.PILOTDECK_GOAL_QUALITY_CANARY_SLUGS =
      "nova-ppt-aesthetic-slides";
    process.env.PILOTDECK_GOAL_QUALITY_CANARY_TENANTS = "tenant-alpha";
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_SESSION_TASK_DIRECTORY = "0";

    directory = await mkdtemp(join(tmpdir(), "turn-quality-contract-"));
    transcriptPath = join(directory, "session.jsonl");
    writer = new JsonlTranscriptWriter({ path: transcriptPath });
    captured = [];
    const loop = {
      async *run(input: CapturedQualityLoopInput) {
        captured.push(input);
        const result = successResult();
        yield {
          type: "turn_completed",
          sessionId: result.sessionId,
          turnId: result.turnId,
          result,
        };
        return { result, messages: input.messages };
      },
    } as unknown as AgentLoop;
    runner = new TurnRunner(
      loop,
      writer,
      undefined,
      () => new Date("2026-07-19T00:00:00.000Z"),
      undefined,
      { cwd: process.cwd(), transcriptPath },
    );
  });

  afterEach(async () => {
    for (const key of envKeys) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it("passes one recovered shadow contract and trusted scope before the model loop", async () => {
    await consume(runner, {
      tenantScopeId: "tenant-alpha",
      principalScopeId: "user-alpha",
    });
    const entries = await transcriptEntries(transcriptPath);
    const qualityRows = entries.filter(
      (entry) => entry.type === "session_goal_quality_contract",
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]?.trustedExecutionScope).toEqual({
      tenantScopeId: "tenant-alpha",
      principalScopeId: "user-alpha",
    });
    expect(captured[0]?.qualityContractMode).toBe("shadow");
    expect(captured[0]?.sessionGoalQualityContract).toMatchObject({
      subjectAnchor: "鸣镝 G700",
      officialMediaPolicy: "official_only",
      forbidGenerateImage: true,
    });
    expect(captured[0]?.qualityContractHash).toMatch(/^qgc1:[a-f0-9]{64}$/u);
    expect(captured[0]?.qualityContractShadowDiff?.fields).toContain(
      "official_media",
    );
    expect(captured[0]?.trustedUserExplicitUrls).toEqual([
      "https://brand.example.com/product?campaign=spring",
    ]);
    expect(JSON.stringify(captured[0]?.qualityContractShadowDiff)).not.toContain(
      "鸣镝",
    );
    expect(qualityRows).toHaveLength(1);
  });

  it("selects nobody when the trusted tenant does not exactly match", async () => {
    await consume(runner, {
      tenantScopeId: "tenant-beta",
      principalScopeId: "user-beta",
    });
    const entries = await transcriptEntries(transcriptPath);

    expect(captured).toHaveLength(1);
    expect(captured[0]?.qualityContractMode).toBe("off");
    expect(captured[0]?.sessionGoalQualityContract).toBeUndefined();
    expect(entries.some(
      (entry) => entry.type === "session_goal_quality_contract",
    )).toBe(false);
  });

  it("stops before model execution when the selected persistence barrier fails", async () => {
    vi.spyOn(writer, "recordSessionGoalQualityContract").mockRejectedValueOnce(
      new Error("simulated append failure"),
    );
    const events = await consume(runner, {
      tenantScopeId: "tenant-alpha",
      principalScopeId: "user-alpha",
    });

    expect(captured).toHaveLength(0);
    expect(events.some((event) => event.type === "turn_failed")).toBe(true);
    expect(JSON.stringify(events)).toContain("agent_transcript_error");
  });
});
