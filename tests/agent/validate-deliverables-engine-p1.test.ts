import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateEngineDeliverables,
} from "../../src/agent/deliverables/validateDeliverablesEngine.js";
import type { CanonicalMessage } from "../../src/model/index.js";
import type {
  SessionDeliverableManifest,
  SessionDeliverableSlot,
} from "../../src/saas/taskState/sessionDeliverableManifest.js";

const TASK_DIR = "artifacts/social-matrix";
const INDEX_PATH = `${TASK_DIR}/index.md`;

type DegradedSessionSlot = SessionDeliverableSlot & {
  allowDegraded?: boolean;
  degradedReason?: string;
};

function manifest(slot: DegradedSessionSlot = {
  id: "social_pack",
  label: "目录成果",
  kind: "markdown",
  required: true,
  pathHint: INDEX_PATH,
  status: "active",
}): SessionDeliverableManifest {
  return {
    manifestVersion: 1,
    goalVersion: 1,
    sessionGoalAnchor: `请生成约定目录成果文件 ${INDEX_PATH}`,
    profileId: "social_matrix",
    baselineLocked: true,
    taskArtifactDir: TASK_DIR,
    slots: [slot],
  };
}

function messages(): CanonicalMessage[] {
  return [
    {
      role: "user",
      content: [{ type: "text", text: `请生成约定目录成果文件 ${INDEX_PATH}` }],
    },
    {
      role: "assistant",
      content: [{ type: "text", text: `成果已写入 ${INDEX_PATH}` }],
    },
  ];
}

async function writeArtifact(
  cwd: string,
  relativePath: string,
  body = "目录成果正文。".repeat(80),
): Promise<void> {
  const absolutePath = join(cwd, ...relativePath.split("/"));
  await mkdir(join(absolutePath, ".."), { recursive: true });
  await writeFile(absolutePath, body, "utf8");
}

async function validate(cwd: string, sessionManifest = manifest()) {
  const result = await validateEngineDeliverables({
    cwd,
    userGoal: sessionManifest.sessionGoalAnchor,
    messages: messages(),
    sessionManifest,
  });
  if (!result) throw new Error("expected deliverable validation result");
  return result;
}

describe("validateDeliverablesEngine P1 composite quality integration", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "pilotdeck-composite-p1-"));
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2 = "off";
    process.env.PILOTDECK_CONTRACT_AUTHORITY_V2 = "off";
    await writeArtifact(cwd, INDEX_PATH);
  });

  afterEach(async () => {
    delete process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY;
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    delete process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2;
    delete process.env.PILOTDECK_CONTRACT_AUTHORITY_V2;
    await rm(cwd, { recursive: true, force: true });
  });

  it("records index-only shadow assessment without changing legacy acceptance", async () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "shadow";
    const result = await validate(cwd);

    expect(result.acceptance).toBe("passed");
    expect(result.compositeSlotQuality).toEqual([
      expect.objectContaining({
        slotId: "social_pack",
        complete: false,
        reason: "composite_directory_incomplete",
      }),
    ]);
    expect(result).not.toHaveProperty("acceptanceCertificate");
  });

  it("vetoes strict passed for an index-only directory in enforce mode", async () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "enforce";
    const result = await validate(cwd);

    expect(result.legacyAcceptance).toBe("passed");
    expect(result.acceptance).toBe("needs_repair");
    expect(result.missing).toContain(
      `${TASK_DIR}/brief.md`,
    );
    expect(result).not.toHaveProperty("acceptanceCertificate");
  });

  it("emits no assessment and keeps legacy behavior while off", async () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "off";
    const result = await validate(cwd);

    expect(result.acceptance).toBe("passed");
    expect(result.compositeSlotQuality).toBeUndefined();
    expect(result).not.toHaveProperty("acceptanceCertificate");
  });

  it("passes enforce mode when the profile minimum file group exists in scope", async () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "enforce";
    await Promise.all([
      writeArtifact(cwd, `${TASK_DIR}/brief.md`),
      writeArtifact(cwd, `${TASK_DIR}/creative-anchors.md`),
      writeArtifact(cwd, `${TASK_DIR}/copywriting.md`),
      writeArtifact(cwd, `${TASK_DIR}/manifest.json`, "{\"version\":1}"),
    ]);
    const result = await validate(cwd);

    expect(result.acceptance).toBe("passed");
    expect(result.compositeSlotQuality?.[0]).toEqual(
      expect.objectContaining({ complete: true, missingBasenames: [] }),
    );
  });

  it("passes an explicitly allowed degraded placeholder and records its reason", async () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "enforce";
    const degradedReason = "图片服务不可用，清单明确允许本轮占位";
    const result = await validate(cwd, manifest({
      id: "social_pack",
      label: "目录成果（degraded placeholder）",
      kind: "markdown",
      required: true,
      pathHint: INDEX_PATH,
      status: "active",
      allowDegraded: true,
      degradedReason,
    }));

    expect(result.acceptance).toBe("passed");
    expect(result.compositeSlotQuality?.[0]).toEqual(
      expect.objectContaining({
        complete: true,
        degraded: true,
        degradedReason,
      }),
    );
    expect(result).not.toHaveProperty("acceptanceCertificate");
  });

  it("derives an auditable reason when the manifest explicitly allows degradation", async () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "enforce";
    const result = await validate(cwd, manifest({
      id: "social_pack",
      label: "目录成果（degraded placeholder）",
      kind: "markdown",
      required: true,
      pathHint: INDEX_PATH,
      status: "active",
      allowDegraded: true,
    }));

    expect(result.acceptance).toBe("passed");
    expect(result.compositeSlotQuality?.[0]).toEqual(
      expect.objectContaining({
        complete: true,
        degraded: true,
        degradedReason: "manifest_explicit_degraded_placeholder",
      }),
    );
  });

  it("does not count profile files outside the frozen task scope", async () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "enforce";
    await Promise.all([
      writeArtifact(cwd, "artifacts/other-task/brief.md"),
      writeArtifact(cwd, "artifacts/other-task/creative-anchors.md"),
      writeArtifact(cwd, "artifacts/other-task/copywriting.md"),
      writeArtifact(cwd, "artifacts/other-task/manifest.json", "{\"version\":1}"),
    ]);
    const result = await validate(cwd);

    expect(result.acceptance).toBe("needs_repair");
    expect(result.compositeSlotQuality?.[0]?.observedPaths).toEqual([
      INDEX_PATH,
    ]);
  });
});
