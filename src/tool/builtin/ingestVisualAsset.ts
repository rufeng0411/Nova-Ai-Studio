/**
 * PD-SAAS-FORK VAP: ingest_visual_asset — register a local path into the manifest.
 */

import type { PermissionResult } from "../../permission/index.js";
import {
  applyAnalysisToEntry,
  analyzeVisualAsset,
} from "../../saas/media/visualAssetPlatform/analyzer.js";
import {
  createIngestedEntry,
  ingestVisualAssetEntry,
  loadVisualAssetManifest,
  saveVisualAssetManifest,
} from "../../saas/media/visualAssetPlatform/manifestStore.js";
import type { VisualAssetSource } from "../../saas/media/visualAssetPlatform/types.js";
import { visualAssetPlatformMode } from "../../saas/resilience/stabilityFlags.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolExecutionOutput,
} from "../protocol/types.js";

export type IngestVisualAssetInput = {
  path: string;
  source?: VisualAssetSource;
  roleHint?: string;
  recipeId?: string;
};

export type IngestVisualAssetOutput = {
  assetId: string;
  rawPath: string;
  recommendedTier: string;
  role: string;
};

export function createIngestVisualAssetTool(): PilotDeckToolDefinition<
  IngestVisualAssetInput,
  IngestVisualAssetOutput
> {
  return {
    name: "ingest_visual_asset",
    aliases: ["IngestVisualAsset"],
    description:
      "- Register an existing workspace image into the session visual-asset-manifest\n"
      + "- Used for user attachments or generate_image outputs",
    kind: "custom",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: {
        path: { type: "string" },
        source: {
          type: "string",
          enum: [
            "official_fetch",
            "authority_site",
            "web_search_image",
            "generate_image",
            "user_attachment",
            "placeholder",
          ],
        },
        roleHint: { type: "string" },
        recipeId: { type: "string" },
      },
    },
    maxResultBytes: 40_000,
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isOpenWorld: () => false,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "allow",
      reason: { type: "runtime", message: "Visual asset tools are session-scoped." },
    }),
    validateInput: async (input) => {
      if (!input || typeof input !== "object") {
        return {
          ok: false,
          issues: [{ path: "", code: "invalid_type", message: "input must be an object" }],
        };
      }
      const pathValue = (input as IngestVisualAssetInput).path;
      if (typeof pathValue !== "string" || !pathValue.trim()) {
        return {
          ok: false,
          issues: [{ path: "path", code: "required", message: "path is required" }],
        };
      }
      return { ok: true, input: input as IngestVisualAssetInput };
    },
    execute: async (
      input,
      context,
    ): Promise<PilotDeckToolExecutionOutput<IngestVisualAssetOutput>> => {
      if (visualAssetPlatformMode() === "off") {
        return {
          content: [{ type: "text", text: "Visual Asset Platform is off." }],
          data: {
            assetId: "",
            rawPath: input.path,
            recommendedTier: "none",
            role: "unknown",
          },
        };
      }
      const taskDir = context.taskArtifactDir ?? "artifacts";
      const source = input.source ?? "user_attachment";
      const analysis = analyzeVisualAsset({
        rawPath: input.path,
        source,
        altText: input.roleHint,
        subject: context.sessionGoalQualityContract?.subjectAnchor,
      });
      const base = createIngestedEntry({
        source,
        rawPath: input.path,
        recommendedTier: analysis.recommendedTier,
        role: analysis.role,
        provenance: {
          recipeId: input.recipeId ?? analysis.suggestedRecipes[0],
          fetchedAt: new Date().toISOString(),
        },
      });
      let manifest = await loadVisualAssetManifest({
        workspaceRoot: context.cwd,
        taskArtifactDir: taskDir,
        sessionId: context.sessionId,
        goalVersion: context.taskGoalVersion,
      });
      const entry = applyAnalysisToEntry(
        { ...base, assetId: `va_ingest_${Date.now().toString(36)}` },
        analysis,
      );
      manifest = ingestVisualAssetEntry(manifest, entry);
      await saveVisualAssetManifest({
        workspaceRoot: context.cwd,
        manifest,
      });
      const payload: IngestVisualAssetOutput = {
        assetId: entry.assetId,
        rawPath: entry.rawPath,
        recommendedTier: entry.recommendedTier,
        role: entry.role,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        data: payload,
      };
    },
  };
}
