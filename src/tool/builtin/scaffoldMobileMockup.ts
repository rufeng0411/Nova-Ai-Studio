// PD-SAAS-FORK: one-shot mobile mockup scaffold — avoids truncated in-chat HTML
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PilotDeckToolDefinition } from "../protocol/types.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import { resolvePilotDeckWorkspacePath } from "./filesystem/pathSafety.js";
import { writeTextFile } from "./filesystem/writeTextFile.js";
import { buildScaffoldFiles } from "./mobileMockupTemplates.js";

export type ScaffoldMobileMockupInput = {
  slug: string;
  preset?: "fifa-world-cup" | "blank";
  screens?: number;
};

export type ScaffoldMobileMockupOutput = {
  directory: string;
  indexPath: string;
  files: string[];
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,48}$/;

export function createScaffoldMobileMockupTool(): PilotDeckToolDefinition<
  ScaffoldMobileMockupInput,
  ScaffoldMobileMockupOutput
> {
  return {
    name: "scaffold_mobile_mockup",
    aliases: ["ScaffoldMobileMockup"],
    description: `Creates a complete multi-screen mobile UI mockup under artifacts/design/<slug>/.

Use this FIRST for「手机界面示意 / 三屏并排 / App 界面」tasks — do NOT paste HTML in chat.

- Writes index.html (3 phone frames side by side) + screen-1.html … screen-N.html
- preset "fifa-world-cup": 2026 World Cup watch guide (FIFA blue/gold)
- preset "blank": generic placeholders to edit with edit_file
- screens: 1–3 (default 3)

After scaffold, optionally edit_file individual screens. Reply with indexPath only.`,
    kind: "filesystem",
    inputSchema: {
      type: "object",
      required: ["slug"],
      additionalProperties: false,
      properties: {
        slug: {
          type: "string",
          description: "Folder name under artifacts/design/, e.g. world-cup-2026",
        },
        preset: {
          type: "string",
          enum: ["fifa-world-cup", "blank"],
          description: 'Content preset. Default "fifa-world-cup" when slug contains world-cup or fifa.',
        },
        screens: {
          type: "integer",
          description: "Number of screens (1–3). Default 3.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["directory", "indexPath", "files"],
      additionalProperties: false,
      properties: {
        directory: { type: "string" },
        indexPath: { type: "string" },
        files: { type: "array", items: { type: "string" } },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => true,
    execute: async (input, context) => {
      const slug = String(input.slug || "").trim().toLowerCase();
      if (!SLUG_RE.test(slug)) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "slug must be lowercase letters, numbers, hyphens (e.g. world-cup-2026).",
        );
      }

      const screens = Math.min(3, Math.max(1, Number(input.screens) || 3));
      const preset = input.preset
        ?? (slug.includes("world-cup") || slug.includes("fifa") ? "fifa-world-cup" : "blank");

      const relDir = `artifacts/design/${slug}`;
      const resolved = resolvePilotDeckWorkspacePath(relDir, context, { forWrite: true });
      if (!resolved.ok) {
        throw new PilotDeckToolRuntimeError(
          resolved.error.code,
          resolved.error.message,
          resolved.error.details,
        );
      }

      await mkdir(resolved.absolutePath, { recursive: true });

      const scaffold = buildScaffoldFiles(preset, screens);
      const written: string[] = [];
      for (const [name, content] of scaffold) {
        const fileResolved = resolvePilotDeckWorkspacePath(
          path.join(relDir, name),
          context,
          { forWrite: true },
        );
        if (!fileResolved.ok) continue;
        await writeTextFile(fileResolved.absolutePath, content, { allowOverwrite: true });
        written.push(path.join(relDir, name).replace(/\\/g, "/"));
        const update = {
          absolutePath: fileResolved.absolutePath,
          relativePath: fileResolved.relativePath,
          root: fileResolved.root,
          content,
          previousContent: null,
        };
        await context.fileUpdateNotifier?.didChange?.(update);
        await context.fileUpdateNotifier?.didSave?.(update);
      }

      const indexPath = `${relDir}/index.html`;
      const data: ScaffoldMobileMockupOutput = {
        directory: relDir,
        indexPath,
        files: written,
      };

      return {
        content: [{
          type: "text",
          text: `Created mobile mockup at ${indexPath} (${written.length} files, preset=${preset}). Open index.html to preview.`,
        }],
        data,
      };
    },
  };
}
