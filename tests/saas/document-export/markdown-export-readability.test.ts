import assert from "node:assert/strict";
import test from "node:test";
import { parseMarkdownToIr } from "../../../src/saas/document-export/parseMarkdown.js";
import {
  markdownInlineToHtml,
  normalizeMarkdownInline,
} from "../../../src/saas/document-export/markdownInline.js";
import { irToStandaloneHtml } from "../../../src/saas/document-export/buildIr.js";

test("strips bold markers for plain export text", () => {
  assert.equal(
    normalizeMarkdownInline("核心用户以 **中小企业营销人员** 为主"),
    "核心用户以 中小企业营销人员 为主",
  );
});

test("converts markdown links to readable labels", () => {
  assert.equal(normalizeMarkdownInline("[信息采集](#1-信息采集)"), "信息采集");
  assert.equal(
    normalizeMarkdownInline("[官网](http://www.novapage.online)"),
    "官网（http://www.novapage.online）",
  );
});

test("renders bold as strong in PDF HTML", () => {
  const html = markdownInlineToHtml("选择 **生成质量** 优先");
  assert.match(html, /<strong>生成质量<\/strong>/);
  assert.doesNotMatch(html, /\*\*/);
});

test("parses blockquote blocks and keeps inline markdown in IR", () => {
  const md = [
    "> **研究对象**：http://www.novapage.online",
    "",
    "核心发现：**效率低** 与 [详情](#x) 并存",
  ].join("\n");

  const ir = parseMarkdownToIr("report.md", md);
  assert.deepEqual(ir.blocks[0], {
    type: "blockquote",
    text: "**研究对象**：http://www.novapage.online",
  });
  assert.deepEqual(ir.blocks[1], {
    type: "paragraph",
    text: "核心发现：**效率低** 与 [详情](#x) 并存",
  });
});

test("builds standalone HTML without raw markdown markers", () => {
  const ir = parseMarkdownToIr("sample-research-report.md", "# 标题\n\n**加粗** 文本");
  const html = irToStandaloneHtml(ir);
  assert.doesNotMatch(html, /\*\*/);
  assert.match(html, /<strong>加粗<\/strong>/);
});
