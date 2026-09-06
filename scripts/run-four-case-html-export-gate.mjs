#!/usr/bin/env node
/** PD-SAAS-FORK P0′: parse exported session HTML for four-line / footer KPI gate */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const gate = args.includes("--gate");
const htmlPaths = args.filter((a) => !a.startsWith("--"));

function parseHtmlCase(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  const label = path.basename(filePath);
  const accBlocks = [
    ...html.matchAll(
      /&quot;acceptanceStatus&quot;: &quot;([^&]+)&quot;[\s\S]{0,1200}?&quot;complete&quot;: (true|false)/g,
    ),
  ];
  const lastAcc = accBlocks.at(-1);
  const footerTable = html.match(/data-progress-total="(\d+)"/);
  const footerDone = html.match(/data-progress-done="(\d+)"/);
  const agentCalls = (html.match(/工具调用: agent/g) ?? []).length;
  const hasArticleRow = /article\.md/.test(html) && !/仅.*wechat\.md/i.test(html);
  const wordPhantom = /status-pending[^>]*>[\s\S]{0,200}(?:research-report\.docx|research\.docx)/i.test(html);
  const matrixTotal = label.includes("matrix") || label.includes("2d47bc14");
  const issues = [];
  if (matrixTotal && footerTable && Number(footerTable[1]) < 7) {
    issues.push(`matrix footer total ${footerTable[1]} expected 7`);
  }
  if (matrixTotal && !hasArticleRow) {
    issues.push("matrix missing article.md row");
  }
  if (wordPhantom) {
    issues.push("Word phantom row pending");
  }
  if (agentCalls > 0) {
    issues.push(`agent tool calls=${agentCalls}`);
  }
  if (lastAcc && lastAcc[1] !== "passed") {
    issues.push(`acceptanceStatus=${lastAcc[1]}`);
  }
  return {
    label,
    path: filePath,
    acceptance: lastAcc ? { status: lastAcc[1], complete: lastAcc[2] } : null,
    footer: footerTable ? { total: footerTable[1], done: footerDone?.[1] } : null,
    agentCalls,
    issues,
    ok: issues.length === 0,
  };
}

function main() {
  if (htmlPaths.length === 0) {
    console.log("Usage: node scripts/run-four-case-html-export-gate.mjs --gate <html...>");
    process.exit(gate ? 1 : 0);
  }
  let fail = 0;
  for (const p of htmlPaths) {
    const result = parseHtmlCase(p);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) fail += 1;
  }
  if (fail > 0 && gate) {
    console.error(`[four-case-html-gate] FAIL ${fail}/${htmlPaths.length}`);
    process.exit(1);
  }
  console.log(`[four-case-html-gate] PASS ${htmlPaths.length - fail}/${htmlPaths.length}`);
  process.exit(0);
}

main();
