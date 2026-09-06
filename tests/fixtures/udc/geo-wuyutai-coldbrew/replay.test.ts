import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildUnifiedDeliverableView } from "../../../../ui/src/shared/buildUnifiedDeliverableView";
import type { ChatMessage } from "../../../../ui/src/components/chat/types/types";

const FIXTURE = JSON.parse(
  readFileSync(join(import.meta.dirname, "manifest.json"), "utf8"),
) as {
  taskArtifactDir: string;
  taskDirKey: string;
  pollutionDir: string;
  slots: Array<{ id: string; label: string; pathHint: string; required: boolean }>;
  verifiedPaths: string[];
  pollutionPaths: string[];
};

describe("UDC-GEO-WYT STDA cross-turn pollution replay", () => {
  it("filters sessionWideItems to STDA scope only", () => {
    const messages: ChatMessage[] = [
      {
        id: "u1",
        type: "user",
        content: "帮吴裕泰冷泡茶做 GEO 标准包",
        timestamp: "2026-07-09T00:00:00.000Z",
        payload: {
          sessionTaskDirectory: {
            taskArtifactDir: FIXTURE.taskArtifactDir,
            taskDirKey: FIXTURE.taskDirKey,
            goalVersion: 1,
          },
          sessionDeliverableManifest: {
            manifestVersion: 1,
            goalVersion: 1,
            sessionGoalAnchor: "吴裕泰冷泡茶 GEO",
            slots: FIXTURE.slots,
            profileId: "geo-standard-pack",
          },
        },
      } as ChatMessage,
      {
        id: "a1",
        type: "assistant",
        content: "已完成 GEO 交付",
        timestamp: "2026-07-09T00:01:00.000Z",
        verifiedDeliverablePaths: FIXTURE.verifiedPaths,
        turnArtifactDir: FIXTURE.taskArtifactDir,
        turnAcceptanceMeta: {
          verifiedPaths: FIXTURE.verifiedPaths,
          turnArtifactDir: FIXTURE.taskArtifactDir,
          taskArtifactDir: FIXTURE.taskArtifactDir,
          scopeId: FIXTURE.taskDirKey,
          expectedManifest: FIXTURE.slots.map((slot) => ({
            id: slot.id,
            label: slot.label,
            path: slot.pathHint,
            status: "done",
          })),
        },
      } as ChatMessage,
      {
        id: "tool-pollution",
        type: "tool",
        content: `saved ${FIXTURE.pollutionPaths.join(" ")}`,
        timestamp: "2026-07-09T00:02:00.000Z",
      } as ChatMessage,
    ];

    const view = buildUnifiedDeliverableView({
      messages,
      projectRoot: "/workspace",
    });

    expect(view.scopeDir).toBe(FIXTURE.taskArtifactDir);
    const rowPaths = view.rows
      .map((row) => row.resolvedPath || row.path)
      .filter(Boolean);
    for (const polluted of FIXTURE.pollutionPaths) {
      expect(rowPaths.some((p) => String(p).includes("slides-wuyutai"))).toBe(false);
    }
    expect(view.rows.filter((row) => row.status === "delivered").length).toBeGreaterThanOrEqual(3);
  });

  it("does not replace GEO manifest rows with in-scope stray slide PNGs", () => {
    const taskDir = FIXTURE.taskArtifactDir;
    const straySlides = [1, 2, 3].map((page) => `${taskDir}/slide-0${page}.png`);
    const messages: ChatMessage[] = [
      {
        id: "u1",
        type: "user",
        content: "GEO 标准包",
        timestamp: "2026-07-09T00:00:00.000Z",
        payload: {
          sessionTaskDirectory: {
            taskArtifactDir: taskDir,
            taskDirKey: FIXTURE.taskDirKey,
            goalVersion: 1,
          },
          sessionDeliverableManifest: {
            manifestVersion: 1,
            goalVersion: 1,
            sessionGoalAnchor: "GEO",
            profileId: "geo-standard-pack",
            slots: FIXTURE.slots,
          },
        },
      } as ChatMessage,
      {
        id: "a1",
        type: "assistant",
        content: "交付完成",
        timestamp: "2026-07-09T00:01:00.000Z",
        verifiedDeliverablePaths: [...FIXTURE.verifiedPaths, ...straySlides],
        turnArtifactDir: taskDir,
        turnAcceptanceMeta: {
          verifiedPaths: [...FIXTURE.verifiedPaths, ...straySlides],
          turnArtifactDir: taskDir,
          taskArtifactDir: taskDir,
          scopeId: FIXTURE.taskDirKey,
        },
      } as ChatMessage,
    ];

    const view = buildUnifiedDeliverableView({
      messages,
      projectRoot: "/workspace",
    });

    expect(view.rows.length).toBe(FIXTURE.slots.length);
    expect(view.rows.some((row) => String(row.path).includes("slide-"))).toBe(false);
    expect(view.rows.filter((row) => row.status === "delivered").length).toBe(FIXTURE.slots.length);
  });
});
