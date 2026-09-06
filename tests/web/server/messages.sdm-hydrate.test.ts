import test from "node:test";
import assert from "node:assert/strict";

import { mapWebMessageToNormalized } from "../../../ui/server/routes/messages.js";

test("mapWebMessageToNormalized hydrates sessionDeliverableManifest from payload", () => {
  const manifest = {
    manifestVersion: 2,
    goalVersion: 1,
    sessionGoalAnchor: "试一下 GEO 报告",
    slots: [
      { id: "slot_1", label: "调研报告", kind: "markdown", required: true, status: "active" },
    ],
  };
  const normalized = mapWebMessageToNormalized(
    {
      id: "msg_assist_1",
      kind: "text",
      role: "assistant",
      text: "报告已完成",
      createdAt: "2026-06-28T12:00:00.000Z",
      payload: {
        sessionDeliverableManifest: manifest,
        sessionManifestVersion: 2,
        goalVersion: 1,
        turnId: "turn_abc",
      },
    },
    "web-s_test",
  );
  assert.equal(normalized.kind, "text");
  assert.equal(normalized.role, "assistant");
  assert.deepEqual(normalized.sessionDeliverableManifest, manifest);
  assert.equal(normalized.sessionManifestVersion, 2);
  assert.equal(normalized.goalVersion, 1);
  assert.equal(normalized.turnId, "turn_abc");
});

test("mapWebMessageToNormalized preserves turnAcceptanceMeta alongside SDM", () => {
  const normalized = mapWebMessageToNormalized(
    {
      id: "msg_assist_2",
      kind: "text",
      role: "assistant",
      text: "done",
      createdAt: "2026-06-28T12:01:00.000Z",
      payload: {
        sessionDeliverableManifest: {
          manifestVersion: 1,
          goalVersion: 1,
          sessionGoalAnchor: "goal",
          slots: [{ id: "a", label: "HTML", kind: "html", required: true }],
        },
        turnAcceptanceMeta: {
          verifiedPaths: ["artifacts/demo/index.html"],
          missingPaths: [],
        },
        verifiedDeliverablePaths: ["artifacts/demo/index.html"],
      },
    },
    "web-s_test",
  );
  assert.deepEqual(normalized.verifiedDeliverablePaths, ["artifacts/demo/index.html"]);
  assert.equal(normalized.turnAcceptanceMeta?.verifiedPaths?.[0], "artifacts/demo/index.html");
  assert.equal(normalized.sessionDeliverableManifest?.slots?.length, 1);
});
