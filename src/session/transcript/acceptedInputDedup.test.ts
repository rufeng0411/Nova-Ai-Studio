import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acceptedInputReplayMetadataMatches,
  collapseLegacyAcceptedInputDuplicates,
  markAcceptedInputMessages,
  shouldSkipGatewayAcceptedInputWrite,
} from "./acceptedInputDedup.js";

describe("acceptedInputDedup", () => {
  it("only skips when ref, session, and input fingerprint all match the target transcript", async () => {
    const base = await mkdtemp(join(tmpdir(), "accepted-input-ref-"));
    const transcriptPath = join(base, "session.jsonl");
    const acceptedInputRef = {
      entryId: "bridge-entry-1",
      turnId: "turn-1",
      sequence: 1,
      createdAt: "2026-07-18T00:00:00.000Z",
    };
    await writeFile(transcriptPath, `${JSON.stringify({
      type: "accepted_input",
      sessionId: "web-s_ref",
      ...acceptedInputRef,
      synthetic: true,
      inputFingerprint: "sha256:input-a",
      messages: [{ role: "user", content: [{ type: "text", text: "立即执行" }] }],
    })}\n`, "utf8");

    await expect(shouldSkipGatewayAcceptedInputWrite({
      transcriptPath,
      sessionId: "web-s_ref",
      turnId: "gateway-run-uuid",
      acceptedInputRef,
      inputFingerprint: "sha256:input-a",
    })).resolves.toBe(true);

    for (const field of ["entryId", "turnId", "sequence", "createdAt"] as const) {
      await expect(shouldSkipGatewayAcceptedInputWrite({
        transcriptPath,
        sessionId: "web-s_ref",
        turnId: acceptedInputRef.turnId,
        acceptedInputRef: {
          ...acceptedInputRef,
          [field]: field === "sequence" ? 99 : `forged-${field}`,
        },
        inputFingerprint: "sha256:input-a",
      })).resolves.toBe(false);
    }

    await expect(shouldSkipGatewayAcceptedInputWrite({
      transcriptPath,
      sessionId: "web-s_other",
      turnId: "gateway-run-uuid",
      acceptedInputRef,
      inputFingerprint: "sha256:input-a",
    })).resolves.toBe(false);
    await expect(shouldSkipGatewayAcceptedInputWrite({
      transcriptPath,
      sessionId: "web-s_ref",
      turnId: "gateway-run-uuid",
      acceptedInputRef,
      inputFingerprint: "sha256:input-b",
    })).resolves.toBe(false);
  });

  it("keeps the normal Gateway write for missing refs, legacy metadata, and read failures", async () => {
    const base = await mkdtemp(join(tmpdir(), "accepted-input-fallback-"));
    const transcriptPath = join(base, "session.jsonl");
    await writeFile(transcriptPath, `${JSON.stringify({
      type: "accepted_input",
      sessionId: "web-s_legacy",
      turnId: "gateway-old-run",
      sequence: 1,
      createdAt: "2026-07-18T00:00:00.000Z",
      entryId: "legacy-entry",
      messages: [{ role: "user", content: [{ type: "text", text: "旧队列" }] }],
    })}\n`, "utf8");

    await expect(shouldSkipGatewayAcceptedInputWrite({
      transcriptPath,
      sessionId: "web-s_legacy",
      turnId: "gateway-old-run",
    })).resolves.toBe(false);
    await expect(shouldSkipGatewayAcceptedInputWrite({
      transcriptPath,
      sessionId: "web-s_legacy",
      turnId: "gateway-old-run",
      acceptedInputRef: {
        entryId: "legacy-entry",
        turnId: "gateway-old-run",
        sequence: 1,
        createdAt: "2026-07-18T00:00:00.000Z",
      },
      inputFingerprint: "sha256:legacy",
    })).resolves.toBe(false);
    await expect(shouldSkipGatewayAcceptedInputWrite({
      transcriptPath: join(base, "missing.jsonl"),
      sessionId: "web-s_legacy",
      turnId: "gateway-old-run",
      acceptedInputRef: {
        entryId: "legacy-entry",
        turnId: "gateway-old-run",
        sequence: 1,
        createdAt: "2026-07-18T00:00:00.000Z",
      },
      inputFingerprint: "sha256:legacy",
    })).resolves.toBe(false);
  });

  it("matches only unresolved replay metadata for TurnRunner replacement", () => {
    const acceptedInputRef = {
      entryId: "bridge-entry-1",
      turnId: "turn-1",
      sequence: 1,
      createdAt: "2026-07-18T00:00:00.000Z",
    };
    const input = {
      sessionId: "web-s_ref",
      acceptedInputRef,
      inputFingerprint: "sha256:input-a",
    };
    const messages = [{
      role: "user" as const,
      content: [{ type: "text" as const, text: "输入 A" }],
    }];
    const completed = markAcceptedInputMessages(messages, {
      sessionId: input.sessionId,
      acceptedInputRef,
      inputFingerprint: input.inputFingerprint,
      unresolved: false,
    });
    const unresolved = markAcceptedInputMessages(messages, {
      sessionId: input.sessionId,
      acceptedInputRef,
      inputFingerprint: input.inputFingerprint,
      unresolved: true,
    });

    expect(acceptedInputReplayMetadataMatches(completed[0], input)).toBe(false);
    expect(acceptedInputReplayMetadataMatches(unresolved[0], input)).toBe(true);
  });

  it("keeps an unproven adjacent synthetic/Gateway pair", () => {
    const collapsed = collapseLegacyAcceptedInputDuplicates([
      acceptedInput("turn-1", "bridge-1", "继续", "2026-07-17T00:00:00.000Z", 1, {
        synthetic: true,
        inputFingerprint: "sha256:continue-1",
      }),
      acceptedInput("550e8400-e29b-41d4-a716-446655440001", "gateway-1", "继续", "2026-07-17T00:00:01.000Z", 2, {
        inputFingerprint: "sha256:continue-1",
      }),
    ]);
    expect(collapsed).toHaveLength(2);
  });

  it("collapses one Gateway row explicitly linked to its prewrite", () => {
    const collapsed = collapseLegacyAcceptedInputDuplicates([
      acceptedInput("turn-1", "bridge-1", "继续", "2026-07-17T00:00:00.000Z", 1, {
        synthetic: true,
        inputFingerprint: "sha256:continue-1",
      }),
      acceptedInput("550e8400-e29b-41d4-a716-446655440001", "gateway-1", "继续", "2026-07-17T00:00:01.000Z", 2, {
        inputFingerprint: "sha256:continue-1",
        logicalInputEntryId: "bridge-1",
      }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.turnId).toBe("550e8400-e29b-41d4-a716-446655440001");
  });

  it("keeps two logical repeated sends when each has its own bridge/Gateway pair", () => {
    const collapsed = collapseLegacyAcceptedInputDuplicates([
      acceptedInput("turn-1", "bridge-1", "继续", "2026-07-17T00:00:00.000Z", 1, {
        synthetic: true,
        inputFingerprint: "sha256:continue",
      }),
      acceptedInput("550e8400-e29b-41d4-a716-446655440001", "gateway-1", "继续", "2026-07-17T00:00:01.000Z", 2, {
        inputFingerprint: "sha256:continue",
        logicalInputEntryId: "bridge-1",
      }),
      acceptedInput("turn-3", "bridge-2", "继续", "2026-07-17T00:00:10.000Z", 3, {
        synthetic: true,
        inputFingerprint: "sha256:continue",
      }),
      acceptedInput("550e8400-e29b-41d4-a716-446655440002", "gateway-2", "继续", "2026-07-17T00:00:11.000Z", 4, {
        inputFingerprint: "sha256:continue",
        logicalInputEntryId: "bridge-2",
      }),
    ]);
    expect(collapsed).toHaveLength(2);
    expect(collapsed.map((entry) => entry.turnId)).toEqual([
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
    ]);
  });

  it("does not fold one-minute repeats, attachment differences, or non-synthetic turn-N rows", () => {
    const collapsed = collapseLegacyAcceptedInputDuplicates([
      acceptedInput("turn-1", "bridge-late", "同文", "2026-07-17T00:00:00.000Z", 1, {
        synthetic: true,
        inputFingerprint: "sha256:same",
      }),
      acceptedInput("550e8400-e29b-41d4-a716-446655440003", "gateway-late", "同文", "2026-07-17T00:01:00.000Z", 2, {
        inputFingerprint: "sha256:same",
      }),
      acceptedInput("turn-3", "bridge-file-a", "附件", "2026-07-17T00:02:00.000Z", 3, {
        synthetic: true,
        inputFingerprint: "sha256:file-a",
      }),
      acceptedInput("550e8400-e29b-41d4-a716-446655440004", "gateway-file-b", "附件", "2026-07-17T00:02:01.000Z", 4, {
        inputFingerprint: "sha256:file-b",
      }),
      acceptedInput("turn-5", "real-turn-id", "非预写", "2026-07-17T00:03:00.000Z", 5, {
        synthetic: false,
        inputFingerprint: "sha256:real",
      }),
      acceptedInput("550e8400-e29b-41d4-a716-446655440005", "gateway-real", "非预写", "2026-07-17T00:03:01.000Z", 6, {
        inputFingerprint: "sha256:real",
      }),
    ]);
    expect(collapsed).toHaveLength(6);
  });

  it("does not pair across an interleaved or out-of-order accepted_input", () => {
    const collapsed = collapseLegacyAcceptedInputDuplicates([
      acceptedInput("turn-1", "bridge-1", "继续", "2026-07-17T00:00:00.000Z", 1, {
        synthetic: true,
        inputFingerprint: "sha256:continue",
      }),
      acceptedInput("550e8400-e29b-41d4-a716-446655440009", "other", "其他输入", "2026-07-17T00:00:00.500Z", 2, {
        inputFingerprint: "sha256:other",
      }),
      acceptedInput("550e8400-e29b-41d4-a716-446655440001", "gateway-1", "继续", "2026-07-17T00:00:01.000Z", 3, {
        inputFingerprint: "sha256:continue",
      }),
      acceptedInput("550e8400-e29b-41d4-a716-446655440002", "gateway-before", "乱序", "2026-07-17T00:00:02.000Z", 4, {
        inputFingerprint: "sha256:unordered",
      }),
      acceptedInput("turn-5", "bridge-after", "乱序", "2026-07-17T00:00:03.000Z", 5, {
        synthetic: true,
        inputFingerprint: "sha256:unordered",
      }),
    ]);
    expect(collapsed).toHaveLength(5);
  });
});

function acceptedInput(
  turnId: string,
  entryId: string,
  text: string,
  createdAt: string,
  sequence: number,
  metadata: {
    synthetic?: boolean;
    inputFingerprint?: string;
    logicalInputEntryId?: string;
  } = {},
) {
  return {
    type: "accepted_input",
    sessionId: "web-s_projection",
    turnId,
    sequence,
    createdAt,
    entryId,
    ...metadata,
    messages: [{ role: "user", content: [{ type: "text", text }] }],
  };
}
