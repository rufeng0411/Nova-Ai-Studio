#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPEN_DESIGN_ROOT = path.join(REPO_ROOT, "OpenDesign");
const TARGET_SKILLS_ROOT = path.join(REPO_ROOT, "skills");

function toPosixPath(p) {
  return p.split(path.sep).join("/");
}

function sanitizeSlug(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function rewriteFrontmatter(content, targetName, sourceSlug) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    const fallbackDescription = `Migrated from OpenDesign/skills/${sourceSlug}.`;
    return `---\nname: ${targetName}\ndescription: ${fallbackDescription}\n---\n\n${content}`;
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === "---") {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) return content;

  const frontmatterLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join("\n");
  const preserved = [];
  let description = "";
  for (const line of frontmatterLines) {
    if (/^\s*name\s*:/.test(line)) continue;
    if (/^\s*description\s*:/.test(line)) {
      description = line.replace(/^\s*description\s*:\s*/, "").trim();
      continue;
    }
    // Drop OpenDesign-specific keys like od:*, mode/scenario metadata.
    if (/^\s*od\s*:/.test(line)) continue;
    if (/^\s*(mode|platform|scenario|preview|design_system|default_for|featured|fidelity|speaker_notes|animations|example_prompt)\s*:/.test(line)) {
      continue;
    }
    preserved.push(line);
  }

  const oneLineDescription = description.replace(/\s+/g, " ").trim();
  const normalizedDescription = oneLineDescription.length > 0
    ? `${oneLineDescription}（迁移自 OpenDesign，建议先配合 open-design 总控技能使用）`
    : `Migrated from OpenDesign/skills/${sourceSlug}.`;

  const rebuilt = [
    "---",
    `name: ${targetName}`,
    `description: ${normalizedDescription}`,
    ...preserved,
    "---",
    "",
    body,
  ];
  return rebuilt.join("\n");
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyIfExists(src, dest) {
  try {
    await fs.cp(src, dest, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const [, , sourceSkillSlug, targetSkillSlugArg] = process.argv;
  if (!sourceSkillSlug) {
    console.error("Usage: node scripts/port-open-design-skill.mjs <open-design-skill-slug> [target-skill-slug]");
    process.exit(1);
  }

  const targetSkillSlug = sanitizeSlug(targetSkillSlugArg || `od-${sourceSkillSlug}`);
  const sourceDir = path.join(OPEN_DESIGN_ROOT, "skills", sourceSkillSlug);
  const targetDir = path.join(TARGET_SKILLS_ROOT, targetSkillSlug);

  try {
    await fs.access(sourceDir);
  } catch {
    console.error(`Source skill not found: ${toPosixPath(sourceDir)}`);
    process.exit(1);
  }

  await ensureDir(targetDir);
  await ensureDir(path.join(targetDir, "assets"));
  await ensureDir(path.join(targetDir, "references"));

  const sourceSkillPath = path.join(sourceDir, "SKILL.md");
  const targetSkillPath = path.join(targetDir, "SKILL.md");
  const originalSkill = await fs.readFile(sourceSkillPath, "utf8");
  const rewrittenSkill = rewriteFrontmatter(originalSkill, targetSkillSlug, sourceSkillSlug);
  await fs.writeFile(targetSkillPath, rewrittenSkill, "utf8");

  const copiedAssets = await copyIfExists(path.join(sourceDir, "assets"), path.join(targetDir, "assets"));
  const copiedReferences = await copyIfExists(path.join(sourceDir, "references"), path.join(targetDir, "references"));

  console.log(`Migrated ${sourceSkillSlug} -> ${targetSkillSlug}`);
  console.log(`SKILL: ${toPosixPath(path.relative(REPO_ROOT, targetSkillPath))}`);
  console.log(`assets copied: ${copiedAssets}`);
  console.log(`references copied: ${copiedReferences}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

