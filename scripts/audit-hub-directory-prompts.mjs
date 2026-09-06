/**
 * PD-SAAS-FORK: audit Hub / template / skill prompts for forbidden semantic artifact dirs.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

const SEMANTIC_DIR_PATTERN =
  /artifacts\/(?:geo|slides|campaign|research|acquisition|social-matrix|matrix|content|sales|legal|promo|podcast|debate|xhs|data-story|ad-storyboard|viral-script|short-drama|saas-demo)\/|artifacts\/slides-/i;

const ALLOWLIST = [
  /检查【文件或目录路径】/,
  /file or directory path/i,
  /code-review/i,
  /artifacts\/task-\{/,
  /勿读.*artifacts\/slides/,
  /禁止.*artifacts\/geo/,
  /Do not create artifacts\/geo/,
  /never create artifacts\/geo/i,
  /勿把 artifacts\/slides/,
];

const TARGETS = [
  "config/capabilities.overrides.json",
  "config/process-templates.json",
  "config/welcome-prompt-pool.zh-CN.json",
  "scripts/generate-capability-try-prompts.mjs",
  "src/saas/capabilityBindingPrompt.ts",
  "src/saas/processTemplateExecutionPrompt.ts",
  "src/context/prompt/saasCoreStrategy.ts",
];

function walkSkills(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "vendor") continue;
      walkSkills(full, out);
    } else if (entry === "SKILL.md" && /[\\/](pd-geo|nova-ppt-aesthetic-slides)[\\/]/.test(full)) {
      out.push(full);
    }
  }
  return out;
}

const WELCOME_FORBIDDEN = [/存\s*artifacts/i, /artifacts\/归档/i, /直接开写/i];

function scanWelcomePool(relPath, text, hits) {
  let prompts;
  try {
    prompts = JSON.parse(text).prompts;
  } catch {
    return;
  }
  if (!Array.isArray(prompts)) return;
  for (let i = 0; i < prompts.length; i += 1) {
    const line = String(prompts[i] ?? "");
    if (WELCOME_FORBIDDEN.some((re) => re.test(line))) {
      hits.push({ file: relPath, line: i + 1, snippet: line.trim().slice(0, 160) });
    }
  }
}

function scanText(relPath, text, hits) {
  if (relPath.includes("welcome-prompt-pool")) {
    scanWelcomePool(relPath, text, hits);
    return;
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (!SEMANTIC_DIR_PATTERN.test(line)) continue;
    if (ALLOWLIST.some((re) => re.test(line))) continue;
    if (/artifact-naming\.md|frontend-slides\/SKILL\.md/i.test(relPath)) continue;
    hits.push({ file: relPath, line: i + 1, snippet: line.trim().slice(0, 160) });
  }
}

const hits = [];
for (const rel of TARGETS) {
  const full = join(ROOT, rel);
  scanText(rel, readFileSync(full, "utf8"), hits);
}
for (const skillMd of walkSkills(join(ROOT, "skills"))) {
  scanText(relative(ROOT, skillMd), readFileSync(skillMd, "utf8"), hits);
}

if (hits.length > 0) {
  console.error(`[audit:hub-prompts] ${hits.length} semantic directory hit(s):`);
  for (const hit of hits.slice(0, 50)) {
    console.error(`  ${hit.file}:${hit.line}  ${hit.snippet}`);
  }
  process.exit(1);
}

console.log("[audit:hub-prompts] OK — 0 semantic directory hits");
