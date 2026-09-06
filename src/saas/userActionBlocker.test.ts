import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  classifyUserActionBlocker,
  looksLikeBareTransientNetworkFailure,
  userIndicatesBlockerResolved,
} from "./userActionBlocker.js";

describe("looksLikeBareTransientNetworkFailure", () => {
  it("matches bare transient network failures from any tool", () => {
    expect(looksLikeBareTransientNetworkFailure("fetch failed")).toBe(true);
    expect(looksLikeBareTransientNetworkFailure("Tool crawler failed: ETIMEDOUT")).toBe(true);
    expect(looksLikeBareTransientNetworkFailure("连接失败，无法访问")).toBe(true);
    expect(looksLikeBareTransientNetworkFailure("ECONNREFUSED")).toBe(true);
  });

  it("returns false when a genuine credential / permission / billing signal is present", () => {
    expect(looksLikeBareTransientNetworkFailure("fetch failed: missing api key")).toBe(false);
    expect(looksLikeBareTransientNetworkFailure("network error, 未配置 mineru")).toBe(false);
    expect(looksLikeBareTransientNetworkFailure("timeout - 401 unauthorized invalid api key")).toBe(false);
    expect(looksLikeBareTransientNetworkFailure("connection failed, permission_denied")).toBe(false);
    expect(looksLikeBareTransientNetworkFailure("fetch failed - 账户欠费 Arrearage")).toBe(false);
    expect(looksLikeBareTransientNetworkFailure("请上传 docx 附件")).toBe(false);
  });

  it("returns false for empty / non-network text", () => {
    expect(looksLikeBareTransientNetworkFailure("")).toBe(false);
    expect(looksLikeBareTransientNetworkFailure("已完成，文件在 artifacts/report.md")).toBe(false);
  });
});

describe("userIndicatesBlockerResolved", () => {
  it("treats configured follow-up as resolved", () => {
    expect(userIndicatesBlockerResolved("已配置，继续")).toBe(true);
  });

  it("does not treat bare continue as resolved", () => {
    expect(userIndicatesBlockerResolved("继续")).toBe(false);
    expect(userIndicatesBlockerResolved("？？")).toBe(false);
  });
});

describe("classifyUserActionBlocker transient-invisible gating", () => {
  const KEY = "PILOTDECK_TRANSIENT_INVISIBLE";
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env[KEY];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it("flag ON: a bare network failure from a non-media tool is NOT a blocker", () => {
    process.env[KEY] = "1";
    expect(
      classifyUserActionBlocker({ toolErrorMessage: "web_crawler failed: fetch failed ETIMEDOUT" }),
    ).toBeNull();
  });

  it("credential signals stay blockers regardless of the flag", () => {
    for (const flag of ["0", "1"]) {
      process.env[KEY] = flag;
      const missingKey = classifyUserActionBlocker({
        toolErrorMessage: "mineru 未配置 api key，fetch failed",
      });
      expect(missingKey?.type).toBe("missing_key");

      const auth = classifyUserActionBlocker({
        toolErrorMessage: "timeout then 401 unauthorized invalid api key",
      });
      expect(auth?.type).toBe("auth");

      const billing = classifyUserActionBlocker({ toolErrorMessage: "network error, 账户欠费 Arrearage" });
      expect(billing?.type).toBe("billing");
    }
  });

  it("flag OFF: bare network from a non-credential context is still not a blocker (unchanged)", () => {
    process.env[KEY] = "0";
    expect(classifyUserActionBlocker({ toolErrorMessage: "fetch failed" })).toBeNull();
  });
});
