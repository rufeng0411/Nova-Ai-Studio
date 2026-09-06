// PD-SAAS-FORK: deterministic per-turn dialogue / execute / clarify resolver (no extra LLM).

import { isContinuationOnlyUserText, userGoalImpliesDeliverable } from "../../agent/errors/userFacingErrors.js";
import {
  isChatFirstCapability,
  userRequestsBrainstormDeliverable,
} from "../chatFirstCapabilities.js";
import type {
  IntentClarificationOption,
  IntentClarificationPayload,
  TurnInteractionMode,
  TurnInteractionModeRecord,
  TurnInteractionReasonCode,
} from "./turnInteractionMode.js";
import { TURN_INTERACTION_MODE_VERSION } from "./turnInteractionMode.js";

export type ResolveCurrentIntentCapabilityContext = {
  slug?: string;
  majorCategory?: string | null;
  isProcessTemplate?: boolean;
};

export type ResolveCurrentIntentInput = {
  userText: string;
  hasAttachments?: boolean;
  attachmentContentInContext?: boolean;
  capabilityContext?: ResolveCurrentIntentCapabilityContext;
  priorMode?: TurnInteractionMode | null;
  priorClarifyFingerprint?: string | null;
  consecutiveClarifyCount?: number;
  sessionHasIncompleteExecute?: boolean;
  promptLanguage?: "en" | "zh-CN";
};

export type ResolveCurrentIntentResult = TurnInteractionModeRecord;

const CHAT_NEGATION_RE =
  /(?:继续聊|先聊聊|先聊|聊聊天|你怎么看|先讨论|先别做|别做|不要(?:搜索|生成|调用工具|联网|读文件|执行)|别(?:搜索|生成|调用工具|联网|读文件|执行)|仅聊天|纯聊天|只聊|不要工具|别用工具)/i;

const EXECUTE_ACTION_RE =
  /(?:查一下|查询|深度查|检索|搜索|搜一下|查找|读取|读一下|读附件|解析附件|生成|制作|写一份|写出|导出|保存|修改|发布|下载|上传|write_file|联网|调研|报告|海报|pptx|docx|pdf|html|抓取|爬取|fetch|scrape)/i;

const DISCUSSION_ONLY_RE =
  /(?:你觉得|你认为|怎么看|评价|解释|讨论|咨询|闲聊|角色扮演|扮演|假如|假设)/i;

const GREETING_ONLY_RE =
  /^(?:你好|您好|嗨|哈喽|hello|hi|hey|在吗|在么|早上好|下午好|晚上好|早安|晚安)[!！?？.。…~\s啊呀呢吧喔哦哈]*$/i;

/** Bare punctuation — often means “go on” / “what happened?” in an active session. */
const MINIMAL_CONTINUATION_RE = /^[?？!！.。…、,，~～]+$/;

const CONTINUATION_EXECUTE_RE =
  /(?:继续生成|按刚才|保存上面|接着做|继续做|继续执行|继续完成|把刚才|将上面|导出刚才)/i;

const MIXED_CHAT_FIRST_RE = /先聊聊|先讨论|先聊/;
const MIXED_EXECUTE_NOW_RE = /(?:直接生成|马上生成|现在就|立即生成|直接做|马上做)/;

const SIDE_EFFECT_RE =
  /(?:发布到|群发|删除云端|删帖|付费|扣费|群发消息|对外发布)/i;

const ANALYZE_AMBIGUOUS_RE = /^帮我分析一下|^分析一下|^分析这个|^分析下/;

function stripNegatedExecutePhrases(text: string): string {
  return text
    .replace(/不要[\u4e00-\u9fa5a-zA-Z0-9]+/g, " ")
    .replace(/别[\u4e00-\u9fa5a-zA-Z0-9]+/g, " ");
}

function hasExplicitExecuteAction(text: string): boolean {
  const normalized = stripNegatedExecutePhrases(text);
  return EXECUTE_ACTION_RE.test(normalized) && !/(?:怎么生成|如何生成|怎样生成)/.test(normalized);
}

function hasStrongChatNegation(text: string): boolean {
  if (!CHAT_NEGATION_RE.test(text)) return false;
  if (hasExplicitExecuteAction(text) && /(?:再聊聊|然后聊聊|之后聊聊)\s*$/.test(text.trim())) {
    return false;
  }
  return true;
}

function normalizeText(text: string): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function buildClarifyPayload(input: {
  fingerprint: string;
  questionZh: string;
  questionEn: string;
  promptLanguage?: "en" | "zh-CN";
}): IntentClarificationPayload {
  const isZh = input.promptLanguage !== "en";
  const options: IntentClarificationOption[] = isZh
    ? [
        { id: "dialogue", label: "先聊聊" },
        { id: "execute", label: "联网调研并生成报告" },
      ]
    : [
        { id: "dialogue", label: "Chat first" },
        { id: "execute", label: "Research online and deliver a report" },
      ];
  return {
    fingerprint: input.fingerprint,
    question: isZh ? input.questionZh : input.questionEn,
    options,
  };
}

function record(
  mode: TurnInteractionMode,
  reasonCode: TurnInteractionReasonCode,
  source: TurnInteractionModeRecord["source"] = "rule",
  clarification?: IntentClarificationPayload,
): ResolveCurrentIntentResult {
  return {
    version: TURN_INTERACTION_MODE_VERSION,
    mode,
    reasonCode,
    source,
    ...(clarification ? { clarification } : {}),
  };
}

function isExplicitNonChatFirstCapability(ctx?: ResolveCurrentIntentCapabilityContext): boolean {
  if (!ctx?.slug?.trim()) return false;
  if (ctx.isProcessTemplate) return true;
  return !isChatFirstCapability(ctx.slug, ctx.majorCategory);
}

function isExplicitChatFirstCapability(ctx?: ResolveCurrentIntentCapabilityContext): boolean {
  if (!ctx?.slug?.trim()) return false;
  return isChatFirstCapability(ctx.slug, ctx.majorCategory);
}

function hasMixedIntent(text: string): boolean {
  return MIXED_CHAT_FIRST_RE.test(text) && hasExplicitExecuteAction(text);
}

function resolveContinuation(
  text: string,
  input: ResolveCurrentIntentInput,
): ResolveCurrentIntentResult | null {
  const isBareContinue = isContinuationOnlyUserText(text);
  const isContinuationPhrase = isBareContinue || CONTINUATION_EXECUTE_RE.test(text);
  if (!isContinuationPhrase && !MINIMAL_CONTINUATION_RE.test(text)) {
    return null;
  }
  if (input.sessionHasIncompleteExecute || input.priorMode === "execute") {
    return record("execute", "continuation_execute");
  }
  if (isBareContinue && input.priorMode === "dialogue") {
    return record("dialogue", "natural_discussion");
  }
  if (MINIMAL_CONTINUATION_RE.test(text) && input.priorMode === "dialogue") {
    return record("dialogue", "natural_discussion");
  }
  // Bare「继续」/「？」无锚点时默认走 execute，避免 clarify 卡片空等（任务须自动续跑）。
  return record("execute", "continuation_execute");
}

/** PD-SAAS-FORK: pure greeting/small-talk — never auto-continue or task-resume. */
export function isPureGreetingUserText(userText: string): boolean {
  return GREETING_ONLY_RE.test(normalizeText(userText));
}

export function resolveCurrentIntent(input: ResolveCurrentIntentInput): ResolveCurrentIntentResult {
  const text = normalizeText(input.userText);
  const lang = input.promptLanguage ?? "zh-CN";

  try {
    if (!text) {
      return record("clarify", "fail_safe_clarify", "fail_safe", buildClarifyPayload({
        fingerprint: "intent:empty_input",
        questionZh: "请说一下你想聊天，还是需要我帮你制作或查找内容？",
        questionEn: "Would you like to chat, or should I run a task for you?",
        promptLanguage: lang,
      }));
    }

    // 1. Explicit chat negation overrides binding/history.
    if (hasStrongChatNegation(text)) {
      if (hasMixedIntent(text)) {
        if (/先聊.{0,20}(?:决定|是否|看看)/.test(text) && !MIXED_EXECUTE_NOW_RE.test(text)) {
          return record("dialogue", "mixed_intent_dialogue_first");
        }
        if (MIXED_EXECUTE_NOW_RE.test(text) || userGoalImpliesDeliverable(text)) {
          return record("execute", "mixed_intent_execute");
        }
        if (!MIXED_EXECUTE_NOW_RE.test(text)) {
          return record("dialogue", "mixed_intent_dialogue_first");
        }
        const clarification = buildClarifyPayload({
          fingerprint: "intent:mixed_chat_execute",
          questionZh: "你想先聊聊再决定要不要生成，还是这一回合就直接生成成果？",
          questionEn: "Chat first and decide later, or deliver an artifact this turn?",
          promptLanguage: lang,
        });
        return record("clarify", "mixed_intent_clarify", "rule", clarification);
      }
      return record("dialogue", "explicit_chat_negation");
    }

    // 2. Pure greetings / small talk without an action verb.
    if (GREETING_ONLY_RE.test(text)) {
      return record("dialogue", "natural_discussion");
    }

    // 3. Explicit template / non-chat-first capability / execute verbs.
    if (isExplicitNonChatFirstCapability(input.capabilityContext)) {
      return record("execute", "explicit_template_or_capability");
    }
    if (SIDE_EFFECT_RE.test(text)) {
      return record("execute", "side_effect_action");
    }
    if (hasExplicitExecuteAction(text)) {
      return record("execute", "explicit_execute_action");
    }

    // 3. Chat-first capability without deliverable signal.
    if (
      isExplicitChatFirstCapability(input.capabilityContext)
      && !userRequestsBrainstormDeliverable(text)
      && !userGoalImpliesDeliverable(text)
    ) {
      return record("dialogue", "chat_first_no_deliverable");
    }

    // 5. Continuation inherits prior mode when possible.
    const continuation = resolveContinuation(text, input);
    if (continuation) return continuation;

    // 6. Attachments.
    if (input.hasAttachments) {
      if (input.attachmentContentInContext && (DISCUSSION_ONLY_RE.test(text) || text.length < 48)) {
        return record("dialogue", "natural_discussion");
      }
      if (!input.attachmentContentInContext) {
        return record("execute", "attachment_needs_read");
      }
    }

    // 7. Ambiguous analyze / continue without anchor.
    if (ANALYZE_AMBIGUOUS_RE.test(text) && !hasExplicitExecuteAction(text.replace(ANALYZE_AMBIGUOUS_RE, ""))) {
      if (
        input.priorClarifyFingerprint === "intent:ambiguous_analyze"
        && (input.consecutiveClarifyCount ?? 0) >= 1
      ) {
        return record("dialogue", "clarify_fuse_dialogue", "clarify_fuse");
      }
      const clarification = buildClarifyPayload({
        fingerprint: "intent:ambiguous_analyze",
        questionZh: "你想先基于现有信息聊聊，还是让我联网调研并生成报告？",
        questionEn: "Chat with what we have, or research online and deliver a report?",
        promptLanguage: lang,
      });
      return record("clarify", "ambiguous_analyze", "rule", clarification);
    }

    // 4. Natural discussion without external action.
    if (
      DISCUSSION_ONLY_RE.test(text)
      || (!hasExplicitExecuteAction(text) && !userGoalImpliesDeliverable(text) && text.length < 120)
    ) {
      return record("dialogue", "natural_discussion");
    }

    if (userGoalImpliesDeliverable(text)) {
      return record("execute", "explicit_execute_action");
    }

    return record("dialogue", "natural_discussion");
  } catch {
    if (isExplicitNonChatFirstCapability(input.capabilityContext) || hasExplicitExecuteAction(text)) {
      return record("execute", "fail_safe_execute", "fail_safe");
    }
    return record("clarify", "fail_safe_clarify", "fail_safe", buildClarifyPayload({
      fingerprint: "intent:resolver_error",
      questionZh: "你想先聊聊，还是需要我帮你制作或查找内容？",
      questionEn: "Would you like to chat, or should I run a task for you?",
      promptLanguage: lang,
    }));
  }
}

export function extractUserTextFromAcceptedMessages(
  messages: Array<{ role?: string; content?: unknown }>,
): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== "user") continue;
    const content = msg.content;
    if (typeof content === "string") return normalizeText(content);
    if (!Array.isArray(content)) return "";
    return normalizeText(
      content
        .filter((block) => block && typeof block === "object" && (block as { type?: string }).type === "text")
        .map((block) => String((block as { text?: string }).text ?? ""))
        .join("\n"),
    );
  }
  return "";
}
