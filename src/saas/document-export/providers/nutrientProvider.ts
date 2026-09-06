// PD-SAAS-FORK: Nutrient cloud provider (fidelity HTML → PDF/DOCX)
import path from "node:path";
import type { DocumentExportProvider } from "../types.js";
import { detectSourceKind } from "../buildIr.js";
import { runPythonExportScript } from "../runScript.js";

export function createNutrientProvider(): DocumentExportProvider {
  return {
    id: "nutrient",
    formats: ["pdf", "docx"],
    integrationLevel: "cloud",
    priority: 80,
    availability: (ctx) => (ctx.documentExport.nutrientApiKey ? "ready" : "needs_config"),
    canHandle: (input) => {
      if (input.options.quality !== "fidelity") return false;
      const kind = detectSourceKind(input.sourceAbsolutePath);
      return kind === "html" && (input.outputFormat === "pdf" || input.outputFormat === "docx");
    },
    render: async (ctx, input) => {
      const scriptPath = path.resolve(
        process.cwd(),
        "skills",
        "vendor",
        "office-ecosystem",
        "office-nutrient",
        "scripts",
        "convert.py",
      );
      const format = input.outputFormat === "docx" ? "docx" : "pdf";
      const env = {
        ...ctx.env,
        NUTRIENT_API_KEY: ctx.documentExport.nutrientApiKey ?? "",
      };
      await runPythonExportScript(
        scriptPath,
        [
          "--input",
          input.sourceAbsolutePath,
          "--output",
          input.outputAbsolutePath,
          "--format",
          format,
        ],
        env,
      );
      return {
        outputAbsolutePath: input.outputAbsolutePath,
        relativePath: path.relative(input.workspaceRoot, input.outputAbsolutePath).split(path.sep).join("/"),
        providerId: "nutrient",
        format: input.outputFormat,
      };
    },
  };
}
