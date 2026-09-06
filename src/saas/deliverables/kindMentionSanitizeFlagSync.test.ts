import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("kind-mention sanitize flag sync", () => {
  it("pack + apply-cloud-perf-env + launcher default to enforce", () => {
    const pack = readFileSync(path.join(ROOT, "scripts/release/pack.mjs"), "utf8");
    const apply = readFileSync(path.join(ROOT, "scripts/release/apply-cloud-perf-env.sh"), "utf8");
    const launcher = readFileSync(path.join(ROOT, "scripts/lib/devLauncherCore.mjs"), "utf8");
    expect(pack).toMatch(/PILOTDECK_KIND_MENTION_SANITIZE:\s*'enforce'/);
    expect(apply).toMatch(/PILOTDECK_KIND_MENTION_SANITIZE=enforce/);
    expect(launcher).toMatch(/PILOTDECK_KIND_MENTION_SANITIZE:\s*'enforce'/);
    expect(pack).not.toMatch(/PILOTDECK_KIND_MENTION_SANITIZE:\s*'shadow'/);
    expect(apply).not.toMatch(/PILOTDECK_KIND_MENTION_SANITIZE=shadow/);
    expect(launcher).not.toMatch(/PILOTDECK_KIND_MENTION_SANITIZE:\s*'shadow'/);
  });
});
