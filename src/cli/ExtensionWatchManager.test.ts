import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWatchTarget, shouldHandleWatchSignal } from "./ExtensionWatchManager.js";

function makeFixture(): { root: string; mcp: string; skills: string } {
  const root = mkdtempSync(join(tmpdir(), "ext-watch-"));
  const mcp = join(root, "mcp.json");
  const skills = join(root, "skills");
  writeFileSync(mcp, "{}");
  mkdirSync(skills);
  return { root, mcp, skills };
}

describe("resolveWatchTarget", () => {
  it("watches an existing path directly", () => {
    const { mcp, skills } = makeFixture();
    expect(resolveWatchTarget(mcp)).toBe(mcp);
    expect(resolveWatchTarget(skills)).toBe(skills);
  });

  it("falls back only one parent when the file is missing", () => {
    const { root } = makeFixture();
    const missing = join(root, "mcp.json.missing");
    expect(resolveWatchTarget(missing)).toBe(root);
  });
});

describe("shouldHandleWatchSignal", () => {
  it("ignores empty filenames on a directory watch so skills noise cannot abort turns", () => {
    const { skills } = makeFixture();
    expect(shouldHandleWatchSignal(skills, skills, "")).toBe(false);
  });

  it("accepts empty filenames only for an existing file watch", () => {
    const { mcp } = makeFixture();
    expect(shouldHandleWatchSignal(mcp, mcp, "")).toBe(true);
  });

  it("does not treat ancestor-directory empty events as mcp.json changes", () => {
    const { root, mcp } = makeFixture();
    expect(shouldHandleWatchSignal(root, mcp, "")).toBe(false);
  });

  it("accepts the real mcp.json filename when watching the parent", () => {
    const { root, mcp } = makeFixture();
    expect(shouldHandleWatchSignal(root, mcp, "mcp.json")).toBe(true);
  });

  it("ignores sibling skill writes when the watched path is mcp.json", () => {
    const { root, mcp } = makeFixture();
    expect(shouldHandleWatchSignal(root, mcp, `skills${sep}foo`)).toBe(false);
  });
});
