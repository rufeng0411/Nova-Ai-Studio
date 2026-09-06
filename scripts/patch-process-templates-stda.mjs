import { readFileSync, writeFileSync } from "node:fs";

const path = "config/process-templates.json";
let text = readFileSync(path, "utf8");
const replacements = [
  [/artifacts\/geo\/[^\s"\\]+/g, "系统分配的任务目录"],
  [/artifacts\/research[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/content-\{[^\}]+\}/g, "系统分配的任务目录"],
  [/artifacts\/campaign[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/social-matrix[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/slides[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/promo[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/podcast[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/matrix[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/data-story[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/xhs[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/debate[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/sales[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/legal[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/ad-storyboard[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/viral-script[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/short-drama[^\s"\\]*/g, "系统分配的任务目录"],
  [/artifacts\/saas-demo[^\s"\\]*/g, "系统分配的任务目录"],
  [/产出到 artifacts\//g, "产出到系统分配的任务目录"],
  [/save under artifacts\/[^\s"\\]*/gi, "save under the assigned task directory"],
  [/under artifacts\/[^\s"\\]*/gi, "under the assigned task directory"],
];
for (const [pattern, replacement] of replacements) {
  text = text.replace(pattern, replacement);
}
writeFileSync(path, text);
console.log("patched process-templates.json");
