import { describe, expect, it } from "vitest";
import {
  detectUserDeliverableAcknowledgment,
  findLatestUserDeliverableAcknowledgment,
} from "./userDeliverableAcknowledgment.js";
import type { CanonicalMessage } from "../../model/index.js";

describe("userDeliverableAcknowledgment", () => {
  it("706c4514: detects 已完成没问题", () => {
    expect(detectUserDeliverableAcknowledgment("已完成，没问题")).toBe(true);
  });

  it("rejects new deliverable request", () => {
    expect(detectUserDeliverableAcknowledgment("再帮我加两页 PPT")).toBe(false);
  });

  it("findLatestUserDeliverableAcknowledgment scans messages", () => {
    const messages: CanonicalMessage[] = [
      { role: "user", content: [{ type: "text", text: "做 PPT" }] },
      { role: "assistant", content: [{ type: "text", text: "好的" }] },
      { role: "user", content: [{ type: "text", text: "可以了" }] },
    ];
    expect(findLatestUserDeliverableAcknowledgment(messages).acknowledged).toBe(true);
  });
});
