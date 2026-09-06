// PD-SAAS-FORK VAP: minimal synthetic visual-deliverable harness cases (platform-generic).

export type VisualDeliverableCoreCase = {
  id: string;
  label: string;
  /** Repo-relative task dir under tests/fixtures/visual-deliverable-core/ */
  taskArtifactDir: string;
  htmlRelPath: string;
  projectName: string;
  expectBound: boolean;
  expectSrcOnDisk: boolean;
};

export const VISUAL_DELIVERABLE_CORE_CASES: VisualDeliverableCoreCase[] = [
  {
    id: "core-bound-html",
    label: "HTML img src matches manifest raw path",
    taskArtifactDir: "tests/fixtures/visual-deliverable-core/core-bound",
    htmlRelPath: "tests/fixtures/visual-deliverable-core/core-bound/index.html",
    projectName: "general",
    expectBound: true,
    expectSrcOnDisk: true,
  },
  {
    id: "core-broken-src",
    label: "HTML img src missing on disk",
    taskArtifactDir: "tests/fixtures/visual-deliverable-core/core-broken-src",
    htmlRelPath: "tests/fixtures/visual-deliverable-core/core-broken-src/index.html",
    projectName: "general",
    expectBound: false,
    expectSrcOnDisk: false,
  },
];
