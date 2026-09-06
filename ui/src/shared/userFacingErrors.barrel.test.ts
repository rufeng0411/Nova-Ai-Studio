import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// PD-SAAS-FORK guard: the UI `shared/userFacingErrors` barrel hand-curates which
// engine exports it re-exports. A missing re-export is a *runtime-only* failure
// (ESM "does not provide an export named X" -> ErrorBoundary -> white screen) that
// neither the engine `tsc` nor Node fixtures catch. This static test fails fast in
// CI whenever any UI module imports a symbol the barrel forgot to re-export.

const here = dirname(fileURLToPath(import.meta.url));
const barrelPath = resolve(here, "userFacingErrors.ts");
const uiSrcRoot = resolve(here, "..");

function collectBarrelExports(source: string): Set<string> {
  const names = new Set<string>();
  // Matches both `export { ... } from "..."` and `export type { ... } from "..."`.
  const blockRe = /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']*userFacingErrors[^"']*["']/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(source)) !== null) {
    for (const raw of match[1]!.split(",")) {
      const ident = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
      if (ident) names.add(ident);
    }
  }
  return names;
}

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/userFacingErrors\.ts$/.test(full)) {
      out.push(full);
    }
  }
  return out;
}

function collectBarrelImports(source: string): string[] {
  const names: string[] = [];
  const importRe = /import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']*shared\/userFacingErrors["']/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source)) !== null) {
    for (const raw of match[1]!.split(",")) {
      const ident = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
      if (ident) names.push(ident);
    }
  }
  return names;
}

describe("ui shared userFacingErrors barrel", () => {
  it("re-exports every symbol the UI imports from it", () => {
    const exported = collectBarrelExports(readFileSync(barrelPath, "utf8"));
    expect(exported.size).toBeGreaterThan(10);

    const violations: string[] = [];
    for (const file of walkSourceFiles(uiSrcRoot)) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("shared/userFacingErrors")) continue;
      for (const ident of collectBarrelImports(source)) {
        if (!exported.has(ident)) {
          violations.push(`${file.replace(uiSrcRoot, "ui/src")} imports missing "${ident}"`);
        }
      }
    }

    expect(violations, `barrel re-export drift:\n${violations.join("\n")}`).toEqual([]);
  });
});
