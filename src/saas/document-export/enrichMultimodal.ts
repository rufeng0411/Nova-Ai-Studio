// PD-SAAS-FORK: chart/video multimodal enrichment for HTML exports
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentIr, DocumentIrBlock } from "./types.js";
import { runNodeExportScript } from "./runScript.js";

export async function enrichMultimodalBlocks(
  ir: DocumentIr,
  sourceAbsolutePath: string,
  workspaceRoot: string,
  env: NodeJS.ProcessEnv,
): Promise<DocumentIr> {
  const content = await readFile(sourceAbsolutePath, "utf8");
  const extraBlocks: DocumentIrBlock[] = [];
  const cacheDir = path.join(workspaceRoot, "artifacts", ".export-cache");
  await mkdir(cacheDir, { recursive: true });

  if (/\bdata-export-chart\b/i.test(content) || /<canvas/i.test(content)) {
    const chartPath = path.join(cacheDir, `chart-${Date.now()}.png`);
    const scriptPath = path.resolve(process.cwd(), "scripts", "export-document", "capture-chart.mjs");
    try {
      await runNodeExportScript(
        scriptPath,
        ["--input", sourceAbsolutePath, "--output", chartPath],
        env,
      );
      extraBlocks.push({ type: "chartImage", resolvedPath: chartPath, caption: "Chart" });
    } catch {
      // Playwright optional; skip chart capture
    }
  }

  if (extraBlocks.length === 0) return ir;
  return { ...ir, blocks: [...ir.blocks, ...extraBlocks] };
}
