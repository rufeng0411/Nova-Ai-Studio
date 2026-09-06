import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateEngineDeliverables } from "../../src/agent/deliverables/validateDeliverablesEngine.js";
import type { SessionDeliverableManifest } from "../../src/saas/taskState/sessionDeliverableManifest.js";
import type { CanonicalMessage } from "../../src/model/index.js";
import { ES9_PRODUCT_LAUNCH_GOAL } from "../fixtures/es9-product-launch-goal.js";
import { resolveAuthoritativeSdmSlots } from "../../src/saas/deliverables/deliverableChecklistAuthority.js";

describe("validateDeliverablesEngine progress-alone (ES9 P0-B′)", () => {
  beforeEach(() => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2 = "shadow";
    process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES = "1";
    process.env.PILOTDECK_GROUND_TRUTH_RECONCILE = "0";
  });

  it("kind-only 6/7 progress must not upgrade to passed when landing slot pending", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-es9-launch-"));
    const taskDir = "artifacts/task-20260722-59449e1a";
    const absTask = path.join(cwd, taskDir);
    await fs.mkdir(absTask, { recursive: true });
    const files = [
      "research.md",
      "gtm-strategy.md",
      "press-release.docx",
      "index.html",
      "03-social-matrix.md",
      "go-live-checklist.md",
    ];
    for (const file of files) {
      await fs.writeFile(path.join(absTask, file), file.endsWith(".html") ? "<html></html>" : "# ok");
    }

    const slots = resolveAuthoritativeSdmSlots({
      userGoal: ES9_PRODUCT_LAUNCH_GOAL,
      capabilitySlug: "product-launch-full",
    });
    const manifest: SessionDeliverableManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      taskArtifactDir: taskDir,
      slots: slots.map((slot, index) => ({
        ...slot,
        status: "pending" as const,
        stageOrder: index + 1,
        stageId: `stage_${index + 1}`,
      })),
    };
    const messages: CanonicalMessage[] = [{
      role: "assistant",
      content: files.map((file) => ({
        type: "text" as const,
        text: `${taskDir}/${file}`,
      })),
    }];

    const result = await validateEngineDeliverables({
      cwd,
      messages,
      userGoal: ES9_PRODUCT_LAUNCH_GOAL,
      sessionManifest: manifest,
      capabilitySlug: "product-launch-full",
      majorCategory: "marketing",
    });
    expect(result?.acceptance).not.toBe("passed");
  });
});
