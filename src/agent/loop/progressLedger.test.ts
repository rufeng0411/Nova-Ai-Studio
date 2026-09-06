import { describe, expect, it } from "vitest";
import {
  ProgressLedger,
  classifyLedgerTurn,
  fingerprint,
  writeEditFingerprint,
} from "./progressLedger.js";

const write = (path: string, content: string) => ({
  name: "write_file",
  input: { file_path: path, content },
});

describe("writeEditFingerprint", () => {
  it("fingerprints write/edit tools and ignores others", () => {
    expect(writeEditFingerprint("write_file", { file_path: "a.md", content: "x" })).toBe(
      `w:a.md#${fingerprint("x")}`,
    );
    expect(writeEditFingerprint("read_file", { file_path: "a.md" })).toBeNull();
    expect(writeEditFingerprint("export_document", {})).toBeNull();
  });

  it("changes when content changes, stable when identical", () => {
    const a = writeEditFingerprint("edit_file", { file_path: "a.md", new_string: "v1" });
    const b = writeEditFingerprint("edit_file", { file_path: "a.md", new_string: "v2" });
    const c = writeEditFingerprint("edit_file", { file_path: "a.md", new_string: "v1" });
    expect(a).not.toBe(b);
    expect(a).toBe(c);
  });
});

describe("classifyLedgerTurn", () => {
  it("treats any action tool as progress", () => {
    expect(classifyLedgerTurn([{ name: "export_document", input: {} }]).kind).toBe("progress");
    expect(classifyLedgerTurn([{ name: "generate_image", input: {} }]).kind).toBe("progress");
  });

  it("treats read-only-only turns as neutral (read tracker owns them)", () => {
    expect(classifyLedgerTurn([{ name: "read_file", input: { file_path: "a.md" } }]).kind).toBe("neutral");
  });

  it("keys write turns by path+content fingerprint", () => {
    const turn = classifyLedgerTurn([write("a.md", "hello")]);
    expect(turn.kind).toBe("key");
  });

  it("fingerprints substantial thinking on no-tool turns", () => {
    const longThought =
      "我需要仔细分析这个问题的每一个方面以便给出完整准确的回答和结论，并且确认所有边界情况都已经被妥善处理过了。";
    expect(longThought.length).toBeGreaterThanOrEqual(40);
    expect(classifyLedgerTurn([], longThought).kind).toBe("key");
    expect(classifyLedgerTurn([], "短").kind).toBe("neutral");
  });
});

describe("ProgressLedger", () => {
  it("flags a write-same-content loop at nudge then terminal", () => {
    const ledger = new ProgressLedger(3, 5);
    expect(ledger.record([write("r.md", "same")])).toBe("none"); // streak 1
    expect(ledger.record([write("r.md", "same")])).toBe("none"); // streak 2
    expect(ledger.record([write("r.md", "same")])).toBe("nudge"); // streak 3 (>= nudgeAt)
    expect(ledger.record([write("r.md", "same")])).toBe("nudge"); // streak 4 (still in nudge band)
    expect(ledger.record([write("r.md", "same")])).toBe("terminal"); // streak 5 (>= terminalAt)
  });

  it("does NOT flag legitimate iterative edits that change content", () => {
    const ledger = new ProgressLedger(3, 5);
    for (let i = 0; i < 8; i += 1) {
      expect(ledger.record([write("r.md", `version-${i}`)])).toBe("none");
    }
    expect(ledger.currentStreak).toBe(1);
  });

  it("resets the streak when a real action tool runs", () => {
    const ledger = new ProgressLedger(3, 5);
    ledger.record([write("r.md", "same")]);
    ledger.record([write("r.md", "same")]);
    expect(ledger.record([{ name: "export_document", input: {} }])).toBe("none");
    expect(ledger.currentStreak).toBe(0);
  });

  it("does not let neutral read turns reset an ongoing write loop", () => {
    const ledger = new ProgressLedger(3, 5);
    ledger.record([write("r.md", "same")]); // 1
    ledger.record([write("r.md", "same")]); // 2
    ledger.record([{ name: "read_file", input: { file_path: "x" } }]); // neutral, no reset
    expect(ledger.record([write("r.md", "same")])).toBe("nudge"); // 3
  });

  it("flags a repeated-thinking loop on no-tool turns", () => {
    const ledger = new ProgressLedger(3, 5);
    const thought =
      "这是一段足够长且保持不变的思考内容用于模拟模型在原地反复打转而没有产生任何实际的新进展或交付。";
    expect(thought.length).toBeGreaterThanOrEqual(40);
    expect(ledger.record([], thought)).toBe("none");
    expect(ledger.record([], thought)).toBe("none");
    expect(ledger.record([], thought)).toBe("nudge");
  });
});
