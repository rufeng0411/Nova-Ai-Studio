import { describe, expect, it } from "vitest";
import {
  applyImChannelEnableGate,
  mergeImChannelPut,
} from "./channelGate.js";

describe("imChannels gate", () => {
  it("forces enabled false when flag off", () => {
    const { adapters, blockedEnable, flag } = applyImChannelEnableGate(
      { wecom: { enabled: true, token: "bot" } },
      { PILOTDECK_IM_CHANNELS: "off" },
    );
    expect(flag).toBe("off");
    expect(blockedEnable).toContain("wecom");
    expect((adapters.wecom as { enabled: boolean }).enabled).toBe(false);
  });

  it("allows enabled when shadow", () => {
    const { adapters, blockedEnable } = applyImChannelEnableGate(
      { dingtalk: { enabled: true, extra: { clientId: "a" } } },
      { PILOTDECK_IM_CHANNELS: "shadow" },
    );
    expect(blockedEnable).toEqual([]);
    expect((adapters.dingtalk as { enabled: boolean }).enabled).toBe(true);
  });

  it("preserves secrets when PUT sends mask", () => {
    const { adapters } = mergeImChannelPut(
      { wecom: { enabled: false, token: "real-bot-id", extra: { secret: "sec" } } },
      { wecom: { enabled: false, token: "••••", extra: { secret: "••••" } } },
      { PILOTDECK_IM_CHANNELS: "off" },
    );
    const w = adapters.wecom as { token?: string; extra?: { secret?: string } };
    expect(w.token).toBe("real-bot-id");
    expect(w.extra?.secret).toBe("sec");
  });
});
