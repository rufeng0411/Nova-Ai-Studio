import { describe, expect, it } from "vitest";
import {
  CrossTurnToolFailureTracker,
  hashToolInput,
} from "../../src/agent/loop/crossTurnToolFailureTracker.js";

describe("crossTurnToolFailureTracker", () => {
  it("terminals after 2 same failures", () => {
    const t = new CrossTurnToolFailureTracker();
    const hash = hashToolInput({ cmd: "pip list | grep pptx" });
    expect(t.record("bash", hash)).toBe(1);
    expect(t.record("bash", hash)).toBe(2);
    expect(t.shouldTerminal("bash", hash)).toBe(true);
  });
});
