import { describe, expect, it } from "vitest";
import { redirectWritePathToTaskDir } from "./taskPathGuard.js";

describe("taskPathGuard", () => {
  const taskRoot = "artifacts/task-20260710-a1b2c3d4";

  it("redirects bare filenames into task root", () => {
    expect(redirectWritePathToTaskDir("keywords.md", taskRoot))
      .toBe(`${taskRoot}/keywords.md`);
  });

  it("preserves explicit path under a known session task root", () => {
    const otherRoot = "artifacts/task-20260711-ee2a97a0";
    expect(
      redirectWritePathToTaskDir(
        `${otherRoot}/05-website/index.html`,
        taskRoot,
        { knownTaskDirs: [otherRoot] },
      ),
    ).toBe(`${otherRoot}/05-website/index.html`);
  });

  it("re-anchors cross-task path when target root is not known", () => {
    expect(
      redirectWritePathToTaskDir(
        "artifacts/task-20260711-ee2a97a0/05-website/index.html",
        taskRoot,
      ),
    ).toBe(`${taskRoot}/05-website/index.html`);
  });

  it("preserves relative subdir tails (05-website/index.html)", () => {
    expect(redirectWritePathToTaskDir("05-website/index.html", taskRoot))
      .toBe(`${taskRoot}/05-website/index.html`);
  });

  it("keeps paths already under the active task root", () => {
    expect(redirectWritePathToTaskDir(`${taskRoot}/nested/report.md`, taskRoot))
      .toBe(`${taskRoot}/nested/report.md`);
  });
});
