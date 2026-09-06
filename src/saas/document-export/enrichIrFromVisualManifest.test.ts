import { describe, expect, it } from "vitest";
import path from "node:path";

import { parseMarkdownToIr } from "./parseMarkdown.js";
import {
  countDocumentIrImageBlocks,
  enrichDocumentIrFromVisualManifest,
} from "./enrichIrFromVisualManifest.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const CORE_BOUND_DIR = "tests/fixtures/visual-deliverable-core/core-bound";

describe("enrichIrFromVisualManifest", () => {
  it("injects official manifest images into document IR", async () => {
    const baseIr = parseMarkdownToIr(
      `${CORE_BOUND_DIR}/campaign-brief.md`,
      "# Campaign\n\nBrief body.",
    );
    expect(countDocumentIrImageBlocks(baseIr)).toBe(0);

    const enriched = await enrichDocumentIrFromVisualManifest({
      ir: baseIr,
      workspaceRoot: REPO_ROOT,
      taskArtifactDir: CORE_BOUND_DIR,
      sessionId: "fixture",
    });

    expect(countDocumentIrImageBlocks(enriched)).toBeGreaterThanOrEqual(1);
    const imageBlock = enriched.blocks.find((block) => block.type === "image");
    expect(imageBlock?.type).toBe("image");
    if (imageBlock?.type === "image") {
      expect(imageBlock.src).toContain("sessions/fixture-session/downloads/hero.jpg");
    }
  });
});
