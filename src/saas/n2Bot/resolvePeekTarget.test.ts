import { describe, expect, it } from "vitest";
import { isPeekResolveAsk, resolvePeekTarget } from "./resolvePeekTarget.js";
import type { N2OpsItem } from "./n2BotTypes.js";

const weekly: N2OpsItem = {
  workerSessionId: "w-weekly",
  title: "周会",
  status: "done",
  step: "搞定",
  files: [
    { path: "artifacts/task-1/提案.pdf", kind: "pdf", label: "提案" },
    { path: "artifacts/task-1/提纲.md", kind: "md", label: "提纲" },
  ],
};

const research: N2OpsItem = {
  workerSessionId: "w-research",
  title: "调研",
  status: "done",
  step: "搞定",
  files: [{ path: "artifacts/task-2/报告.html", kind: "html", label: "报告" }],
};

const twoPdf: N2OpsItem = {
  workerSessionId: "w-pack",
  title: "材料包",
  status: "done",
  step: "搞定",
  files: [
    { path: "a/提案.pdf", kind: "pdf", label: "提案" },
    { path: "a/附录.pdf", kind: "pdf", label: "附录" },
  ],
};

describe("resolvePeekTarget", () => {
  it("opens 提案 PDF on focused weekly card", () => {
    const hit = resolvePeekTarget({
      text: "打开这个任务的提案 PDF",
      cards: [weekly, research],
      lastFocusCardId: "w-weekly",
    });
    expect(hit && "path" in hit && hit.path).toContain("提案.pdf");
    expect(hit && "workerSessionId" in hit && hit.workerSessionId).toBe("w-weekly");
  });

  it("title 周会 wins without lastFocus", () => {
    const hit = resolvePeekTarget({
      text: "打开周会",
      cards: [weekly, research],
    });
    expect(hit && "workerSessionId" in hit && hit.workerSessionId).toBe("w-weekly");
  });

  it("第二份 picks the second PDF", () => {
    const hit = resolvePeekTarget({
      text: "打开第二份",
      cards: [twoPdf],
      lastFocusCardId: "w-pack",
    });
    expect(hit && "path" in hit && hit.path).toContain("附录.pdf");
  });

  it("single file opens without asking", () => {
    const hit = resolvePeekTarget({
      text: "打开某一个",
      cards: [research],
    });
    expect(isPeekResolveAsk(hit)).toBe(false);
    expect(hit && "path" in hit && hit.path).toContain("报告.html");
  });

  it("ambiguous two files returns ask + fallback", () => {
    const hit = resolvePeekTarget({
      text: "打开某一个",
      cards: [twoPdf],
    });
    expect(isPeekResolveAsk(hit)).toBe(true);
    if (hit && "ask" in hit) {
      expect(hit.fallback.path).toContain(".pdf");
    }
  });
});
