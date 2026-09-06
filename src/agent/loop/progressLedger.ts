// PD-SAAS-FORK (P0-5): general no-progress budget across write/edit/thinking.
//
// The always-on NoProgressReadRepeatTracker only catches repeated *read-only* loops. This ledger
// EXTENDS coverage (behind PILOTDECK_PROGRESS_BUDGET) to the other zero-progress failure modes:
//   - the model rewrites the SAME file with the SAME content over and over (write/edit loop), or
//   - it emits the SAME substantial thinking text with no tools, turn after turn.
//
// Progress = a real change: a new write/edit content fingerprint, any action tool (export / generate
// / bash / ...), or different thinking text. So legitimate iterative edit_file that actually changes
// content is NEVER penalized (content fingerprint differs each turn). Read-only calls are treated as
// neutral here (the read tracker owns them) so the two guards never double-count the same loop.

import type { PromptLanguage } from "../../context/prompt/resolvePromptLanguage.js";
import type { CanonicalMessage } from "../../model/index.js";
import { readOnlySignature } from "./noProgressReadRepeatTracker.js";

export type ProgressVerdict = "none" | "nudge" | "terminal";

export interface ProgressLedgerCall {
  name: string;
  input: unknown;
}

const WRITE_EDIT_TOOLS = new Set([
  "write_file",
  "write",
  "edit_file",
  "edit",
  "str_replace",
  "search_replace",
  "apply_patch",
  "multi_edit",
  "multiedit",
]);

const MIN_THINKING_FINGERPRINT_LEN = 40;

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Tiny stable string hash (djb2) — enough to fingerprint content for change detection. */
export function fingerprint(text: string): string {
  let hash = 5381;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i += 1) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** `w:<path>#<contentHash>` for a write/edit tool, else null. */
export function writeEditFingerprint(name: string, input: unknown): string | null {
  const tool = String(name ?? "").toLowerCase();
  if (!WRITE_EDIT_TOOLS.has(tool)) return null;
  const obj = asRecord(input);
  const path = str(obj.file_path) || str(obj.path) || str(obj.target_file) || str(obj.filename);
  const content =
    str(obj.content)
    || str(obj.contents)
    || str(obj.new_string)
    || str(obj.new_str)
    || str(obj.replacement)
    || str(obj.code)
    || (Array.isArray(obj.edits) ? JSON.stringify(obj.edits) : "");
  return `w:${path}#${fingerprint(content)}`;
}

type LedgerTurn =
  | { kind: "progress" }
  | { kind: "neutral" }
  | { kind: "key"; key: string };

export function classifyLedgerTurn(
  calls: ProgressLedgerCall[],
  assistantText?: string,
): LedgerTurn {
  if (!Array.isArray(calls) || calls.length === 0) {
    const text = String(assistantText ?? "").replace(/\s+/g, " ").trim();
    if (text.length >= MIN_THINKING_FINGERPRINT_LEN) {
      return { kind: "key", key: `think:${fingerprint(text)}` };
    }
    return { kind: "neutral" };
  }
  const writeKeys: string[] = [];
  let hasAction = false;
  let hasReadOnly = false;
  for (const call of calls) {
    const writeKey = writeEditFingerprint(call.name, call.input);
    if (writeKey) {
      writeKeys.push(writeKey);
      continue;
    }
    if (readOnlySignature(call.name, call.input) !== null) {
      hasReadOnly = true;
      continue;
    }
    hasAction = true;
  }
  if (hasAction) return { kind: "progress" };
  if (writeKeys.length > 0) return { kind: "key", key: writeKeys.slice().sort().join("|") };
  // Only read-only calls -> the read tracker owns this; stay neutral here.
  if (hasReadOnly) return { kind: "neutral" };
  return { kind: "neutral" };
}

export class ProgressLedger {
  private lastKey: string | null = null;
  private streak = 0;

  constructor(
    private readonly nudgeAt = 3,
    private readonly terminalAt = 5,
  ) {}

  record(calls: ProgressLedgerCall[], assistantText?: string): ProgressVerdict {
    const turn = classifyLedgerTurn(calls, assistantText);
    if (turn.kind === "progress") {
      this.lastKey = null;
      this.streak = 0;
      return "none";
    }
    if (turn.kind === "neutral") {
      // Leave state untouched so a single neutral turn doesn't mask an ongoing write loop.
      return "none";
    }
    if (turn.key === this.lastKey) {
      this.streak += 1;
    } else {
      this.lastKey = turn.key;
      this.streak = 1;
    }
    if (this.streak >= this.terminalAt) return "terminal";
    if (this.streak >= this.nudgeAt) return "nudge";
    return "none";
  }

  get currentStreak(): number {
    return this.streak;
  }

  /** True once the no-progress streak has reached the terminal threshold (B cap signal). */
  get terminalReached(): boolean {
    return this.streak >= this.terminalAt;
  }
}

const PROGRESS_LEDGER_NUDGE_ZH =
  "你已连续多次产出相同内容 / 重复同一步骤，但没有任何新进展。请停止重复，基于已掌握信息推进到下一步：补全缺失的交付物、修正真实内容，或直接给出最终结论。不要再重复写入相同内容。";

const PROGRESS_LEDGER_NUDGE_EN =
  "You have produced the same content / repeated the same step several times with no new progress. Stop repeating: move to the next step — complete the missing deliverable, fix the real content, or give the final answer. Do not write the same content again.";

const PROGRESS_LEDGER_STOP_ZH =
  "这一步在重复产出相同内容、没有新进展，我先停下，改用直接产出结果的方式继续。";

const PROGRESS_LEDGER_STOP_EN =
  "This step kept producing the same content with no new progress, so I am stopping it and switching to producing the result directly.";

export function buildProgressLedgerNudgeMessage(language: PromptLanguage = "en"): CanonicalMessage {
  const text = language === "zh-CN" ? PROGRESS_LEDGER_NUDGE_ZH : PROGRESS_LEDGER_NUDGE_EN;
  return {
    role: "user",
    content: [{ type: "text", text }],
    metadata: { synthetic: true, purpose: "no_progress_ledger_nudge" },
  };
}

export function buildProgressLedgerStopMessage(language: PromptLanguage = "en"): CanonicalMessage {
  const text = language === "zh-CN" ? PROGRESS_LEDGER_STOP_ZH : PROGRESS_LEDGER_STOP_EN;
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    metadata: { synthetic: true, purpose: "no_progress_ledger_stop" },
  };
}
