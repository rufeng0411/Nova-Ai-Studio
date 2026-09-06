import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AgentContextRuntime } from "../../context/ContextRuntime.js";
import type {
  CanonicalMessage,
  CanonicalModelEvent,
  CanonicalModelRequest,
} from "../../model/index.js";
import type { AgentEvent } from "../protocol/events.js";
import type { AgentRuntimeConfig } from "../runtime/AgentRuntimeConfig.js";
import type {
  AgentRouterRuntime,
  AgentRuntimeDependencies,
} from "../runtime/AgentRuntimeDependencies.js";
import type {
  AgentTurnAcceptanceMetaTranscriptEntry,
} from "../../session/transcript/TranscriptEntry.js";
import {
  ToolRegistry,
  type PilotDeckToolScheduler,
} from "../../tool/index.js";
import type { RouterDecision } from "../../router/index.js";
import { loadStabilityEvents } from "../../telemetry/stabilityEvents.js";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import { validateEngineDeliverables } from "../deliverables/validateDeliverablesEngine.js";
import { AgentLoop, type AgentLoopInput } from "./AgentLoop.js";

const TASK_DIR = "artifacts/video-pack";
const HTML_PATH = `${TASK_DIR}/storyboard.html`;
const SCRIPT_PATH = `${TASK_DIR}/script.md`;
const VIDEO_PATH = `${TASK_DIR}/video.mp4`;

const decision: RouterDecision = {
  provider: "test-provider",
  model: "test-model",
  scenarioType: "default",
  isSubagent: false,
  orchestrating: false,
  resolvedFrom: "fallback",
  mutations: {},
};

const scheduler: PilotDeckToolScheduler = {
  async executeAll() {
    return [];
  },
};

function modelEvents(text: string): CanonicalModelEvent[] {
  return [
    { type: "message_start", role: "assistant" },
    { type: "text_delta", text },
    { type: "usage", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
    { type: "message_end", finishReason: "stop" },
  ];
}

function manifest(options: { repairCircuitTripped?: boolean } = {}): SessionDeliverableManifest {
  return {
    manifestVersion: 1,
    goalVersion: 1,
    sessionGoalAnchor: [
      "请用 Seedance 制作三项视频成果并保存到指定路径：",
      `1. ${HTML_PATH}`,
      `2. ${SCRIPT_PATH}`,
      `3. ${VIDEO_PATH}`,
    ].join("\n"),
    profileId: "video-mp4",
    baselineLocked: true,
    taskArtifactDir: TASK_DIR,
    repairCircuit: options.repairCircuitTripped
      ? { gapCounts: { [VIDEO_PATH]: 3 }, totalRepairs: 3, tripped: true }
      : undefined,
    slots: [
      {
        id: "storyboard",
        label: "分镜网页",
        kind: "html",
        required: true,
        pathHint: HTML_PATH,
        status: "active",
      },
      {
        id: "script",
        label: "视频脚本",
        kind: "markdown",
        required: true,
        pathHint: SCRIPT_PATH,
        status: "active",
      },
      {
        id: "video",
        label: "成片",
        kind: "video",
        required: true,
        pathHint: VIDEO_PATH,
        status: "active",
      },
    ],
  };
}

function goalMessage(): CanonicalMessage {
  return {
    role: "user",
    content: [{ type: "text", text: manifest().sessionGoalAnchor }],
  };
}

function priorDeliveredMessage(): CanonicalMessage {
  return {
    role: "assistant",
    content: [{
      type: "text",
      text: `阶段成果：${HTML_PATH}\n${SCRIPT_PATH}`,
    }],
  };
}

async function writeArtifact(cwd: string, relativePath: string, content: string | Buffer) {
  const absolutePath = join(cwd, ...relativePath.split("/"));
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

function createContext(capturedAppends: Array<string | undefined>): AgentContextRuntime {
  return {
    async prepareForModel(input) {
      capturedAppends.push(input.appendSystemPrompt);
      return {
        messages: input.messages,
        systemPrompt: input.appendSystemPrompt,
        systemPromptParts: input.appendSystemPrompt ? [input.appendSystemPrompt] : [],
        tools: input.tools,
        diagnostics: [],
        boundaries: [],
      };
    },
  };
}

function createRouter(
  text: string,
  requests: CanonicalModelRequest[],
  decisions: CanonicalModelRequest[],
): AgentRouterRuntime {
  const execute = (
    _decision: RouterDecision,
    request: CanonicalModelRequest,
  ): AsyncIterable<CanonicalModelEvent> => {
    requests.push(request);
    return (async function* streamEvents() {
      for (const event of modelEvents(text)) yield event;
    })();
  };
  return {
    async decide(input) {
      decisions.push(input.request);
      return decision;
    },
    execute,
    stream(request) {
      return execute(decision, request);
    },
  };
}

function runtime(
  cwd: string,
  text: string,
  capturedAppends: Array<string | undefined>,
  requests: CanonicalModelRequest[],
  decisions: CanonicalModelRequest[],
): AgentLoop {
  const config: AgentRuntimeConfig = {
    provider: "test-provider",
    model: "test-model",
    cwd,
    permissionMode: "default",
    permissionContext: { cwd },
    promptLanguage: "zh-CN",
  };
  const dependencies: AgentRuntimeDependencies = {
    router: createRouter(text, requests, decisions),
    tools: {
      registry: new ToolRegistry(),
      scheduler,
    },
    context: createContext(capturedAppends),
    now: () => new Date(),
  };
  return new AgentLoop(config, dependencies);
}

async function runLoop(input: {
  cwd: string;
  text?: string;
  messages?: CanonicalMessage[];
  sessionManifest?: SessionDeliverableManifest | null;
  stopAfterRepair?: boolean;
}) {
  const requests: CanonicalModelRequest[] = [];
  const decisions: CanonicalModelRequest[] = [];
  const capturedAppends: Array<string | undefined> = [];
  const acceptanceMeta: Array<Omit<
    AgentTurnAcceptanceMetaTranscriptEntry,
    "type" | "sessionId" | "turnId" | "sequence" | "createdAt" | "entryId"
  >> = [];
  const events: AgentEvent[] = [];
  const loop = runtime(
    input.cwd,
    input.text ?? "当前阶段处理完毕。",
    capturedAppends,
    requests,
    decisions,
  );
  const loopInput: AgentLoopInput = {
    sessionId: "session-p1",
    turnId: "turn-p1",
    messages: input.messages ?? [goalMessage(), priorDeliveredMessage()],
    maxTurns: 4,
    sessionDeliverableManifest: input.sessionManifest === null
      ? undefined
      : input.sessionManifest ?? manifest(),
    sessionTaskDirectory: {
      taskArtifactDir: TASK_DIR,
      taskDirKey: "video-pack",
      goalVersion: 1,
      allocatedAt: "2026-07-18T00:00:00.000Z",
    },
    onTurnAcceptanceMeta(meta) {
      acceptanceMeta.push(meta);
    },
  };

  for await (const event of loop.run(loopInput)) {
    events.push(event);
    if (
      input.stopAfterRepair
      && event.type === "turn_continued"
      && event.reason === "acceptance_failed"
    ) {
      break;
    }
  }
  return { events, acceptanceMeta, requests, decisions, capturedAppends };
}

function repairEvents(events: AgentEvent[]): AgentEvent[] {
  return events.filter(
    (event) => event.type === "turn_continued" && event.reason === "acceptance_failed",
  );
}

describe("AgentLoop P1 strict acceptance continuation", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "pilotdeck-agent-loop-p1-"));
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_COMPLETION_GATE = "1";
    process.env.PILOTDECK_VERIFICATION_PASS = "1";
    process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2 = "enforce";
    process.env.PILOTDECK_CONTRACT_AUTHORITY_V2 = "enforce";
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "off";
    await writeArtifact(
      cwd,
      HTML_PATH,
      `<!doctype html><html><body>${"storyboard".repeat(80)}</body></html>`,
    );
    await writeArtifact(cwd, SCRIPT_PATH, "视频脚本正文。".repeat(100));
  });

  afterEach(async () => {
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    delete process.env.PILOTDECK_COMPLETION_GATE;
    delete process.env.PILOTDECK_VERIFICATION_PASS;
    delete process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2;
    delete process.env.PILOTDECK_CONTRACT_AUTHORITY_V2;
    delete process.env.PILOTDECK_CONTENT_QUALITY_V2;
    delete process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET;
    delete process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET_LIMIT;
    delete process.env.PILOTDECK_FACTUAL_PREMISE_GUARD;
    delete process.env.PILOTDECK_STABILITY_LOG;
    await rm(cwd, { recursive: true, force: true });
  });

  it("uses the existing engine owner to repair a 2/3 video contract", async () => {
    const result = await runLoop({ cwd, stopAfterRepair: true });

    expect(repairEvents(result.events)).toHaveLength(1);
    expect(result.acceptanceMeta.at(-1)).toMatchObject({
      finality: "draft",
      acceptanceStatus: "needs_repair",
      continuationOwner: "deliverable_repair",
      missingPaths: [VIDEO_PATH],
    });
    expect(result.acceptanceMeta.at(-1)?.acceptanceCertificate).toBeUndefined();
  });

  it("stops when all 3/3 video contract units are complete", async () => {
    const video = Buffer.alloc(20 * 1_024, 1);
    video.set(Buffer.from("\x00\x00\x00\x18ftypmp42", "latin1"), 0);
    await writeArtifact(cwd, VIDEO_PATH, video);
    const result = await runLoop({ cwd });

    expect(repairEvents(result.events)).toHaveLength(0);
    expect(result.acceptanceMeta.at(-1)).toMatchObject({
      finality: "final",
      acceptanceStatus: "passed",
      completionState: "complete",
      continuationOwner: "none",
      missingPaths: [],
    });
    expect(result.acceptanceMeta.at(-1)?.acceptanceCertificate).toMatchObject({
      strictAcceptanceStatus: "passed",
      completionState: "complete",
      requiredDone: 3,
      requiredTotal: 3,
    });
  });

  it("does not repair while an irreplaceable user blocker is active", async () => {
    const result = await runLoop({
      cwd,
      text: "缺少必要 API Key，请提供 API Key 后才能生成视频。",
    });

    expect(repairEvents(result.events)).toHaveLength(0);
    expect(result.events.some((event) => event.type === "turn_completed")).toBe(true);
  });

  it("does not repair after explicit user completion acknowledgement", async () => {
    const acknowledgedMessages: CanonicalMessage[] = [
      goalMessage(),
      priorDeliveredMessage(),
      {
        role: "user",
        content: [{ type: "text", text: "这些已完成，可以了。" }],
      },
    ];
    const directValidation = await validateEngineDeliverables({
      cwd,
      userGoal: manifest().sessionGoalAnchor,
      messages: acknowledgedMessages,
      sessionManifest: manifest(),
    });
    expect(directValidation.acceptance).toBe("needs_repair");
    expect(directValidation.userAcknowledgedPartial).toBe(true);

    const result = await runLoop({
      cwd,
      messages: acknowledgedMessages,
    });

    expect(repairEvents(result.events)).toHaveLength(0);
    expect(result.acceptanceMeta.at(-1)).toMatchObject({
      finality: "final",
      acceptanceStatus: "passed",
      completionState: "accepted_partial",
      continuationOwner: "none",
      partialReason: "user_acknowledged",
    });
  });

  it("does not repair after the session repair circuit trips", async () => {
    const result = await runLoop({
      cwd,
      sessionManifest: manifest({ repairCircuitTripped: true }),
    });

    expect(repairEvents(result.events)).toHaveLength(0);
    expect(result.acceptanceMeta.at(-1)).toMatchObject({
      finality: "final",
      acceptanceStatus: "failed",
      completionState: "blocked",
      blockedReasonType: "system_exhausted",
      continuationOwner: "none",
      circuitBreakerTripped: true,
    });
    expect(result.acceptanceMeta.at(-1)?.acceptanceCertificate).toMatchObject({
      completionState: "blocked",
      acceptanceStatus: "failed",
    });
  });

  it("does not repair after the session synthetic budget is exhausted", async () => {
    process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET = "1";
    process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET_LIMIT = "2";
    const synthetic = (turn: number): CanonicalMessage => ({
      role: "user",
      content: [{ type: "text", text: `<task-resume>repair ${turn}</task-resume>` }],
      metadata: { synthetic: true, purpose: "deliverable_repair" },
    });
    const result = await runLoop({
      cwd,
      messages: [
        goalMessage(),
        {
          ...priorDeliveredMessage(),
          metadata: {
            verifiedPaths: [HTML_PATH, SCRIPT_PATH],
            missingPaths: [VIDEO_PATH],
          },
        },
        synthetic(1),
        synthetic(2),
      ],
    });

    expect(repairEvents(result.events)).toHaveLength(0);
    expect(result.acceptanceMeta.at(-1)).toMatchObject({
      finality: "final",
      acceptanceStatus: "failed",
      completionState: "blocked",
      blockedReasonType: "system_exhausted",
      continuationOwner: "none",
    });
  });
});

describe("AgentLoop P1 factual premise prompt integration", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "pilotdeck-factual-p1-"));
  });

  afterEach(async () => {
    delete process.env.PILOTDECK_FACTUAL_PREMISE_GUARD;
    delete process.env.PILOTDECK_STABILITY_LOG;
    await rm(cwd, { recursive: true, force: true });
  });

  it("changes only the system append and leaves model messages/tools routing unchanged", async () => {
    const goal: CanonicalMessage = {
      role: "user",
      content: [{
        type: "text",
        text: "脑暴：假设近期微软已完成收购 Anthropic，会有哪些机会？",
      }],
    };

    process.env.PILOTDECK_FACTUAL_PREMISE_GUARD = "off";
    const off = await runLoop({
      cwd,
      messages: [goal],
      sessionManifest: null,
    });
    process.env.PILOTDECK_FACTUAL_PREMISE_GUARD = "enforce";
    const enforce = await runLoop({
      cwd,
      messages: [goal],
      sessionManifest: null,
    });

    expect(enforce.capturedAppends[0]?.split("\n")[0]).toBe("以下按假设推演。");
    expect(enforce.requests[0]?.messages).toEqual(off.requests[0]?.messages);
    expect(enforce.requests[0]?.tools).toEqual(off.requests[0]?.tools);
    expect(enforce.decisions[0]?.messages).toEqual(off.decisions[0]?.messages);
    expect(enforce.decisions[0]?.tools).toEqual(off.decisions[0]?.tools);
  });

  it("records a bounded assessment without user text or secrets", async () => {
    const logPath = join(cwd, "stability-events.jsonl");
    process.env.PILOTDECK_STABILITY_LOG = logPath;
    process.env.PILOTDECK_FACTUAL_PREMISE_GUARD = "shadow";
    await runLoop({
      cwd,
      messages: [{
        role: "user",
        content: [{
          type: "text",
          text: "调研近期微软宣布收购 Anthropic 的来源，内部令牌 sk-secret-123",
        }],
      }],
      sessionManifest: null,
    });

    let events = await loadStabilityEvents(logPath);
    for (let attempt = 0; attempt < 10 && events.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      events = await loadStabilityEvents(logPath);
    }
    const assessed = events.find((event) => event.event === "factual_premise_assessed");
    expect(assessed).toMatchObject({
      reason: "announced",
      detail: {
        mode: "shadow",
        taskMode: "research",
        requiresSource: true,
      },
    });
    const serialized = JSON.stringify(assessed);
    expect(serialized).not.toContain("Anthropic");
    expect(serialized).not.toContain("sk-secret-123");
    expect(serialized.length).toBeLessThan(500);
  });
});
