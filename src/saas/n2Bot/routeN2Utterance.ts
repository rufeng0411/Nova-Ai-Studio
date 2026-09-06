// PD-SAAS-FORK: T0–T3 steward router. Default unmatched = chat, never default T3.

import { userGoalImpliesDeliverable } from "../../agent/errors/userFacingErrors.js";
import { isPureGreetingUserText } from "../intent/resolveCurrentIntent.js";
import { isNovaWakePhrase } from "./isNovaWakePhrase.js";
import type { N2RouteTier, N2UtteranceKind } from "./n2BotTypes.js";

export type RouteN2UtteranceInput = {
  text: string;
  pendingElicit?: { optionIds: string[] };
  lastFocusCardId?: string;
  hasAttachments?: boolean;
};

export type RouteN2UtteranceResult = {
  kind: N2UtteranceKind;
  tier: N2RouteTier;
};

const THANKS_RE = /^(?:谢谢|多谢|感谢|thanks|thank\s+you|thx)[!！.。\s]*$/i;
const IDENTITY_RE =
  /(?:你是谁|你叫什么|你能做什么|能做什么|who\s+are\s+you|what\s+can\s+you\s+do)/i;
const PROGRESS_RE =
  /^(?:进度|手头|还没好吗|好了没|哪件卡住|在做什么|status|\?|？|？？)$/i;
const STOPALL_RE = /(?:都停|全部暂停|全都停|stop\s+all)/i;
const PAUSE_RE = /(?:暂停(?:那件|这个|这件)?|pause(?:\s+it)?)/i;
const RESUME_RE = /(?:继续(?:那件|这个|这件)?|resume|接着做|配好了)/i;
const RETRY_RE = /(?:重试|再试一次|retry)/i;
const PEEK_CLOSE_RE = /^(?:收起|关掉预览|关闭预览|close\s+peek)$/i;
const PEEK_NEXT_RE = /^(?:下一页|下页|next\s+page)$/i;
const PEEK_PREV_RE = /^(?:上一页|上页|prev(?:ious)?\s+page)$/i;
const PEEK_SWITCH_RE = /(?:换成|换一份|switch\s+to)/i;
const OPEN_RE = /(?:打开|看看|预览|peek|open\s+(?:this|the|that))/i;
const SHARE_RE = /^(?:分享|复制链接|share)$/i;
const SEND_RE = /(?:发给|发送给|发给谁|send\s+to)/i;
const ALLOW_RE = /^(?:允许|allow)[!！.。\s]*$/i;
const SAVE_RE = /^(?:保存|下载|存到本机|save|download)$/i;
const LOCK_RE = /(?:锁定|都锁上|lock)/i;
const UNLOCK_RE = /(?:解锁|unlock)/i;
const COMPLETE_RE = /(?:任务完成|这件算(?:任务)?完成|mark\s+complete)/i;
const UNCOMPLETE_RE = /(?:取消任务完成|uncomplete)/i;
const DELETE_RE = /(?:删掉|删除(?:记录|这条|周会)?|delete)/i;
const CONFIRM_RE = /^(?:确定|确认|yes|ok|好的?，删)[!！.。\s]*$/i;
const CANCEL_PENDING_RE = /^(?:算了|取消|不要了|no)$/i;
const SCHEDULE_RE =
  /(?:每天|每周|每小时|九点|订点|计划任务|cron|every\s+day)/i;
const THINK_RE = /(?:帮我想想|怎么讲更顺|开场怎么讲|你怎么看)/i;
const QUALITY_RE =
  /(?:好丑|图呢|图在哪|再出个|另外.{0,8}html|改成\s*\d+\s*页|质量)/i;
const MATERIAL_RE = /按这份材料/;
const CLOSE_RE = /^(?:关掉|关闭管家|close)$/i;

function normalize(text: string): string {
  return String(text ?? "").trim();
}

function mapPendingOption(text: string, optionIds: string[]): N2UtteranceKind | null {
  const t = normalize(text);
  const lower = t.toLowerCase();
  if (
    optionIds.includes("confirm")
    && (CONFIRM_RE.test(t) || lower === "confirm")
  ) {
    return "confirm_delete";
  }
  if (optionIds.includes("allow") && (ALLOW_RE.test(t) || lower === "allow")) {
    return "allow";
  }
  if (CANCEL_PENDING_RE.test(t) || lower === "cancel") return "close";
  if (optionIds.includes(lower)) {
    if (lower === "unlock_delete" || lower === "confirm") return "confirm_delete";
    if (lower === "allow") return "allow";
    if (lower === "unlock_only" || lower === "fallback") return "close";
  }
  if (/随便|推荐|default/i.test(t)) {
    if (optionIds.includes("confirm")) return "confirm_delete";
    if (optionIds.includes("allow")) return "allow";
  }
  return null;
}

export function classifyN2Utterance(text: string): N2UtteranceKind {
  return routeN2Utterance({ text }).kind;
}

export function routeN2Utterance(input: RouteN2UtteranceInput): RouteN2UtteranceResult {
  const text = normalize(input.text);
  if (input.pendingElicit?.optionIds?.length) {
    const mapped = mapPendingOption(text, input.pendingElicit.optionIds);
    if (mapped === "confirm_delete") return { kind: "confirm_delete", tier: "T1" };
    if (mapped === "allow") return { kind: "allow", tier: "T1" };
    if (mapped === "close") return { kind: "close", tier: "T1" };
    // Pending card: never start a new chat or dispatch. Use recommended default.
    if (input.pendingElicit.optionIds.includes("confirm")) {
      return { kind: "confirm_delete", tier: "T1" };
    }
    if (input.pendingElicit.optionIds.includes("allow")) {
      return { kind: "allow", tier: "T1" };
    }
    return { kind: "close", tier: "T1" };
  }

  if (!text) return { kind: "chat", tier: "T0" };

  if (isNovaWakePhrase(text)) return { kind: "wake", tier: "T0" };
  if (isPureGreetingUserText(text) || /^(?:你好啊|在呢)[!！.。\s]*$/i.test(text)) {
    return { kind: "wake", tier: "T0" };
  }
  if (THANKS_RE.test(text)) return { kind: "thanks", tier: "T0" };
  if (IDENTITY_RE.test(text)) return { kind: "identity", tier: "T0" };

  if (PEEK_CLOSE_RE.test(text)) return { kind: "peek_close", tier: "T1" };
  if (PEEK_NEXT_RE.test(text)) return { kind: "peek_next", tier: "T1" };
  if (PEEK_PREV_RE.test(text)) return { kind: "peek_prev", tier: "T1" };
  if (PEEK_SWITCH_RE.test(text)) return { kind: "peek_switch", tier: "T1" };
  if (ALLOW_RE.test(text)) return { kind: "allow", tier: "T1" };
  if (SHARE_RE.test(text)) return { kind: "share", tier: "T1" };
  if (SEND_RE.test(text)) return { kind: "send", tier: "T1" };
  if (SAVE_RE.test(text)) return { kind: "save", tier: "T1" };
  if (STOPALL_RE.test(text)) return { kind: "stopall", tier: "T1" };
  if (PAUSE_RE.test(text) && !STOPALL_RE.test(text)) return { kind: "pause", tier: "T1" };
  if (UNCOMPLETE_RE.test(text)) return { kind: "uncomplete_task", tier: "T1" };
  if (COMPLETE_RE.test(text)) return { kind: "complete_task", tier: "T1" };
  if (UNLOCK_RE.test(text)) return { kind: "unlock", tier: "T1" };
  if (LOCK_RE.test(text)) return { kind: "lock", tier: "T1" };
  if (DELETE_RE.test(text)) return { kind: "delete_record", tier: "T1" };
  if (CONFIRM_RE.test(text)) return { kind: "confirm_delete", tier: "T1" };
  if (RETRY_RE.test(text) || /接着做|配好了/.test(text)) {
    return { kind: "continue_blocked", tier: "T1" };
  }
  if (RESUME_RE.test(text)) return { kind: "resume", tier: "T1" };
  if (PROGRESS_RE.test(text) || /^(?:进度|手头)/.test(text)) {
    return { kind: "progress", tier: "T1" };
  }
  if (CLOSE_RE.test(text)) return { kind: "close", tier: "T1" };
  if (SCHEDULE_RE.test(text)) return { kind: "schedule", tier: "T1" };

  if (QUALITY_RE.test(text) && input.lastFocusCardId) {
    return { kind: "quality_feedback", tier: "T1" };
  }
  if (QUALITY_RE.test(text) && /再出个|另外/.test(text)) {
    return { kind: "quality_feedback", tier: "T1" };
  }

  if (OPEN_RE.test(text) && !userGoalImpliesDeliverable(text)) {
    return { kind: "open", tier: "T1" };
  }

  if (MATERIAL_RE.test(text) && input.hasAttachments !== true) {
    return { kind: "delegate", tier: "T1" };
  }

  if (THINK_RE.test(text) && !userGoalImpliesDeliverable(text)) {
    return { kind: "chat", tier: "T2" };
  }

  if (userGoalImpliesDeliverable(text) || /试一下/.test(text)) {
    return { kind: "delegate", tier: "T3" };
  }

  return { kind: "chat", tier: "T2" };
}

export function needsFileBeforeDelegate(text: string, hasAttachments: boolean): boolean {
  return MATERIAL_RE.test(normalize(text)) && !hasAttachments;
}

export function shouldDispatchWorker(route: RouteN2UtteranceResult, text: string, hasAttachments: boolean): boolean {
  if (route.kind !== "delegate" || route.tier !== "T3") return false;
  if (needsFileBeforeDelegate(text, hasAttachments)) return false;
  return true;
}
