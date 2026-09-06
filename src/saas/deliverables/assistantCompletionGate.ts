// PD-SAAS-FORK ES9 P0-C + P0-D: block misleading assistant copy when acceptance !== passed.
import { assistantCompletionGateMode } from "../resilience/stabilityFlags.js";
import { pathUnderAcceptanceScope } from "./filterAcceptancePathsForScope.js";

const COMPLETION_CLAIM_PATTERNS = [
  /任务(?:已|全部)?完成/i,
  /(?:全部|所有|三份|各项|清单).{0,12}(?:均已|已经|全部).{0,8}(?:交付|完成|就绪)/i,
  /(?:交付|制作)(?:工作|任务)?(?:已|全部)?完成/i,
  /全部交付物已存在/i,
  /无缺失/i,
  /无需续跑/i,
  /✅\s*全部交付/i,
  /all\s+(?:deliverables?|tasks?|items?)\s+(?:are\s+)?(?:complete|delivered|done)/i,
  /task\s+(?:is\s+)?complete/i,
];

const INTERNAL_TERM_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /needs_repair/gi, replacement: "清单仍有项在对齐中" },
  { pattern: /repair circuit/gi, replacement: "清单对齐" },
  { pattern: /验收失败/g, replacement: "清单仍在核对中" },
  { pattern: /Failed tools:.*/gi, replacement: "" },
  { pattern: /Something went wrong.*/gi, replacement: "" },
];

const TASK_ARTIFACT_PATH = /artifacts\/task-[\w-]+(?:\/[^\s)\]`"'<>]+)?/gi;

export function assistantClaimsDeliverableComplete(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  return COMPLETION_CLAIM_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export type GateAssistantCompletionInput = {
  text: string;
  acceptanceStatus?: string;
  completionState?: string;
  /** PD-SAAS-FORK 0731: certificate.complete must be true with acceptance passed. */
  certificateComplete?: boolean;
  taskArtifactDir?: string | null;
};

export type GateAssistantCompletionResult = {
  text: string;
  gated: boolean;
  mode: "off" | "shadow" | "enforce";
};

const SOFTEN_ZH =
  "（系统验收尚未全部通过，清单中仍有未完成项；上方结论供参考，请以界面成果清单为准。）";
const SOFTEN_EN =
  " (System acceptance is not fully passed; some deliverables are still pending — refer to the Results list in the UI.)";

const SCOPE_FOOTNOTE_ZH =
  "（部分路径不在本任务目录，请以右侧成果清单为准。）";
const SCOPE_FOOTNOTE_EN =
  " (Some paths are outside the current task folder — refer to the Results list on the right.)";

function sanitizeTrustCopy(
  text: string,
  taskArtifactDir?: string | null,
): { text: string; changed: boolean; scopeFootnote: boolean } {
  let next = String(text ?? "");
  let changed = false;
  let scopeFootnote = false;

  for (const { pattern, replacement } of INTERNAL_TERM_PATTERNS) {
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement);
      changed = true;
    }
  }

  if (taskArtifactDir) {
    const matches = next.match(TASK_ARTIFACT_PATH) ?? [];
    for (const match of matches) {
      if (!pathUnderAcceptanceScope(match, taskArtifactDir)) {
        scopeFootnote = true;
        break;
      }
    }
  }

  next = next.replace(/\n{3,}/g, "\n\n").trim();
  return { text: next, changed, scopeFootnote };
}

/** Shadow: append soft disclaimer; enforce: strip completion claims and append disclaimer. */
export function gateAssistantCompletionText(
  input: GateAssistantCompletionInput,
  language: "zh-CN" | "en" = "zh-CN",
): GateAssistantCompletionResult {
  const mode = assistantCompletionGateMode();
  if (mode === "off") {
    return { text: input.text, gated: false, mode };
  }

  // Dual gate: acceptance passed AND (when provided) certificate.complete === true.
  const acceptancePassed =
    input.acceptanceStatus === "passed"
    || input.completionState === "complete";
  const certificateOk = input.certificateComplete === undefined
    ? true
    : input.certificateComplete === true;
  const passed = acceptancePassed && certificateOk;

  const trust = sanitizeTrustCopy(input.text, input.taskArtifactDir);
  let text = trust.text;
  let gated = trust.changed;

  if (trust.scopeFootnote && !passed) {
    const footnote = language === "zh-CN" ? SCOPE_FOOTNOTE_ZH : SCOPE_FOOTNOTE_EN;
    if (!text.includes(footnote.trim())) {
      text = `${text}\n\n${footnote}`;
      gated = true;
    }
  }

  if (passed || !assistantClaimsDeliverableComplete(text)) {
    return { text, gated, mode };
  }

  const soften = language === "zh-CN" ? SOFTEN_ZH : SOFTEN_EN;
  if (mode === "enforce") {
    let next = text;
    for (const pattern of COMPLETION_CLAIM_PATTERNS) {
      next = next.replace(pattern, "");
    }
    next = next.replace(/\n{3,}/g, "\n\n").trim();
    return {
      text: next ? `${next}\n\n${soften}` : soften,
      gated: true,
      mode,
    };
  }
  return {
    text: `${text.trim()}\n\n${soften}`,
    gated: true,
    mode,
  };
}
