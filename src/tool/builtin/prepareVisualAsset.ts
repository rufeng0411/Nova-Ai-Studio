/**
 * PD-SAAS-FORK VAP: prepare_visual_asset — apply recipe to one manifest asset.
 */

import type { PermissionResult } from "../../permission/index.js";
import {
  loadVisualAssetManifest,
  saveVisualAssetManifest,
} from "../../saas/media/visualAssetPlatform/manifestStore.js";
import { prepareVisualAssetEntry } from "../../saas/media/visualAssetPlatform/preparePipeline.js";
import { visualAssetPlatformMode } from "../../saas/resilience/stabilityFlags.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolExecutionOutput,
} from "../protocol/types.js";

export type PrepareVisualAssetInput = {
  assetId: string;
  recipeId?: string;
  force?: boolean;
};

export type PrepareVisualAssetOutput = {
  assetId: string;
  preparedPath?: string;
  processingStatus: string;
  recipeId?: string;
};

export function createPrepareVisualAssetTool(): PilotDeckToolDefinition<
  PrepareVisualAssetInput,
  PrepareVisualAssetOutput
> {
  return {
    name: "prepare_visual_asset",
    aliases: ["PrepareVisualAsset"],
    description:
      "- Prepare one visual asset (resize / crop / matting_compose) per recipe\n"
      + "- Prefer resolve_session_visual_assets for batch; use this for slot-specific overrides",
    kind: "custom",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["assetId"],
      properties: {
        assetId: { type: "string" },
        recipeId: { type: "string" },
        force: { type: "boolean" },
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
      const assetId = (input as PrepareVisualAssetInput).assetId;
      if (typeof assetId !== "string" || !assetId.trim()) {
        return {
          ok: false,
          issues: [{ path: "assetId", code: "required", message: "assetId is required" }],
        };
      }
      return { ok: true, input: input as PrepareVisualAssetInput };
    },
    execute: async (
      input,
      context,
    ): Promise<PilotDeckToolExecutionOutput<PrepareVisualAssetOutput>> => {
      if (visualAssetPlatformMode() === "off") {
        return {
          content: [{ type: "text", text: "Visual Asset Platform is off." }],
          data: {
            assetId: input.assetId,
            processingStatus: "skipped",
          },
        };
      }
      const taskDir = context.taskArtifactDir ?? "artifacts";
      let manifest = await loadVisualAssetManifest({
        workspaceRoot: context.cwd,
        taskArtifactDir: taskDir,
        sessionId: context.sessionId,
        goalVersion: context.taskGoalVersion,
      });
      const entry = manifest.assets.find((asset) => asset.assetId === input.assetId);
      if (!entry) {
        return {
          content: [{
            type: "text",
            text: `Asset ${input.assetId} not found in visual-asset-manifest.`,
          }],
          data: {
            assetId: input.assetId,
            processingStatus: "failed",
          },
          metadata: { softFailed: true },
        };
      }
      const prepared = await prepareVisualAssetEntry({
        workspaceRoot: context.cwd,
        taskArtifactDir: taskDir,
        entry,
        recipeId: input.recipeId,
        force: input.force,
      });
      manifest = {
        ...manifest,
        assets: manifest.assets.map((asset) =>
          asset.assetId === prepared.assetId ? prepared : asset
        ),
      };
      await saveVisualAssetManifest({
        workspaceRoot: context.cwd,
        manifest,
      });
      const payload: PrepareVisualAssetOutput = {
        assetId: prepared.assetId,
        preparedPath: prepared.preparedPath,
        processingStatus: prepared.processingStatus,
        recipeId: prepared.provenance.recipeId,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        data: payload,
      };
    },
  };
}
