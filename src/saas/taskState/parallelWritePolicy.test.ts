import { afterEach, describe, expect, it } from "vitest";
import {
  isParallelOfficeExportAllowed,
  isParallelWriteFileAllowed,
  isSharedSerialWritePath,
} from "./parallelWritePolicy.js";

describe("parallelWritePolicy", () => {
  afterEach(() => {
    delete process.env.PILOTDECK_PARALLEL_WRITE_FILE;
    delete process.env.PILOTDECK_PARALLEL_OFFICE_EXPORT;
    delete process.env.PILOTDECK_SEQUENTIAL_DELIVERABLES;
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("keeps write_file serial unless enforce and sequential is not enforce", () => {
    process.env.PILOTDECK_PARALLEL_WRITE_FILE = "shadow";
    expect(isParallelWriteFileAllowed("artifacts/task-x/a.md")).toBe(false);
    process.env.PILOTDECK_PARALLEL_WRITE_FILE = "enforce";
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_SEQUENTIAL_DELIVERABLES = "enforce";
    expect(isParallelWriteFileAllowed("artifacts/task-x/a.md")).toBe(false);
    process.env.PILOTDECK_SEQUENTIAL_DELIVERABLES = "shadow";
    expect(isParallelWriteFileAllowed("artifacts/task-x/a.md")).toBe(true);
    expect(isParallelWriteFileAllowed("artifacts/task-x/data-sources.md")).toBe(false);
  });

  it("never marks data-sources.md as concurrency-safe", () => {
    expect(isSharedSerialWritePath("artifacts/task-x/data-sources.md")).toBe(true);
    expect(isSharedSerialWritePath("artifacts/task-x/report.md")).toBe(false);
  });

  it("office export parallel only in enforce", () => {
    process.env.PILOTDECK_PARALLEL_OFFICE_EXPORT = "shadow";
    expect(isParallelOfficeExportAllowed("artifacts/task-x/a.pdf")).toBe(false);
    process.env.PILOTDECK_PARALLEL_OFFICE_EXPORT = "enforce";
    process.env.PILOTDECK_SEQUENTIAL_DELIVERABLES = "off";
    expect(isParallelOfficeExportAllowed("artifacts/task-x/a.pdf")).toBe(true);
  });
});
