import { mkdtemp, mkdir, writeFile, utimes } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  resolveTenantSessionTranscriptAbsPath,
  sessionTranscriptBasenames,
} from "../../../src/saas/conversation/resolveTenantSessionTranscript.js";

describe("resolveTenantSessionTranscript", () => {
  it("sessionTranscriptBasenames includes web-s/web:s aliases", () => {
    const names = sessionTranscriptBasenames("web-s_abc");
    expect(names).toContain("web-s_abc");
    expect(names).toContain("web:s_abc");
  });

  it("finds transcript under a different project dir than current projectKey", async () => {
    const tenantHome = await mkdtemp(join(tmpdir(), "pd-tenant-"));
    const sessionId = "web-s_cross_project_test";
    const relPath = join("projects", "workspaces-argentina", "chats", `${sessionId}.jsonl`);
    const absPath = join(tenantHome, relPath);
    await mkdir(join(tenantHome, "projects", "workspaces-argentina", "chats"), { recursive: true });
    await writeFile(absPath, '{"type":"session"}\n', "utf8");
    const now = Date.now() / 1000;
    await utimes(absPath, now, now);

    const resolved = await resolveTenantSessionTranscriptAbsPath({
      sessionId,
      tenantPilotHome: tenantHome,
    });
    expect(resolved?.replace(/\\/g, "/")).toContain("workspaces-argentina/chats");
  });

  it("uses a persisted relative path instead of choosing another same-name transcript by mtime", async () => {
    const tenantHome = await mkdtemp(join(tmpdir(), "pd-tenant-stable-"));
    const sessionId = "web-s_stable_path";
    const authoritativeRel = join("projects", "workspace-a", "chats", `${sessionId}.jsonl`);
    const wrongRel = join("projects", "workspace-b", "chats", `${sessionId}.jsonl`);
    const authoritative = join(tenantHome, authoritativeRel);
    const wrong = join(tenantHome, wrongRel);
    await mkdir(join(tenantHome, "projects", "workspace-a", "chats"), { recursive: true });
    await mkdir(join(tenantHome, "projects", "workspace-b", "chats"), { recursive: true });
    await writeFile(authoritative, '{"sequence":1}\n', "utf8");
    await writeFile(wrong, '{"sequence":99}\n', "utf8");
    const now = Date.now() / 1000;
    await utimes(authoritative, now - 60, now - 60);
    await utimes(wrong, now, now);

    const resolved = await resolveTenantSessionTranscriptAbsPath({
      sessionId,
      tenantPilotHome: tenantHome,
      transcriptRelPath: authoritativeRel.replace(/\\/g, "/"),
    });
    expect(resolved).toBe(authoritative);
  });

  it("rejects an untrusted persisted path that escapes the tenant projects root", async () => {
    const tenantHome = await mkdtemp(join(tmpdir(), "pd-tenant-guard-"));
    const sessionId = "web-s_guard_path";
    const valid = join(tenantHome, "projects", "workspace-a", "chats", `${sessionId}.jsonl`);
    await mkdir(join(tenantHome, "projects", "workspace-a", "chats"), { recursive: true });
    await writeFile(valid, '{"sequence":1}\n', "utf8");

    const resolved = await resolveTenantSessionTranscriptAbsPath({
      sessionId,
      tenantPilotHome: tenantHome,
      transcriptRelPath: `../../outside/${sessionId}.jsonl`,
    });
    expect(resolved).toBeNull();
  });
});
