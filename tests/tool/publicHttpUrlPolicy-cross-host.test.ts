import { describe, expect, it } from "vitest";

import {
  getRegistrableDomain,
  isAllowedOfficialCrossHostRedirect,
} from "../../src/tool/builtin/web/publicHttpUrlPolicy.js";

describe("publicHttpUrlPolicy cross-host redirect whitelist", () => {
  it("allows nio.com → nio.cn official redirects", () => {
    const from = new URL("https://www.nio.com/path");
    const to = new URL("https://www.nio.cn/path");
    expect(isAllowedOfficialCrossHostRedirect(from, to)).toBe(true);
  });

  it("allows same registrable domain across subhosts", () => {
    const from = new URL("https://www.qq.com/news");
    const to = new URL("https://inews.qq.com/article");
    expect(getRegistrableDomain("inews.qq.com")).toBe("qq.com");
    expect(isAllowedOfficialCrossHostRedirect(from, to)).toBe(true);
  });

  it("allows bfgoodrich.com → bfgoodrich.com.cn official redirects", () => {
    const from = new URL("https://www.bfgoodrich.com/tires");
    const to = new URL("https://www.bfgoodrich.com.cn/tires");
    expect(isAllowedOfficialCrossHostRedirect(from, to)).toBe(true);
  });

  it("allows michelin.com → michelin.com.cn official redirects", () => {
    const from = new URL("https://www.michelin.com/en");
    const to = new URL("https://www.michelin.com.cn/zh");
    expect(isAllowedOfficialCrossHostRedirect(from, to)).toBe(true);
  });

  it("allows qq.com CDN redirects to gtimg.cn", () => {
    const from = new URL("https://www.qq.com/media");
    const to = new URL("https://p.gtimg.cn/example.jpg");
    expect(isAllowedOfficialCrossHostRedirect(from, to)).toBe(true);
  });

  it("blocks unrelated cross-host redirects", () => {
    const from = new URL("https://example.com/a");
    const to = new URL("https://evil.test/b");
    expect(isAllowedOfficialCrossHostRedirect(from, to)).toBe(false);
  });
});
