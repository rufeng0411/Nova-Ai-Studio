// PD-SAAS-FORK: skill-backed export providers from config/document-export-providers.json
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from '../../../util/childProcess.js';
import { withHiddenConsole } from "../../../util/withHiddenConsole.js";
import { irToMinimaxContent } from "../irToMinimaxContent.js";
import type { DocumentExportProvider, ExportQuality, OutputFormat } from "../types.js";

type SkillProviderManifest = {
  id: string;
  skillSlug: string;
  formats: OutputFormat[];
  integrationLevel: "L1" | "cloud";
  priority: number;
  entry: string;
  qualities?: ExportQuality[];
};

function loadSkillProviders(): SkillProviderManifest[] {
  try {
    const manifestPath = path.resolve(process.cwd(), "config", "document-export-providers.json");
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as { skills?: SkillProviderManifest[] };
    return raw.skills ?? [];
  } catch {
    return [];
  }
}

async function runBashScript(
  scriptPath: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const bash = process.platform === "win32" ? "bash" : "bash";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(bash, [scriptPath, ...args], withHiddenConsole({ cwd, env, stdio: ["ignore", "pipe", "pipe"] }));
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `bash script exited with code ${code}`));
    });
  });
}

const DEDICATED_PROVIDER_IDS = new Set(["nutrient"]);

export function createSkillExportProviders(): DocumentExportProvider[] {
  return loadSkillProviders().filter((m) => !DEDICATED_PROVIDER_IDS.has(m.id)).map((manifest) => ({
    id: manifest.id,
    formats: manifest.formats,
    integrationLevel: manifest.integrationLevel === "cloud" ? "cloud" : "L1",
    priority: manifest.priority,
    availability: (ctx) => {
      if (manifest.id === "minimax-pdf") return "ready";
      if (manifest.id === "nutrient") {
        return ctx.documentExport.nutrientApiKey ? "ready" : "needs_config";
      }
      return "ready";
    },
    canHandle: (input) => {
      if (!manifest.formats.includes(input.outputFormat)) return false;
      const q = input.options.quality ?? "balanced";
      if (manifest.qualities && !manifest.qualities.includes(q)) return false;
      if (manifest.id === "minimax-pdf") return input.outputFormat === "pdf";
      return false;
    },
    render: async (ctx, input, ir) => {
      if (manifest.id === "minimax-pdf") {
        const cacheDir = path.join(input.workspaceRoot, "artifacts", ".export-cache");
        await mkdir(cacheDir, { recursive: true });
        const contentJson = path.join(cacheDir, `minimax-${Date.now()}.json`);
        await writeFile(contentJson, JSON.stringify(irToMinimaxContent(ir), null, 2), "utf8");
        const makeSh = path.resolve(process.cwd(), manifest.entry);
        const scriptDir = path.dirname(makeSh);
        const docType = input.options.design_profile?.trim() || "report";
        const title = ir.title ?? path.basename(input.sourceAbsolutePath, path.extname(input.sourceAbsolutePath));
        await runBashScript(
          makeSh,
          [
            "run",
            "--title",
            title,
            "--type",
            docType,
            "--content",
            contentJson,
            "--out",
            input.outputAbsolutePath,
          ],
          scriptDir,
          ctx.env,
        );
      }
      return {
        outputAbsolutePath: input.outputAbsolutePath,
        relativePath: path.relative(input.workspaceRoot, input.outputAbsolutePath).split(path.sep).join("/"),
        providerId: manifest.id,
        format: input.outputFormat,
      };
    },
  }));
}
