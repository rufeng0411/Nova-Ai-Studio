// PD-SAAS-FORK VAP P3: eight-case visual binding replay fixtures.

export type VisualBindingReplayCase = {
  id: string;
  label: string;
  taskArtifactDir: string;
  verifiedPaths: string[];
  htmlContent: string;
  manifestAssets: Array<{
    source: "official_fetch" | "authority_site" | "generate_image" | "placeholder";
    rawPath: string;
    preparedPath?: string;
  }>;
  expectRepair: boolean;
};

export const G700_VISUAL_BINDING_EIGHT_CASES: VisualBindingReplayCase[] = [
  {
    id: "html-demo-c682",
    label: "HTML 8页演示 — raw 在盘 HTML 占位",
    taskArtifactDir: "artifacts/task-demo-html",
    verifiedPaths: ["artifacts/task-demo-html/index.html", "artifacts/task-demo-html/assets/raw/hero.jpg"],
    htmlContent: '<img src="assets/placeholder.svg" alt="hero">',
    manifestAssets: [{ source: "official_fetch", rawPath: "artifacts/task-demo-html/assets/raw/hero.jpg" }],
    expectRepair: true,
  },
  {
    id: "hero-81ff",
    label: "Hero 石墨风 — placeholder.svg 交付",
    taskArtifactDir: "artifacts/task-demo-hero",
    verifiedPaths: ["artifacts/task-demo-hero/index.html"],
    htmlContent: '<img src="assets/placeholder.svg">',
    manifestAssets: [{ source: "official_fetch", rawPath: "artifacts/task-demo-hero/assets/raw/product-1.jpg" }],
    expectRepair: true,
  },
  {
    id: "research-473e",
    label: "Nova 用研 — generate_image 未绑 manifest",
    taskArtifactDir: "artifacts/task-demo-research",
    verifiedPaths: ["artifacts/task-demo-research/report.html"],
    htmlContent: '<img src="assets/ai-cover.png">',
    manifestAssets: [{ source: "official_fetch", rawPath: "artifacts/task-demo-research/assets/raw/chart.jpg" }],
    expectRepair: true,
  },
  {
    id: "campaign-e0d5",
    label: "Campaign — key-visual generate_image",
    taskArtifactDir: "artifacts/task-demo-campaign",
    verifiedPaths: ["artifacts/task-demo-campaign/key-visual-poster.png"],
    htmlContent: "",
    manifestAssets: [{ source: "official_fetch", rawPath: "artifacts/task-demo-campaign/assets/raw/kv.jpg" }],
    expectRepair: true,
  },
  {
    id: "nova-slide-8e3b",
    label: "Nova 幻灯 — slide generate_image",
    taskArtifactDir: "artifacts/slides-demo-deck",
    verifiedPaths: ["artifacts/slides-demo-deck/slide-01.png"],
    htmlContent: "",
    manifestAssets: [{ source: "official_fetch", rawPath: "artifacts/slides-demo-deck/assets/raw/exterior.jpg" }],
    expectRepair: true,
  },
  {
    id: "bound-pass-a",
    label: "HTML 已绑 manifest — 应通过",
    taskArtifactDir: "artifacts/task-bound-a",
    verifiedPaths: ["artifacts/task-bound-a/index.html"],
    htmlContent: '<img src="assets/raw/hero.jpg" alt="hero">',
    manifestAssets: [{ source: "official_fetch", rawPath: "artifacts/task-bound-a/assets/raw/hero.jpg" }],
    expectRepair: false,
  },
  {
    id: "bound-pass-b",
    label: "Markdown 已绑 manifest — 应通过",
    taskArtifactDir: "artifacts/task-bound-b",
    verifiedPaths: ["artifacts/task-bound-b/report.md"],
    htmlContent: "![cover](assets/raw/cover.jpg)",
    manifestAssets: [{ source: "authority_site", rawPath: "artifacts/task-bound-b/assets/raw/cover.jpg" }],
    expectRepair: false,
  },
  {
    id: "no-official-skip",
    label: "manifest 无 official 级 — 跳过 binding veto",
    taskArtifactDir: "artifacts/task-no-official",
    verifiedPaths: ["artifacts/task-no-official/index.html"],
    htmlContent: '<img src="assets/placeholder.svg">',
    manifestAssets: [{ source: "generate_image", rawPath: "artifacts/task-no-official/assets/ai.png" }],
    expectRepair: false,
  },
];
