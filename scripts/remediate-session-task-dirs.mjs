#!/usr/bin/env node
/**
 * PD-SAAS-FORK: merge split session task dirs into primary (dry-run by default).
 *
 * Usage:
 *   node scripts/remediate-session-task-dirs.mjs --session web-s_xxx [--dry-run|--apply]
 */
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const sessionId = readArg("--session");
const apply = args.includes("--apply");
const dryRun = !apply || args.includes("--dry-run");

if (!sessionId) {
  console.error("Usage: node scripts/remediate-session-task-dirs.mjs --session web-s_xxx [--dry-run|--apply]");
  process.exit(1);
}

function readArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

async function main() {
  const dataRoot = process.env.DATA_ROOT ?? path.join(process.cwd(), ".saas-dev-data");
  console.log(`[remediate] session=${sessionId} mode=${dryRun ? "dry-run" : "apply"}`);
  console.log(`[remediate] DATA_ROOT=${dataRoot}`);
  console.log("[remediate] Scanning tenant projects for transcript + task dirs…");

  const tenantsRoot = path.join(dataRoot, "tenants");
  let transcriptPath;
  try {
    const tenants = await fs.readdir(tenantsRoot);
    for (const tenant of tenants) {
      const projectsRoot = path.join(tenantsRoot, tenant, "projects");
      try {
        const projects = await fs.readdir(projectsRoot);
        for (const project of projects) {
          const chatsDir = path.join(projectsRoot, project, "chats");
          const candidate = path.join(chatsDir, `${sessionId}.jsonl`);
          try {
            await fs.access(candidate);
            transcriptPath = candidate;
            break;
          } catch {
            // continue
          }
        }
      } catch {
        // continue
      }
      if (transcriptPath) break;
    }
  } catch (err) {
    console.warn("[remediate] tenants scan failed:", err instanceof Error ? err.message : err);
  }

  if (!transcriptPath) {
    console.log("[remediate] transcript not found — nothing to do.");
    return;
  }

  const raw = await fs.readFile(transcriptPath, "utf8");
  const taskDirs = new Set();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === "session_task_directory" && entry.taskArtifactDir) {
        taskDirs.add(String(entry.taskArtifactDir).replace(/\\/g, "/"));
      }
    } catch {
      // skip
    }
  }

  const dirs = [...taskDirs];
  if (dirs.length <= 1) {
    console.log("[remediate] single task dir — no merge needed:", dirs[0] ?? "(none)");
    return;
  }

  console.log("[remediate] found task dirs:", dirs.join(", "));
  const primary = dirs[0];
  const orphans = dirs.slice(1);
  console.log(`[remediate] would merge ${orphans.length} orphan dir(s) → ${primary}`);
  if (dryRun) {
    console.log("[remediate] dry-run complete. Re-run with --apply to copy report-*.html files.");
    return;
  }
  console.log("[remediate] --apply not fully wired to workspace roots in this script; use manual copy + manifest patch per docs/geo-multi-turn-deliverable-spec.zh-CN.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
