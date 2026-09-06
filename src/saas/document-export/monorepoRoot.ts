// PD-SAAS-FORK: resolve PilotDeck monorepo root (scripts/ live here, not under ui/)
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = path.join("scripts", "export-document", "html-to-pdf.mjs");

function hasMarker(root: string): boolean {
  return existsSync(path.join(root, MARKER));
}

/**
 * Find repo root whether the process cwd is repo root or ui/ workspace.
 */
export function resolveMonorepoRoot(): string {
  const envRoot = process.env.PILOTDECK_REPO_ROOT?.trim();
  if (envRoot && hasMarker(envRoot)) {
    return path.resolve(envRoot);
  }

  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".."),
  ];

  for (const candidate of candidates) {
    const root = path.resolve(candidate);
    if (hasMarker(root)) return root;
  }

  return process.cwd();
}
