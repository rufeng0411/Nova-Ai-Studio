#!/usr/bin/env node
/**
 * Sync full Open Design design systems into PilotDeck skills/open-design/references/design-systems/
 * Source: OpenDesign/design-systems/<slug>/DESIGN.md
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = path.join(REPO_ROOT, "OpenDesign", "design-systems");
const TARGET_DIR = path.join(REPO_ROOT, "skills", "open-design", "references", "design-systems");

function parseCategory(content) {
  const match = content.match(/^>\s*Category:\s*(.+)$/m);
  return match ? match[1].trim() : "Uncategorized";
}

function parseTitle(content, slug) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : slug;
}

async function main() {
  await fs.mkdir(TARGET_DIR, { recursive: true });

  const entries = await fs.readdir(SOURCE_ROOT, { withFileTypes: true });
  const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

  const byCategory = new Map();
  let synced = 0;

  for (const slug of slugs) {
    const src = path.join(SOURCE_ROOT, slug, "DESIGN.md");
    try {
      const content = await fs.readFile(src, "utf8");
      const dest = path.join(TARGET_DIR, `${slug}.md`);
      await fs.writeFile(dest, content, "utf8");
      synced += 1;

      const category = parseCategory(content);
      const title = parseTitle(content, slug);
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push({ slug, title });
    } catch {
      console.warn(`skip (no DESIGN.md): ${slug}`);
    }
  }

  const categories = [...byCategory.keys()].sort();
  const indexLines = [
    "# 设计系统索引（完整版，同步自 OpenDesign/design-systems）",
    "",
    `共 **${synced}** 套。Agent 生成页面前读取对应 \`<slug>.md\`。`,
    "",
    "同步命令：`node scripts/sync-open-design-systems.mjs`",
    "",
    "用户可读目录：`docs/open-design-design-catalog.md`",
    "",
  ];

  for (const category of categories) {
    indexLines.push(`## ${category}`, "");
    const items = byCategory.get(category).sort((a, b) => a.slug.localeCompare(b.slug));
    for (const { slug, title } of items) {
      indexLines.push(`- [\`${slug}.md\`](${slug}.md) — ${title}`);
    }
    indexLines.push("");
  }

  await fs.writeFile(path.join(TARGET_DIR, "_index.md"), `${indexLines.join("\n")}\n`, "utf8");

  console.log(`Synced ${synced} design systems to ${path.relative(REPO_ROOT, TARGET_DIR)}`);
  console.log(`Categories: ${categories.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
