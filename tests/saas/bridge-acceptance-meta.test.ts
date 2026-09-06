import { describe, expect, it } from "vitest";
import { shouldSkipBridgeDeliverableMetaWrite } from "../../ui/server/saas/deliverables/turnDeliverableMetaWriter.js";

describe("turnDeliverableMetaWriter bridge meta", () => {
  it("skips write when engine acceptance meta already exists for turn", () => {
    expect(
      shouldSkipBridgeDeliverableMetaWrite({
        metaByTurnId: new Set(["turn-1"]),
        acceptanceMetaByTurnId: new Set(["turn-1"]),
        turnId: "turn-1",
      }),
    ).toBe(true);
  });

  it("allows write when turn has no engine acceptance meta", () => {
    expect(
      shouldSkipBridgeDeliverableMetaWrite({
        metaByTurnId: new Set(),
        acceptanceMetaByTurnId: new Set(),
        turnId: "turn-2",
      }),
    ).toBe(false);
  });
});
