import { describe, expect, it } from "vitest";
import {
  filterAcceptancePathsForScope,
  pathUnderAcceptanceScope,
} from "./filterAcceptancePathsForScope.js";

describe("filterAcceptancePathsForScope", () => {
  it("keeps in-scope paths only", () => {
    expect(filterAcceptancePathsForScope(
      ["artifacts/task-a/a.md", "artifacts/task-b/b.md"],
      "artifacts/task-a",
    )).toEqual(["artifacts/task-a/a.md"]);
  });

  it("returns all when scope missing", () => {
    expect(filterAcceptancePathsForScope(["a.md", "b.md"], null)).toEqual(["a.md", "b.md"]);
  });

  it("pathUnderAcceptanceScope rejects sibling task dirs", () => {
    expect(pathUnderAcceptanceScope(
      "artifacts/task-b/promo-video.mp4",
      "artifacts/task-a",
    )).toBe(false);
  });
});
