import { describe, expect, it } from "vitest";
import type { AgentTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";
import type { CanonicalMessage } from "../../model/index.js";
import type { SessionDeliverableManifest } from "./sessionDeliverableManifest.js";
import {
  collectSessionKnownTaskDirs,
  inferWriteTaskArtifactDirFromMessages,
  resolvePrimaryTaskArtifactDir,
} from "./resolvePrimaryTaskArtifactDir.js";

const PRIMARY = "artifacts/task-20260713-f4424421";
const SPLIT = "artifacts/task-20260713-ffd81a25";

function manifestWithResolved(): SessionDeliverableManifest {
  return {
    manifestVersion: 5,
    goalVersion: 2,
    sessionGoalAnchor: "geo",
    taskArtifactDir: SPLIT,
    taskDirKey: "20260713-ffd81a25",
    slots: [
      {
        id: "s1",
        label: "checklist",
        pathHint: `${PRIMARY}/geo-aeo-audit-checklist.md`,
        resolvedPath: `${PRIMARY}/geo-aeo-audit-checklist.md`,
        required: true,
        status: "done",
        kind: "markdown",
      },
      {
        id: "s2",
        label: "html",
        pathHint: `${SPLIT}/index.html`,
        required: true,
        status: "active",
        kind: "html",
      },
    ],
  };
}

describe("resolvePrimaryTaskArtifactDir", () => {
  it("prefers task root with most resolved deliverables", () => {
    const primary = resolvePrimaryTaskArtifactDir({
      manifest: manifestWithResolved(),
      latestDirectory: {
        taskArtifactDir: SPLIT,
        taskDirKey: "20260713-ffd81a25",
        goalVersion: 2,
        allocatedAt: "2026-07-13T06:33:25.180Z",
      },
    });
    expect(primary?.taskArtifactDir).toBe(PRIMARY);
  });

  it("prefers write_file task root over polluted manifest (Razer/FIFA RCA)", () => {
    const razerDir = "artifacts/task-20260728-a1b2c3d4";
    const fifaDir = "artifacts/task-20260728-41dd1371";
    const messages: CanonicalMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool_call",
            id: "tc1",
            name: "write_file",
            input: { file_path: `${razerDir}/deck.bento.html`, content: "<html></html>" },
          },
        ],
      },
    ];
    expect(inferWriteTaskArtifactDirFromMessages(messages)).toBe(razerDir);
    const primary = resolvePrimaryTaskArtifactDir({
      messages,
      manifest: {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: "雷蛇2026",
        taskArtifactDir: fifaDir,
        taskDirKey: "20260728-41dd1371",
        slots: [
          {
            id: "bento",
            label: "deck.bento.html",
            pathHint: `${fifaDir}/deck.bento.html`,
            resolvedPath: `${fifaDir}/deck.bento.html`,
            required: true,
            status: "done",
            kind: "bento",
          },
        ],
      },
    });
    expect(primary?.taskArtifactDir).toBe(razerDir);
  });

  it("collects known task dirs from manifest and transcript", () => {
    const entries: AgentTranscriptEntry[] = [
      {
        type: "session_task_directory",
        sessionId: "s1",
        turnId: "t1",
        sequence: 1,
        createdAt: "2026-07-13T02:00:00.000Z",
        taskArtifactDir: PRIMARY,
        taskDirKey: "20260713-f4424421",
        goalVersion: 1,
        allocatedAt: "2026-07-13T02:00:00.000Z",
      },
    ];
    const dirs = collectSessionKnownTaskDirs({ manifest: manifestWithResolved(), entries });
    expect(dirs).toContain(PRIMARY);
    expect(dirs).toContain(SPLIT);
  });
});
