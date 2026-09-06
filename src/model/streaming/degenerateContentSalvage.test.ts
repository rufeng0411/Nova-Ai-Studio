import { describe, expect, it } from "vitest";
import {
  findDegenerateCut,
  readWriteToolContent,
  salvageDegenerateContent,
  withSalvagedContent,
  FILE_WRITE_TOOL_NAMES,
} from "./degenerateContentSalvage.js";

const GTM_LINE = "✅ 全车原厂背书，免去年检烦恼，全车原厂质保（非副厂拼装），免去年检烦恼。";

describe("salvageDegenerateContent — consecutive line repeat", () => {
  it("trims a runaway repeated line and keeps one clean instance", () => {
    const clean = "# GTM 方案\n\n## 一、谁在买\n硬核越野老炮：追求极限性能与原厂质保保障。\n";
    const content = clean + Array(10).fill(GTM_LINE).join("\n") + "\n";
    const result = salvageDegenerateContent(content);
    expect(result.trimmed).toBe(true);
    expect(result.reason).toBe("line_repeat");
    expect(result.content).toContain("# GTM 方案");
    // exactly one surviving copy of the runaway line
    expect(result.content.split(GTM_LINE).length - 1).toBe(1);
    expect(result.removedChars).toBeGreaterThan(0);
  });

  it("appends an HTML comment marker for HTML content", () => {
    const head = "<!DOCTYPE html>\n<html><body>\n<h1>纵横 G700 顶火鸣镝版发布会</h1>\n";
    const badLine = "<p>全车原厂背书，免去年检烦恼，原厂质保非副厂拼装超长重复行内容。</p>";
    const content = head + Array(9).fill(badLine).join("\n") + "\n";
    const result = salvageDegenerateContent(content);
    expect(result.trimmed).toBe(true);
    expect(result.content).toContain("<!--");
    expect(result.content).toContain("自动截断");
  });
});

describe("salvageDegenerateContent — block cycle", () => {
  it("trims a repeated multi-line table block", () => {
    const row1 = "| 硬核越野老炮 | 追求极限通过性与原厂高性能套件保障 |";
    const row2 = "| 新中产跨界玩家 | 看重智能座舱与社交货币属性的体面 |";
    const block = `${row1}\n${row2}`;
    const content = "## 目标客群\n" + Array(6).fill(block).join("\n") + "\n";
    const result = salvageDegenerateContent(content);
    expect(result.trimmed).toBe(true);
    expect(result.reason).toBe("block_repeat");
    // one clean cycle survives (row1 + row2 once)
    expect(result.content.split(row1).length - 1).toBe(1);
    expect(result.content.split(row2).length - 1).toBe(1);
  });
});

describe("salvageDegenerateContent — phrase loop (no newlines)", () => {
  it("trims a runaway no-newline phrase loop", () => {
    const prefix = "这是正文开头部分，内容足够长用于避免被误判为复读循环测试样本。\n";
    const content = prefix + "原厂背书".repeat(40);
    const result = salvageDegenerateContent(content);
    expect(result.trimmed).toBe(true);
    expect(result.reason).toBe("phrase_repeat");
    expect(result.content).toContain("这是正文开头部分");
    expect(result.removedChars).toBeGreaterThan(100);
  });
});

describe("salvageDegenerateContent — no false positives", () => {
  it("leaves a clean structured HTML document untouched", () => {
    const html = [
      "<!DOCTYPE html>",
      "<html lang=\"zh\">",
      "<head><meta charset=\"utf-8\"><title>纵横 G700 GTM</title></head>",
      "<body>",
      "  <header><h1>纵横 G700 顶火鸣镝版</h1></header>",
      "  <section id=\"audience\"><h2>谁在买</h2><p>硬核越野老炮与新中产跨界玩家。</p></section>",
      "  <section id=\"why\"><h2>凭啥选你</h2><p>原厂背书、全套权益、免检省心。</p></section>",
      "  <section id=\"plan\"><h2>90 天怎么打</h2><ol><li>预热</li><li>首发</li><li>口碑</li></ol></section>",
      "  <footer><small>2026 纵横汽车</small></footer>",
      "</body>",
      "</html>",
    ].join("\n");
    const result = salvageDegenerateContent(html);
    expect(result.trimmed).toBe(false);
    expect(result.content).toBe(html);
    expect(result.removedChars).toBe(0);
  });

  it("leaves a normal markdown report untouched", () => {
    const md = [
      "# 纵横 G700 顶火鸣镝版 GTM",
      "",
      "## 一、谁在买",
      "硬核越野老炮：35-45 岁，追求极限通过性，讨厌后期脱保。",
      "新中产跨界玩家：30-40 岁，看重智能化与社交货币。",
      "",
      "## 二、凭啥选你",
      "原厂背书、全套权益、免检省心，差异于副厂拼装方案。",
      "",
      "## 三、90 天怎么打",
      "第 1-30 天预热，31-60 天首发造势，61-90 天口碑沉淀。",
    ].join("\n");
    const result = salvageDegenerateContent(md);
    expect(result.trimmed).toBe(false);
  });

  it("does not trim short content below the region threshold", () => {
    const result = salvageDegenerateContent("短内容\n短内容\n短内容");
    expect(result.trimmed).toBe(false);
  });

  it("does not trip on short repeated bullet lines (below minUnitLength)", () => {
    const content = "# 列表\n" + Array(12).fill("- 项").join("\n");
    const result = salvageDegenerateContent(content);
    expect(result.trimmed).toBe(false);
  });
});

describe("findDegenerateCut — prefers earliest cut", () => {
  it("returns the earliest repetition boundary", () => {
    const clean = "前言段落，内容足够长以构成一个合理的干净前缀文本片段示例。\n";
    const content = clean + Array(10).fill(GTM_LINE).join("\n");
    const cut = findDegenerateCut(content);
    expect(cut).not.toBeNull();
    expect(cut!.cutAt).toBeGreaterThanOrEqual(clean.length);
    // cut keeps clean prefix + exactly the first repeated line
    expect(cut!.cutAt).toBeLessThan(clean.length + GTM_LINE.length + 5);
  });
});

describe("write-tool content helpers", () => {
  it("reads content / new_string fields", () => {
    expect(readWriteToolContent({ content: "x" })).toBe("x");
    expect(readWriteToolContent({ new_string: "y" })).toBe("y");
    expect(readWriteToolContent({ file_path: "z" })).toBeNull();
    expect(readWriteToolContent("not an object")).toBeNull();
  });

  it("re-attaches salvaged content onto the right field", () => {
    expect(withSalvagedContent({ file_path: "a.html", content: "old" }, "new")).toEqual({
      file_path: "a.html",
      content: "new",
    });
    expect(withSalvagedContent({ file_path: "a.html", old_string: "o", new_string: "old" }, "new")).toEqual({
      file_path: "a.html",
      old_string: "o",
      new_string: "new",
    });
  });

  it("recognizes the write tools", () => {
    expect(FILE_WRITE_TOOL_NAMES.has("write_file")).toBe(true);
    expect(FILE_WRITE_TOOL_NAMES.has("edit_file")).toBe(true);
    expect(FILE_WRITE_TOOL_NAMES.has("read_file")).toBe(false);
  });
});
