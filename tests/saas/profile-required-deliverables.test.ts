import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkProfileRequiredDeliverables,
  shouldEnforceProfileRequiredFiles,
} from "../../src/saas/deliverables/profileRequiredDeliverables.js";
import { resolveProfile } from "../../src/saas/deliverableCapabilityProfiles.js";

test("storyboard pack goal enforces three required basenames", async () => {
  const goal = "用「连续性分镜包」输出 bible、镜头卡、交接矩阵";
  const profile = resolveProfile("create-vid-storyboard-pack", undefined, goal);
  assert.equal(profile.id, "storyboard");
  assert.equal(shouldEnforceProfileRequiredFiles(goal, profile), true);

  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-storyboard-"));
  await fs.mkdir(path.join(cwd, "artifacts", "pack"), { recursive: true });
  await fs.writeFile(path.join(cwd, "artifacts", "pack", "continuity_bible.md"), "# bible\n");
  await fs.writeFile(path.join(cwd, "artifacts", "pack", "shot_cards.md"), "# shots\n");

  const checks = await checkProfileRequiredDeliverables({
    cwd,
    userGoal: goal,
    capabilitySlug: "create-vid-storyboard-pack",
  });
  assert.equal(checks.length, 3);
  assert.equal(checks.find((c) => c.basename === "continuity_bible.md")?.exists, true);
  assert.equal(checks.find((c) => c.basename === "shot_cards.md")?.exists, true);
  assert.equal(checks.find((c) => c.basename === "handoff_design_matrix.md")?.exists, false);
});

test("seedance-only goal does not enforce storyboard pack basenames", async () => {
  const goal = "写 15 秒 Seedance 2.0 分镜提示词";
  const profile = resolveProfile("create-vid-seedance-prompt", undefined, goal);
  assert.equal(profile.id, "storyboard");
  assert.equal(shouldEnforceProfileRequiredFiles(goal, profile), false);

  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-seedance-"));
  const checks = await checkProfileRequiredDeliverables({
    cwd,
    userGoal: goal,
    capabilitySlug: "create-vid-seedance-prompt",
  });
  assert.deepEqual(checks, []);
});

test("resolveProfile storyboard slug and goal fallbacks", () => {
  const pack = resolveProfile("create-vid-storyboard-pack", undefined, "连续性分镜包 bible 镜头卡 交接矩阵");
  assert.equal(pack.id, "storyboard");
  assert.ok(pack.requiredBasenames?.includes("handoff_design_matrix.md"));

  const seedance = resolveProfile(undefined, undefined, "Seedance 分镜提示词");
  assert.equal(seedance.id, "storyboard");
  assert.equal(seedance.recoveryKind, "storyboard");
});
