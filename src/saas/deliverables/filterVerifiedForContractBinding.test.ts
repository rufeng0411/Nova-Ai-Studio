import { describe, expect, it } from "vitest";
import { filterVerifiedForContractBinding } from "./filterVerifiedForContractBinding.js";

describe("filterVerifiedForContractBinding", () => {
  it("removes README and deliverables-index from verified binding", () => {
    const filtered = filterVerifiedForContractBinding([
      "artifacts/campaign/README.md",
      "artifacts/campaign/deliverables-index.md",
      "artifacts/campaign/brief.md",
    ]);
    expect(filtered).toEqual(["artifacts/campaign/brief.md"]);
  });

  it("dedupes same basename keeping shallower path (C5)", () => {
    const filtered = filterVerifiedForContractBinding([
      "artifacts/geo/deep/nested/01-aeo-audit-checklist.md",
      "artifacts/geo/01-aeo-audit-checklist.md",
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toBe("artifacts/geo/01-aeo-audit-checklist.md");
  });

  it("scopes verified to scopeDir (C6)", () => {
    const filtered = filterVerifiedForContractBinding(
      [
        "artifacts/monitor-razer/rank-track.csv",
        "artifacts/research-other/notes.md",
      ],
      { scopeDir: "artifacts/monitor-razer" },
    );
    expect(filtered).toEqual(["artifacts/monitor-razer/rank-track.csv"]);
  });

  it("returns empty when all paths are out of scope (P0-A′ no fallback)", () => {
    const filtered = filterVerifiedForContractBinding(
      [
        "artifacts/task-20260722-a7a1f199/promo-video.mp4",
        "artifacts/task-other/report.md",
      ],
      { scopeDir: "artifacts/task-20260722-be61b997" },
    );
    expect(filtered).toEqual([]);
  });

  it("ES9 RCA: prefers scopeDir when deduping same basename across task dirs", () => {
    const filtered = filterVerifiedForContractBinding(
      [
        "artifacts/task-20260722-1b897c91/report.pdf",
        "artifacts/task-20260723-fd6c3d5f/report.pdf",
        "artifacts/task-20260722-1b897c91/report.docx",
        "artifacts/task-20260723-fd6c3d5f/report.docx",
        "artifacts/task-20260723-fd6c3d5f/report.pptx",
      ],
      { scopeDir: "artifacts/task-20260723-fd6c3d5f" },
    );
    expect(filtered).toEqual([
      "artifacts/task-20260723-fd6c3d5f/report.pdf",
      "artifacts/task-20260723-fd6c3d5f/report.docx",
      "artifacts/task-20260723-fd6c3d5f/report.pptx",
    ]);
  });

  it("filters VAP prepared assets from verified binding", () => {
    const filtered = filterVerifiedForContractBinding([
      "artifacts/task-20260725-6ca341f6/competitor-benchmark-report.md",
      "artifacts/task-20260725-6ca341f6/assets/prepared/deepseek-report_inline.png",
      "artifacts/task-20260725-6ca341f6/visual-asset-manifest.json",
      "artifacts/task-20260725-6ca341f6/index-preview.png",
    ], { scopeDir: "artifacts/task-20260725-6ca341f6" });
    expect(filtered).toEqual([
      "artifacts/task-20260725-6ca341f6/competitor-benchmark-report.md",
    ]);
  });
});
