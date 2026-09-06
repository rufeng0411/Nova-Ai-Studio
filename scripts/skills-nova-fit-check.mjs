#!/usr/bin/env node
/**
 * PD-SAAS-FORK: static gate for Nova-fit Skills (STDA / ask_user / semantic dirs / alias).
 * Usage: node scripts/skills-nova-fit-check.mjs [--baseline] [--batch G1|G2|G3|G4|G5]
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BATCH_SLUGS = {
  G1: ["social-creative-matrix", "cyber-ppt"],
  G2: ["geo-keyword-research", "geo-aeo-audit", "geo-serp-analysis", "geo-competitor-analysis", "mkt-ai-seo", "pd-geo"],
  G3: ["anth-pptx", "ppt-gorden-consulting", "nova-ppt-aesthetic-slides", "html-ppt", "cyber-ppt", "ppt-master"],
  G4: ["brand-campaign-full", "research-report", "geo-brand-full"],
  G5: ["anth-docx", "nova-research-general", "create-taste-skill"],
};

const P0_SKILL_DIRS = [
  "skills/social-creative-matrix",
  "skills/vendor/cyber-ppt/cyber-ppt",
  "skills/vendor/seo-geo/geo-keyword-research",
  "skills/vendor/seo-geo/geo-aeo-audit",
  "skills/vendor/anthropics-skills/anth-pptx",
  "skills/vendor/nova-1/nova-research-general",
];

const RULES = [
  {
    id: "semantic-dir",
    re: /artifacts\/(?:social-matrix|content-flywheel|geo\/|campaign\/)[^\s`]*\//i,
    severity: "error",
    msg: "语义目录写盘（须 STDA task-artifact-dir）",
    skipIf: (text) => /勿自建|禁止.*artifacts\/(?:social-matrix|content-flywheel|geo\/|campaign\/)/i.test(text),
  },
  {
    id: "ask-user-first",
    re: /ask_user_question/i,
    severity: "warn",
    msg: "含 ask_user_question（交付类首 turn 宜禁问卷）",
    skipIf: (text) => /NOVA-EXEC-BEGIN[\s\S]*禁.*ask_user|skip.*ask_user|禁止.*ask_user_question/i.test(text),
  },
  {
    id: "nova-exec",
    re: /NOVA-EXEC-BEGIN/i,
    severity: "warn",
    msg: "缺 NOVA-EXEC 块（P0 vendor skill 建议有）",
    onlyVendor: true,
  },
  {
    id: "project-root",
    re: /write_file[^\n]*(?:^|\s)(?:brief\.md|report\.md)(?:\s|$)/im,
    severity: "warn",
    msg: "可能 project root 裸文件名写盘",
    skipIf: (text) => /task-artifact-dir|taskArtifactDir|<task-artifact-dir>/i.test(text),
  },
  {
    id: "redirect-skill",
    re: /has moved|signpost repo|Frozen standalone/i,
    severity: "error",
    msg: "SKILL 为 redirect 残片，须整文件替换",
  },
];

function findSkillMdPaths() {
  const out = [];
  for (const rel of P0_SKILL_DIRS) {
    const skillPath = path.join(ROOT, rel, "SKILL.md");
    if (existsSync(skillPath)) out.push(skillPath);
  }
  const vendorRoot = path.join(ROOT, "skills/vendor");
  if (existsSync(vendorRoot)) {
    for (const walk of walkSkillMd(vendorRoot)) out.push(walk);
  }
  const social = path.join(ROOT, "skills/social-creative-matrix/SKILL.md");
  if (existsSync(social) && !out.includes(social)) out.push(social);
  return [...new Set(out)];
}

function* walkSkillMd(dir, depth = 0) {
  if (depth > 6) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules") {
      yield* walkSkillMd(full, depth + 1);
    } else if (e.isFile() && e.name === "SKILL.md") {
      yield full;
    }
  }
}

function isVendorSkill(filePath) {
  return filePath.includes(`${path.sep}vendor${path.sep}`) || filePath.includes("social-creative-matrix");
}

function checkFile(filePath, opts) {
  const text = readFileSync(filePath, "utf8");
  const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
  const findings = [];
  for (const rule of RULES) {
    if (rule.onlyVendor && !isVendorSkill(filePath)) continue;
    if (rule.id === "nova-exec") {
      if (!rule.re.test(text) && isVendorSkill(filePath)) {
        findings.push({ rule: rule.id, severity: rule.severity, msg: rule.msg, file: rel });
      }
      continue;
    }
    if (!rule.re.test(text)) continue;
    if (rule.skipIf?.(text)) continue;
    findings.push({ rule: rule.id, severity: rule.severity, msg: rule.msg, file: rel });
  }
  return findings;
}

function parseArgs(argv) {
  const batch = argv.find((a, i) => argv[i - 1] === "--batch") ?? null;
  const baseline = argv.includes("--baseline");
  return { batch, baseline };
}

function main() {
  const { batch, baseline } = parseArgs(process.argv.slice(2));
  let files = findSkillMdPaths();
  if (batch && BATCH_SLUGS[batch]) {
    const slugs = new Set(BATCH_SLUGS[batch]);
    files = files.filter((f) => {
      const rel = f.replace(/\\/g, "/");
      return [...slugs].some((s) => rel.includes(`/${s}/`) || rel.includes(`/${s}.`));
    });
  }

  const all = [];
  for (const f of files) {
    all.push(...checkFile(f, { baseline }));
  }

  const errors = all.filter((x) => x.severity === "error");
  const warns = all.filter((x) => x.severity === "warn");

  console.log(`skills-nova-fit-check: scanned ${files.length} SKILL.md`);
  console.log(`  errors: ${errors.length}, warnings: ${warns.length}`);
  for (const f of errors.slice(0, 30)) {
    console.log(`  [ERROR] ${f.file}: ${f.msg} (${f.rule})`);
  }
  for (const f of warns.slice(0, 20)) {
    console.log(`  [WARN] ${f.file}: ${f.msg} (${f.rule})`);
  }

  if (baseline) {
    console.log("baseline mode: findings expected pre-fix");
    process.exit(0);
  }
  if (errors.length > 0) process.exit(1);
  process.exit(0);
}

main();
