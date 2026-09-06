import { describe, expect, it } from "vitest";
import { resolveContractScopeDir } from "./resolveContractScopeDir";
import type { ChatMessage } from "../components/chat/types/types";

function assistantMessage(payload: Record<string, unknown>): ChatMessage {
  return {
    id: "a1",
    type: "assistant",
    content: "done",
    timestamp: "2026-07-10T00:00:00.000Z",
    ...payload,
  } as ChatMessage;
}

describe("resolveContractScopeDir", () => {
  it("prefers session_task_directory over legacy paths", () => {
    const stda = {
      taskArtifactDir: "artifacts/task-20260710-a1b2c3d4",
      taskDirKey: "20260710-a1b2c3d4",
      goalVersion: 1,
    };
    const scope = resolveContractScopeDir({
      messages: [
        assistantMessage({
          turnArtifactDir: "artifacts/geo/wuyutai",
        }),
      ],
      sessionTaskDirectory: stda,
    });
    expect(scope).toBe("artifacts/task-20260710-a1b2c3d4");
  });

  it("prefers primary task root from manifest resolved paths over latest STDA", () => {
    const primary = "artifacts/task-20260713-f4424421";
    const split = "artifacts/task-20260713-ffd81a25";
    const scope = resolveContractScopeDir({
      messages: [],
      sessionTaskDirectory: {
        taskArtifactDir: split,
        taskDirKey: "20260713-ffd81a25",
        goalVersion: 2,
      },
      sessionManifest: {
        manifestVersion: 5,
        goalVersion: 2,
        sessionGoalAnchor: "geo",
        slots: [
          {
            id: "s1",
            label: "checklist",
            pathHint: `${primary}/geo-aeo-audit-checklist.md`,
            resolvedPath: `${primary}/geo-aeo-audit-checklist.md`,
            required: true,
            status: "done",
          },
          {
            id: "s2",
            label: "html",
            pathHint: `${split}/index.html`,
            required: true,
            status: "active",
          },
        ],
      },
    });
    expect(scope).toBe(primary);
  });

  it("uses the latest turn acceptance task scope when STDA is absent", () => {
    const scope = resolveContractScopeDir({
      messages: [
        assistantMessage({
          turnAcceptanceMeta: {
            turnArtifactDir: "artifacts/task-20260709-deadbeef",
            scopeId: "20260709-deadbeef",
          },
        }),
      ],
    });
    expect(scope).toBe("artifacts/task-20260709-deadbeef");
  });
});
