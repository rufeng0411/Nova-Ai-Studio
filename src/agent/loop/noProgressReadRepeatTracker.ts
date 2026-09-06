// PD-SAAS-FORK: detect a no-progress loop of *successful* read-only tools in one turn.
//
// 既有的护栏（ToolFailureRepeatTracker / crossTurnTracker / shouldInjectToolRecoveryTurn /
// isStuckInvalidInputTurn）全部只统计【失败】的工具调用。但真实事故里模型会陷入「成功却零
// 进展」的死循环：连续 16 轮 read_file 同一个 index.html（每次都成功返回内容）、thinking 一字
// 不变，烧掉 330 万 token、跑 12 分钟，最后还把回合标成 completed —— 全程没有任何失败可供既
// 有护栏触发。本 tracker 专门补这个缺口。
//
// 工作方式：监视【只读工具】的调用签名（read_file 的 file_path、grep 的 pattern、web_search
// 的 query、read_skill 的 skill 等）。当同一组只读签名在相邻回合连续重复、且期间没有任何写
// 操作 / 新签名（= 没有任何新进展）：
//   - 到达 NUDGE 阈值（默认 3 次）：注入一次强提示，要求模型停止重复读取、立即基于已掌握信息
//     用 write_file 产出交付物，或直接给最终结论；
//   - 到达 TERMINAL 阈值（默认 5 次）：温和收尾本回合，交给「未完成交付物自动续跑」（带强约束
//     的 task-resume）兜底，避免无限烧 token。
// 任何写操作或一个新的只读签名都会重置计数（视为有进展）。

import type { PromptLanguage } from "../../context/prompt/resolvePromptLanguage.js";
import type { CanonicalMessage } from "../../model/index.js";

export type NoProgressReadVerdict = "none" | "nudge" | "terminal";

export interface NoProgressReadCall {
  name: string;
  input: unknown;
}

const READ_ONLY_TOOLS = new Set([
  "read_file",
  "read",
  "grep",
  "glob",
  "list_dir",
  "list",
  "web_search",
  "read_skill",
]);

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Stable signature for a read-only call, or null when the tool is not read-only
 * (i.e. it can make real progress, e.g. write_file / edit_file / export_document).
 */
export function readOnlySignature(name: string, input: unknown): string | null {
  const tool = String(name ?? "").toLowerCase();
  if (!READ_ONLY_TOOLS.has(tool)) return null;
  const obj = asRecord(input);
  switch (tool) {
    case "read_file":
    case "read":
      return `read:${str(obj.file_path) || str(obj.path) || str(obj.target_file)}`;
    case "grep":
      return `grep:${str(obj.pattern)}|${str(obj.path)}|${str(obj.glob)}`;
    case "glob":
      return `glob:${str(obj.glob_pattern) || str(obj.pattern)}|${str(obj.target_directory) || str(obj.path)}`;
    case "list_dir":
    case "list":
      return `list:${str(obj.path) || str(obj.target_directory)}`;
    case "web_search":
      return `web_search:${str(obj.query) || str(obj.search_term)}`;
    case "read_skill":
      return `read_skill:${str(obj.skill) || str(obj.name) || str(obj.slug)}`;
    default:
      return null;
  }
}

export class NoProgressReadRepeatTracker {
  private lastSignature: string | null = null;
  private streak = 0;

  constructor(
    private readonly nudgeAt = 3,
    private readonly terminalAt = 5,
  ) {}

  /**
   * Record one loop iteration's tool calls. Returns whether the model is stuck
   * re-issuing the same read-only call(s) with no progress.
   */
  record(calls: NoProgressReadCall[]): NoProgressReadVerdict {
    if (!Array.isArray(calls) || calls.length === 0) {
      // Text-only turn (no tools): not a read loop. Leave state untouched so a
      // single reflective turn between reads does not mask an ongoing loop.
      return "none";
    }
    const signatures: string[] = [];
    let hasProgressTool = false;
    for (const call of calls) {
      const sig = readOnlySignature(call.name, call.input);
      if (sig === null) {
        hasProgressTool = true;
      } else {
        signatures.push(sig);
      }
    }
    if (hasProgressTool || signatures.length === 0) {
      // A write/action tool ran (or nothing read-only) → real progress; reset.
      this.lastSignature = null;
      this.streak = 0;
      return "none";
    }
    const combined = [...signatures].sort().join("|");
    if (combined === this.lastSignature) {
      this.streak += 1;
    } else {
      this.lastSignature = combined;
      this.streak = 1;
    }
    if (this.streak >= this.terminalAt) return "terminal";
    if (this.streak >= this.nudgeAt) return "nudge";
    return "none";
  }

  /** Exposed for diagnostics/tests. */
  get currentStreak(): number {
    return this.streak;
  }
}

const NO_PROGRESS_READ_NUDGE_ZH =
  "你已连续多次读取同一文件 / 重复同一查询，但没有任何新进展。请立即停止重复读取，基于已经掌握的信息用 write_file 在 artifacts/ 下产出最终交付物（如 .md 报告），或直接给出最终结论。不要再用 read_file 读同一路径。";

const NO_PROGRESS_READ_NUDGE_EN =
  "You have read the same file / repeated the same query several times with no new progress. Stop re-reading now: use write_file under artifacts/ to produce the final deliverable (e.g. a .md report) from what you already have, or give the final answer directly. Do not read_file the same path again.";

const NO_PROGRESS_READ_STOP_ZH =
  "这一步在重复读取同一文件、没有新进展，我先停下，改用直接产出结果的方式继续。";

const NO_PROGRESS_READ_STOP_EN =
  "This step kept re-reading the same file with no new progress, so I am stopping it and switching to producing the result directly.";

/** Synthetic user nudge injected at the NUDGE threshold (model self-corrects). */
export function buildNoProgressReadNudgeMessage(language: PromptLanguage = "en"): CanonicalMessage {
  const text = language === "zh-CN" ? NO_PROGRESS_READ_NUDGE_ZH : NO_PROGRESS_READ_NUDGE_EN;
  return {
    role: "user",
    content: [{ type: "text", text }],
    metadata: { synthetic: true, purpose: "no_progress_read_nudge" },
  };
}

/** Gentle assistant-facing note shown when the turn is wrapped up at TERMINAL. */
export function buildNoProgressReadStopMessage(language: PromptLanguage = "en"): CanonicalMessage {
  const text = language === "zh-CN" ? NO_PROGRESS_READ_STOP_ZH : NO_PROGRESS_READ_STOP_EN;
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    metadata: { synthetic: true, purpose: "no_progress_read_stop" },
  };
}
