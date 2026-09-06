import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CanonicalMessage } from "../../model/index.js";
import {
  compileSessionGoalQualityContract,
  computeGoalQualityContractHash,
} from "../../saas/constraints/goalQualityContract.js";
import {
  bootstrapSessionDeliverableManifest,
} from "./bootstrapSessionDeliverableManifest.js";
import {
  bootstrapSessionGoalQualityContract,
  computeQualityUserGoalHash,
  resolveLatestSessionGoalQualityContractFromEntries,
} from "./bootstrapSessionGoalQualityContract.js";
import type {
  AgentSessionGoalQualityContractTranscriptEntry,
  AgentTranscriptEntry,
} from "./TranscriptEntry.js";
import { JsonlTranscriptWriter } from "./JsonlTranscriptWriter.js";

function userMessage(text: string): CanonicalMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
  };
}

async function readEntries(path: string): Promise<AgentTranscriptEntry[]> {
  const raw = await readFile(path, "utf8");
  return raw
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AgentTranscriptEntry);
}

async function recordAccepted(
  writer: JsonlTranscriptWriter,
  turnId: string,
  text: string,
): Promise<CanonicalMessage[]> {
  const messages = [userMessage(text)];
  await writer.recordAcceptedInput("session-quality", turnId, messages);
  return messages;
}

describe("bootstrapSessionGoalQualityContract joint persistence barrier", () => {
  let directory = "";
  let transcriptPath = "";
  let writer: JsonlTranscriptWriter;

  beforeEach(async () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    directory = await mkdtemp(join(tmpdir(), "pilotdeck-quality-contract-"));
    transcriptPath = join(directory, "session.jsonl");
    writer = new JsonlTranscriptWriter({
      path: transcriptPath,
      now: () => new Date("2026-07-19T00:00:00.000Z"),
    });
  });

  afterEach(async () => {
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it("writes SDM before bounded quality contract and remains idempotent after restart", async () => {
    const goal = [
      "制作鸣镝 G700 的 6 页幻灯并输出 presentation.pptx。",
      "图片必须来自品牌官方渠道，禁止 AI 生图。",
      "Authorization: Bearer PRIVATE_TOKEN",
      "素材在 C:\\Users\\alice\\private\\source.png",
    ].join("\n");
    const acceptedMessages = await recordAccepted(writer, "turn-1", goal);

    const first = await bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });
    const restartedWriter = new JsonlTranscriptWriter({ path: transcriptPath });
    const existing = await readEntries(transcriptPath);
    const last = existing.at(-1);
    restartedWriter.restoreState(
      Math.max(...existing.map((entry) => entry.sequence)),
      last?.entryId ?? null,
    );
    const second = await bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages,
      transcript: restartedWriter,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });
    const entries = await readEntries(transcriptPath);
    const sdmRows = entries.filter(
      (entry) => entry.type === "session_deliverable_manifest",
    );
    const qualityRows = entries.filter(
      (entry) => entry.type === "session_goal_quality_contract",
    );

    expect(sdmRows).toHaveLength(1);
    expect(qualityRows).toHaveLength(1);
    expect(entries.indexOf(sdmRows[0]!)).toBeLessThan(
      entries.indexOf(qualityRows[0]!),
    );
    expect(first.qualityContractHash).toBe(second.qualityContractHash);
    expect(first.qualityContract.goalVersion).toBe(
      first.manifest?.goalVersion,
    );
    expect(JSON.stringify(qualityRows[0])).not.toMatch(
      /PRIVATE_TOKEN|C:\\\\Users|Authorization/i,
    );
  });

  it("repairs a crash after only the SDM half was appended", async () => {
    const goal = "制作鸣镝 G700 的 6 页幻灯并输出 presentation.pptx，只用官方图片。";
    const acceptedMessages = await recordAccepted(writer, "turn-1", goal);
    await bootstrapSessionDeliverableManifest({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });

    await bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });
    const entries = await readEntries(transcriptPath);

    expect(entries.filter(
      (entry) => entry.type === "session_deliverable_manifest",
    )).toHaveLength(1);
    expect(entries.filter(
      (entry) => entry.type === "session_goal_quality_contract",
    )).toHaveLength(1);
  });

  it("repairs a crash after only the quality half was appended", async () => {
    const goal = "制作鸣镝 G700 的 6 页幻灯并输出 presentation.pptx，只用官方图片。";
    const acceptedMessages = await recordAccepted(writer, "turn-1", goal);
    const contract = compileSessionGoalQualityContract({ userGoal: goal });
    await writer.recordSessionGoalQualityContract(
      "session-quality",
      "turn-1",
      {
        goalVersion: 1,
        qualityContractVersion: 1,
        qualityContractHashVersion: 1,
        qualityContractHash: computeGoalQualityContractHash(contract),
        contract,
        compiledAtTurnId: "turn-1",
        userGoalHash: computeQualityUserGoalHash(goal),
      },
    );

    const result = await bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });
    const entries = await readEntries(transcriptPath);

    expect(result.manifest?.goalVersion).toBe(1);
    expect(entries.filter(
      (entry) => entry.type === "session_deliverable_manifest",
    )).toHaveLength(1);
    expect(entries.filter(
      (entry) => entry.type === "session_goal_quality_contract",
    )).toHaveLength(1);
  });

  it("repairs either missing half of a quality-only goalVersion bump", async () => {
    const initialGoal =
      "制作鸣镝 G700 的 6 页幻灯并输出 presentation.pptx，只用官方图片。";
    const initialMessages = await recordAccepted(writer, "turn-1", initialGoal);
    const initial = await bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages: initialMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });
    const mutation = "页数改为 8 页，其他要求不变";
    const mutationMessages = await recordAccepted(writer, "turn-2", mutation);

    await bootstrapSessionDeliverableManifest({
      sessionId: "session-quality",
      turnId: "turn-2",
      acceptedMessages: mutationMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });
    const repairedQuality = await bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-2",
      acceptedMessages: mutationMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });
    expect(repairedQuality.manifest?.goalVersion).toBe(2);
    expect(
      repairedQuality.qualityContract.contract.exactQuantityAssertions,
    ).toContainEqual({ unit: "page", exact: 8 });

    const thirdMutation = "页数改为 10 页，其他要求不变";
    const thirdMessages = await recordAccepted(writer, "turn-3", thirdMutation);
    const prewrittenContract = compileSessionGoalQualityContract({
      userGoal: thirdMutation,
      profileFallback: repairedQuality.qualityContract.contract,
    });
    await writer.recordSessionGoalQualityContract(
      "session-quality",
      "turn-3",
      {
        goalVersion: 3,
        qualityContractVersion: 1,
        qualityContractHashVersion: 1,
        qualityContractHash: computeGoalQualityContractHash(prewrittenContract),
        contract: prewrittenContract,
        compiledAtTurnId: "turn-3",
        userGoalHash: computeQualityUserGoalHash(thirdMutation),
      },
    );
    const repairedSdm = await bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-3",
      acceptedMessages: thirdMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });
    const entries = await readEntries(transcriptPath);
    const latestQuality =
      resolveLatestSessionGoalQualityContractFromEntries(entries);

    expect(initial.manifest?.goalVersion).toBe(1);
    expect(repairedSdm.manifest?.goalVersion).toBe(3);
    expect(latestQuality?.goalVersion).toBe(3);
    expect(entries.filter(
      (entry) =>
        entry.type === "session_goal_quality_contract"
        && entry.goalVersion === 3,
    )).toHaveLength(1);
  });

  it("keeps a frozen version unchanged for non-goal text and changed fallback policy", async () => {
    const initialGoal =
      "制作鸣镝 G700 的 6 页幻灯并输出 presentation.pptx，只用官方图片。";
    const initialMessages = await recordAccepted(writer, "turn-1", initialGoal);
    const initial = await bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages: initialMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });
    const statusMessages = await recordAccepted(writer, "turn-2", "现在进度如何？");

    const status = await bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-2",
      acceptedMessages: statusMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
      exactCapabilityPolicy: {
        exactQuantityAssertions: [{ unit: "page", exact: 10 }],
      },
    });
    const entries = await readEntries(transcriptPath);

    expect(status.manifest?.goalVersion).toBe(1);
    expect(status.qualityContractHash).toBe(initial.qualityContractHash);
    expect(entries.filter(
      (entry) => entry.type === "session_goal_quality_contract",
    )).toHaveLength(1);
  });

  it("fails closed when quality append fails after SDM append", async () => {
    const goal = "制作鸣镝 G700 的 6 页幻灯并输出 presentation.pptx。";
    const acceptedMessages = await recordAccepted(writer, "turn-1", goal);
    vi.spyOn(writer, "recordSessionGoalQualityContract").mockRejectedValueOnce(
      new Error("simulated quality append failure"),
    );

    await expect(bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    })).rejects.toThrow(/quality contract append/i);
  });

  it("fails closed when post-append reread fails", async () => {
    const goal = "制作鸣镝 G700 的 6 页幻灯并输出 presentation.pptx。";
    const acceptedMessages = await recordAccepted(writer, "turn-1", goal);
    let reads = 0;

    await expect(bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
      readEntries: async () => {
        reads += 1;
        if (reads > 1) throw new Error("simulated reread failure");
        return readEntries(transcriptPath);
      },
    })).rejects.toThrow(/reread/i);
  });

  it("rejects an unrecoverable mixed-version transcript", async () => {
    const goal = "制作鸣镝 G700 的 6 页幻灯并输出 presentation.pptx。";
    const acceptedMessages = await recordAccepted(writer, "turn-1", goal);
    await bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    });
    const contract = compileSessionGoalQualityContract({ userGoal: goal });
    const impossible = {
      goalVersion: 99,
      qualityContractVersion: 1,
      qualityContractHashVersion: 1,
      qualityContractHash: computeGoalQualityContractHash(contract),
      contract,
      compiledAtTurnId: "turn-impossible",
      userGoalHash: computeQualityUserGoalHash(goal),
    } satisfies Omit<
      AgentSessionGoalQualityContractTranscriptEntry,
      | "type"
      | "sessionId"
      | "turnId"
      | "sequence"
      | "createdAt"
      | "entryId"
      | "parentEntryId"
    >;
    await writer.recordSessionGoalQualityContract(
      "session-quality",
      "turn-impossible",
      impossible,
    );

    await expect(bootstrapSessionGoalQualityContract({
      sessionId: "session-quality",
      turnId: "turn-1",
      acceptedMessages,
      transcript: writer,
      transcriptPath,
      capabilityContext: { slug: "nova-ppt-aesthetic-slides" },
    })).rejects.toThrow(/mixed goalVersion/i);
  });
});
