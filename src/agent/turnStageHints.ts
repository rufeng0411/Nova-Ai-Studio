// PD-SAAS-FORK: localized pre-model stage hints to reduce perceived "freeze".

import type { PromptLanguage } from "../context/prompt/resolvePromptLanguage.js";

export type TurnStageHintKey =
  | "session_prepare"
  | "plugin_refresh"
  | "mcp_ready"
  | "memory_retrieve"
  | "router_judge"
  | "compact";

const HINTS: Record<PromptLanguage, Record<TurnStageHintKey, string>> = {
  "zh-CN": {
    session_prepare: "正在准备对话",
    plugin_refresh: "正在加载能力",
    mcp_ready: "正在连接工具服务",
    memory_retrieve: "正在读取相关记忆",
    router_judge: "正在判断任务类型与执行方式",
    compact: "正在压缩上下文",
  },
  en: {
    session_prepare: "Preparing session environment and tools…",
    plugin_refresh: "Loading capabilities and plugins…",
    mcp_ready: "Connecting external tool services…",
    memory_retrieve: "Retrieving project memory…",
    router_judge: "Analyzing task complexity…",
    compact: "Compacting conversation context…",
  },
};

export function turnStageHintText(
  key: TurnStageHintKey,
  language: PromptLanguage | undefined,
): string {
  const lang = language === "en" ? "en" : "zh-CN";
  return HINTS[lang][key];
}
