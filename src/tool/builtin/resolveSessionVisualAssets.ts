/**
 * PD-SAAS-FORK VAP: resolve_session_visual_assets — main Agent façade for Orchestrator.
 */

import type { PermissionResult } from "../../permission/index.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import {
  runVisualAssetOrchestrator,
  extractSourceUrlsFromGoal,
  shouldAutoResolveVisualAssets,
} from "../../saas/media/visualAssetPlatform/orchestrator.js";
import { visualAssetPlatformMode } from "../../saas/resilience/stabilityFlags.js";
import { isAcquisitionLadderExhausted } from "../../saas/media/visualAssetPlatform/visualAcquisitionLadder.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolExecutionOutput,
} from "../protocol/types.js";

export type ResolveSessionVisualAssetsInput = {
  phase?: "phase_a" | "phase_b";
  subject?: string;
  goalHint?: string;
  sourceUrls?: string[];
  authorityHints?: string[];
  minCandidates?: number;
};

export type ResolveSessionVisualAssetsOutput = {
  mode: "off" | "shadow" | "enforce";
  assetCount: number;
  localizedOfficialCount: number;
  slotBindings: Record<string, string>;
  hint: string;
  errors: string[];
  manifestRelPath: string;
  acquisitionAttempts?: Array<{
    tier: string;
    method: string;
    target: string;
    ok: boolean;
    detail?: string;
    at: string;
  }>;
  ladderExhausted?: boolean;
};

export function createResolveSessionVisualAssetsTool(): PilotDeckToolDefinition<
  ResolveSessionVisualAssetsInput,
  ResolveSessionVisualAssetsOutput
> {
  return {
    name: "resolve_session_visual_assets",
    aliases: ["ResolveSessionVisualAssets", "discover_visual_assets"],
    description:
      "- L0: Resolve session visual assets (auto discover + analyze + conditional prepare)\n"
      + "- Prefer this over manual fetch_page_images / web_search / generate_image for product photos\n"
      + "- Returns manifest summary and paths under artifacts/sessions/{sessionId}/downloads/\n"
      + "- Phase A: discover from goal URLs; Phase B: bind to SDM image slots after manifest freeze",
    kind: "network",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        phase: {
          type: "string",
          enum: ["phase_a", "phase_b"],
          description: "phase_a = discover; phase_b = bind slots + prepare",
        },
        subject: { type: "string" },
        goalHint: {
          type: "string",
          description: "Optional user-goal snippet when contract goal is unavailable",
        },
        sourceUrls: {
          type: "array",
          items: { type: "string" },
        },
        authorityHints: {
          type: "array",
          items: { type: "string" },
        },
        minCandidates: { type: "number" },
      },
    },
    maxResultBytes: 120_000,
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isOpenWorld: () => true,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "allow",
      reason: { type: "runtime", message: "Visual asset tools are session-scoped." },
    }),
    validateInput: async (input) => {
      if (input == null || typeof input !== "object") {
        return { ok: true, input: {} };
      }
      return { ok: true, input: input as ResolveSessionVisualAssetsInput };
    },
    execute: async (
      input,
      context,
    ): Promise<PilotDeckToolExecutionOutput<ResolveSessionVisualAssetsOutput>> => {
      const mode = visualAssetPlatformMode();
      const taskDir = String(context.taskArtifactDir ?? "").trim();
      if (!taskDir || taskDir === "artifacts" || !/^artifacts\/task-/iu.test(taskDir)) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "resolve_session_visual_assets 需要已分配的任务目录 artifacts/task-*；请先 write_file 创建任务目录或等待 SDM 分配。",
        );
      }
      const userGoal = [
        input.goalHint,
        input.subject,
        context.sessionGoalQualityContract?.subjectAnchor,
        ...(context.trustedUserExplicitUrls ?? []),
      ].filter(Boolean).join(" ");
      const phase = input.phase ?? "phase_a";

      const policyGoal = String(
        context.sessionDeliverableManifest?.sessionGoalAnchor
        ?? context.sessionGoalQualityContract?.subjectAnchor
        ?? input.goalHint
        ?? userGoal,
      ).trim();
      const capabilitySlug = context.sessionDeliverableManifest?.capabilitySlug;
      if (
        !shouldAutoResolveVisualAssets({
          userGoal: policyGoal || userGoal,
          capabilitySlug,
        })
      ) {
        const skipHint =
          "当前为文本/文档型上市全案，默认跳过配图流水线。"
          + " landing.html 请用 CSS/占位区块；勿写入 assets/_capture、assets/prepared、visual-asset-manifest.json。"
          + " 仅当用户明确要求官图/官网产品图时再调用本工具。";
        const payload: ResolveSessionVisualAssetsOutput = {
          mode,
          assetCount: 0,
          localizedOfficialCount: 0,
          slotBindings: {},
          hint: skipHint,
          errors: [],
          manifestRelPath: `${taskDir.replace(/\\/gu, "/")}/assets/visual-asset-manifest.json`,
          ladderExhausted: true,
        };
        return {
          content: [{ type: "text", text: skipHint }],
          data: payload,
        };
      }

      const plan = await runVisualAssetOrchestrator({
        workspaceRoot: context.cwd,
        sessionId: context.sessionId,
        taskArtifactDir: taskDir,
        userGoal: userGoal || "visual assets",
        goalVersion: context.taskGoalVersion,
        phase,
        sourceUrls: [
          ...(input.sourceUrls ?? []),
          ...(context.trustedUserExplicitUrls ?? []),
          ...extractSourceUrlsFromGoal(userGoal),
        ],
        authorityHints: input.authorityHints,
        language: "zh-CN",
      });
      const localizedOfficialCount = plan.manifest.assets.filter(
        (asset) =>
          asset.source === "official_fetch"
          || asset.source === "authority_site",
      ).length;
      const acquisitionAttempts = plan.manifest.acquisitionAttempts;
      const ladderExhausted = isAcquisitionLadderExhausted(
        acquisitionAttempts ?? [],
        plan.manifest.assets.length,
        input.minCandidates ?? 1,
      );
      const payload: ResolveSessionVisualAssetsOutput = {
        mode,
        assetCount: plan.manifest.assets.length,
        localizedOfficialCount,
        slotBindings: plan.manifest.slotBindings,
        hint: plan.hintForModel,
        errors: plan.manifest.errors,
        manifestRelPath: `${taskDir.replace(/\\/gu, "/")}/assets/visual-asset-manifest.json`,
        acquisitionAttempts,
        ladderExhausted,
      };
      return {
        content: [{
          type: "text",
          text: [
            plan.hintForModel,
            "",
            JSON.stringify({
              assetCount: payload.assetCount,
              localizedOfficialCount: payload.localizedOfficialCount,
              manifestRelPath: payload.manifestRelPath,
              ladderExhausted: payload.ladderExhausted,
              acquisitionAttemptCount: payload.acquisitionAttempts?.length ?? 0,
              errors: payload.errors.slice(0, 8),
            }, null, 2),
          ].filter(Boolean).join("\n"),
        }],
        data: payload,
      };
    },
  };
}
