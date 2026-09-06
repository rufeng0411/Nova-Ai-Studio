// PD-SAAS-FORK: HyperFrames deliverable acceptance (enforce / shadow telemetry)

import type { CanonicalMessage } from "../../model/index.js";
import type { AcceptanceFailure } from "./acceptanceChecks.js";
import {
  isHyperframesEngineEnabled,
  isHyperframesEngineEnforced,
  isHyperframesVideoSlug,
  parseHyperframesEngineMode,
} from "../media/hyperframesEngineFlags.js";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export type HyperframesAcceptanceCheckInput = {
  capabilitySlug?: string;
  verifiedPaths: string[];
  messages: CanonicalMessage[];
  telemetryDir?: string;
};

export type HyperframesAcceptanceCheckResult = {
  failures: AcceptanceFailure[];
  usedRenderTool: boolean;
  hasMp4: boolean;
};

function messageUsedRenderHyperframes(messages: CanonicalMessage[]): boolean {
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const block of message.content ?? []) {
      if (block.type !== "tool_call") continue;
      const name = String((block as { name?: string }).name ?? "").toLowerCase();
      if (name === "render_hyperframes" || name === "renderhyperframes") return true;
    }
  }
  return false;
}

function verifiedHasMp4(verifiedPaths: readonly string[]): boolean {
  return verifiedPaths.some((p) => /\.mp4$/i.test(String(p ?? "")));
}

function recordShadowTelemetry(payload: Record<string, unknown>, telemetryDir?: string): void {
  const mode = parseHyperframesEngineMode();
  if (mode !== "shadow") return;
  const dir = telemetryDir ?? path.join(process.cwd(), ".saas-dev-data", "telemetry");
  try {
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      path.join(dir, "hyperframes-engine.jsonl"),
      `${JSON.stringify({ ts: new Date().toISOString(), ...payload })}\n`,
      "utf8",
    );
  } catch {
    // telemetry must not block validation
  }
}

export function checkHyperframesDeliverableAcceptance(
  input: HyperframesAcceptanceCheckInput,
): HyperframesAcceptanceCheckResult {
  const slug = String(input.capabilitySlug ?? "").trim().toLowerCase();
  if (!isHyperframesEngineEnabled() || !isHyperframesVideoSlug(slug)) {
    return { failures: [], usedRenderTool: false, hasMp4: false };
  }

  const usedRenderTool = messageUsedRenderHyperframes(input.messages);
  const hasMp4 = verifiedHasMp4(input.verifiedPaths);
  const failures: AcceptanceFailure[] = [];

  if (isHyperframesEngineEnforced()) {
    if (!hasMp4) {
      failures.push({
        reason: "missing",
        message: "HyperFrames 成片任务缺少 promo.mp4（或等效 mp4 成果）。",
        path: "promo.mp4",
        expected: "mp4",
      });
    }
    if (!usedRenderTool) {
      failures.push({
        reason: "missing",
        message: "HyperFrames enforce 模式要求调用 render_hyperframes 完成渲染。",
        expected: "render_hyperframes",
      });
    }
  } else {
    recordShadowTelemetry(
      {
        slug,
        usedRenderTool,
        hasMp4,
        verifiedCount: input.verifiedPaths.length,
      },
      input.telemetryDir,
    );
  }

  return { failures, usedRenderTool, hasMp4 };
}
