import { describe, expect, it } from "vitest";

import {
  resolveSessionDownloadsAbsDir,
  resolveSessionDownloadsRelDir,
} from "./sessionDownloadPaths.js";

describe("sessionDownloadPaths", () => {
  it("scopes downloads under artifacts/sessions/{sessionId}/downloads", () => {
    expect(resolveSessionDownloadsRelDir("web:s_abc-123")).toBe(
      "artifacts/sessions/web-s_abc-123/downloads",
    );
  });

  it("resolves absolute path under workspace", () => {
    const abs = resolveSessionDownloadsAbsDir("/ws", "web-s_demo");
    expect(abs.replace(/\\/gu, "/")).toBe("/ws/artifacts/sessions/web-s_demo/downloads");
  });
});
