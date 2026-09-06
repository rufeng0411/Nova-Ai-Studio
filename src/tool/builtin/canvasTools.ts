// PD-SAAS-FORK: Agent tools for design canvas boards (gate ON only)
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PilotDeckToolDefinition } from "../protocol/types.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import { isDesignCanvasToolsEnabled } from "../../saas/designCanvasGate.js";
import { resolvePilotDeckWorkspacePath } from "./filesystem/pathSafety.js";
import { writeTextFile } from "./filesystem/writeTextFile.js";

function gateOrThrow(toolName: string): void {
  if (!isDesignCanvasToolsEnabled()) {
    throw new PilotDeckToolRuntimeError(
      "unsupported_tool",
      `${toolName} is disabled. Set PILOTDECK_DESIGN_CANVAS=1 to enable design canvas tools.`,
    );
  }
}

function normalizeBoardDir(boardDir: string): string {
  return boardDir.replace(/\\/g, "/").replace(/\/+$/, "").trim();
}

async function readManifest(boardDir: string, context: Parameters<NonNullable<PilotDeckToolDefinition["execute"]>>[1]) {
  const relPath = `${boardDir}/canvas-manifest.json`;
  const resolved = resolvePilotDeckWorkspacePath(relPath, context, { forWrite: false });
  if (!resolved.ok) {
    throw new PilotDeckToolRuntimeError(resolved.error.code, resolved.error.message, resolved.error.details);
  }
  const raw = await readFile(resolved.absolutePath, "utf8");
  return { relPath, resolved, manifest: JSON.parse(raw) as Record<string, unknown> };
}

async function writeManifest(
  boardDir: string,
  manifest: Record<string, unknown>,
  context: Parameters<NonNullable<PilotDeckToolDefinition["execute"]>>[1],
): Promise<string> {
  const relPath = `${boardDir}/canvas-manifest.json`;
  const resolved = resolvePilotDeckWorkspacePath(relPath, context, { forWrite: true });
  if (!resolved.ok) {
    throw new PilotDeckToolRuntimeError(resolved.error.code, resolved.error.message, resolved.error.details);
  }
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeTextFile(resolved.absolutePath, content, { allowOverwrite: true });
  return relPath;
}

export function createCanvasReadBoardTool(): PilotDeckToolDefinition<{ board_dir: string }> {
  return {
    name: "canvas_read_board",
    description: "Read canvas-manifest.json for a design canvas board under artifacts/canvas-*.",
    kind: "filesystem",
    inputSchema: {
      type: "object",
      required: ["board_dir"],
      additionalProperties: false,
      properties: {
        board_dir: { type: "string", description: "e.g. artifacts/canvas-campaign-001" },
      },
    },
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    isDestructive: () => false,
    execute: async (input, context) => {
      gateOrThrow("canvas_read_board");
      const boardDir = normalizeBoardDir(String(input.board_dir || ""));
      const { relPath, manifest } = await readManifest(boardDir, context);
      return {
        content: [{ type: "text", text: JSON.stringify({ board_dir: boardDir, manifest_path: relPath, manifest }, null, 2) }],
        data: { board_dir: boardDir, manifest_path: relPath, manifest },
      };
    },
  };
}

export function createCanvasAddAssetTool(): PilotDeckToolDefinition<{
  board_dir: string;
  asset_path: string;
  node_type?: string;
  x?: number;
  y?: number;
}> {
  return {
    name: "canvas_add_asset",
    description: "Add a node referencing an asset into canvas-manifest.json.",
    kind: "filesystem",
    inputSchema: {
      type: "object",
      required: ["board_dir", "asset_path"],
      additionalProperties: false,
      properties: {
        board_dir: { type: "string" },
        asset_path: { type: "string" },
        node_type: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => true,
    execute: async (input, context) => {
      gateOrThrow("canvas_add_asset");
      const boardDir = normalizeBoardDir(String(input.board_dir || ""));
      const assetPath = String(input.asset_path || "").replace(/\\/g, "/");
      let manifest: Record<string, unknown>;
      try {
        ({ manifest } = await readManifest(boardDir, context));
      } catch {
        manifest = {
          schema_version: 1,
          board_id: path.basename(boardDir),
          title: path.basename(boardDir),
          nodes: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        };
      }
      const nodes = Array.isArray(manifest.nodes) ? [...manifest.nodes] : [];
      nodes.push({
        id: `n-${Date.now()}`,
        type: input.node_type ?? "image",
        path: assetPath,
        x: input.x ?? 80 + nodes.length * 40,
        y: input.y ?? 80 + nodes.length * 40,
        parent_id: null,
      });
      manifest.nodes = nodes;
      manifest.updated_at = new Date().toISOString();
      const manifestPath = await writeManifest(boardDir, manifest, context);
      return {
        content: [{ type: "text", text: `Updated ${manifestPath} (${nodes.length} nodes).` }],
        data: { manifest_path: manifestPath, node_count: nodes.length },
      };
    },
  };
}

export function createCanvasAddDiagramTool(): PilotDeckToolDefinition<{
  board_dir: string;
  diagram_type: 'excalidraw' | 'mermaid';
  title?: string;
  source?: string;
}> {
  return {
    name: "canvas_add_diagram",
    description: "Add an Excalidraw or Mermaid diagram node to canvas-manifest.json.",
    kind: "filesystem",
    inputSchema: {
      type: "object",
      required: ["board_dir", "diagram_type"],
      additionalProperties: false,
      properties: {
        board_dir: { type: "string" },
        diagram_type: { type: "string", enum: ["excalidraw", "mermaid"] },
        title: { type: "string" },
        source: { type: "string", description: "Optional initial diagram source text" },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => true,
    execute: async (input, context) => {
      gateOrThrow("canvas_add_diagram");
      const boardDir = normalizeBoardDir(String(input.board_dir || ""));
      const diagramType = input.diagram_type === "mermaid" ? "mermaid" : "excalidraw";
      let manifest: Record<string, unknown>;
      try {
        ({ manifest } = await readManifest(boardDir, context));
      } catch {
        manifest = {
          schema_version: 1,
          board_id: path.basename(boardDir),
          title: path.basename(boardDir),
          nodes: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        };
      }
      const nodes = Array.isArray(manifest.nodes) ? [...manifest.nodes] : [];
      const relPath =
        diagramType === "mermaid" ? "diagrams/diagram.mmd" : "diagrams/diagram.excalidraw";
      nodes.push({
        id: `n-${Date.now()}`,
        type: diagramType === "mermaid" ? "diagram_mermaid" : "diagram_excalidraw",
        text: input.title ?? (diagramType === "mermaid" ? "脑图" : "流程图"),
        path: relPath,
        x: 120 + nodes.length * 40,
        y: 120,
        w: 480,
        h: 320,
        parent_id: null,
      });
      manifest.nodes = nodes;
      manifest.board_mode = "mixed";
      manifest.updated_at = new Date().toISOString();
      const manifestPath = await writeManifest(boardDir, manifest, context);
      if (input.source) {
        const assetRel = relPath;
        const resolved = resolvePilotDeckWorkspacePath(`${boardDir}/${assetRel}`, context, { forWrite: true });
        if (resolved.ok) {
          await writeTextFile(resolved.absolutePath, input.source, { allowOverwrite: true });
        }
      }
      return {
        content: [{ type: "text", text: `Added ${diagramType} node to ${manifestPath}.` }],
        data: { manifest_path: manifestPath, diagram_type: diagramType },
      };
    },
  };
}

export function createCanvasUpdateManifestTool(): PilotDeckToolDefinition<{
  board_dir: string;
  patch: Record<string, unknown>;
}> {
  return {
    name: "canvas_update_manifest",
    description: "Merge partial fields into canvas-manifest.json.",
    kind: "filesystem",
    inputSchema: {
      type: "object",
      required: ["board_dir", "patch"],
      additionalProperties: false,
      properties: {
        board_dir: { type: "string" },
        patch: { type: "object" },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => true,
    execute: async (input, context) => {
      gateOrThrow("canvas_update_manifest");
      const boardDir = normalizeBoardDir(String(input.board_dir || ""));
      const { manifest } = await readManifest(boardDir, context);
      const merged = { ...manifest, ...input.patch, updated_at: new Date().toISOString() };
      const manifestPath = await writeManifest(boardDir, merged, context);
      return {
        content: [{ type: "text", text: `Updated ${manifestPath}.` }],
        data: { manifest_path: manifestPath, updated: true },
      };
    },
  };
}
