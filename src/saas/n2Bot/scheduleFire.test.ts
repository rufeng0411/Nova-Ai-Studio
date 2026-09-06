import { describe, expect, it } from "vitest";
import {
  assertWorkerScheduleTarget,
  buildScheduleFire,
  parseScheduleUtterance,
  rewriteStewardCronSessionKey,
} from "./scheduleFire.js";

describe("scheduleFire", () => {
  it("S1 worker sessionKey accepted", () => {
    const r = buildScheduleFire({
      sessionKey: "w-worker",
      message: "竞品简报",
      expression: "0 9 * * *",
      stewardSessionId: "s-n2",
    });
    expect(r.ok).toBe(true);
  });

  it("S2 steward sessionKey rejected", () => {
    expect(assertWorkerScheduleTarget("s-n2", "s-n2")).toBe(false);
    const r = buildScheduleFire({
      sessionKey: "s-n2",
      message: "竞品",
      expression: "0 9 * * *",
      stewardSessionId: "s-n2",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("steward_session");
  });

  it("S3 rewrite steward key to worker", () => {
    expect(rewriteStewardCronSessionKey({
      requestedSessionKey: "s-n2",
      stewardSessionId: "s-n2",
      workerSessionId: "w-worker",
    })).toBe("w-worker");
  });

  it("S4 parse 每天九点", () => {
    const p = parseScheduleUtterance("每天九点竞品简报");
    expect(p?.expression).toBe("0 9 * * *");
  });

  it("S5 missing message fails", () => {
    const r = buildScheduleFire({ sessionKey: "w", message: "", expression: "0 9 * * *" });
    expect(r.ok).toBe(false);
  });

  it("S6 missing when fails", () => {
    const r = buildScheduleFire({ sessionKey: "w", message: "hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_when");
  });

  it("S7 n2_bot kind as key rejected", () => {
    expect(assertWorkerScheduleTarget("n2_bot")).toBe(false);
  });

  it("S8 once runAt ok", () => {
    const r = buildScheduleFire({
      sessionKey: "w-worker",
      message: "once",
      runAt: "2026-08-21T01:00:00.000Z",
    });
    expect(r.ok).toBe(true);
  });
});
