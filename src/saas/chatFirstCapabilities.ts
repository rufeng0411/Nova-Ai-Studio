/** PD-SAAS-FORK: 仅能力中心「脑爆」Tab 默认纯聊天；其他大类走执行链。 */

/**
 * 是否对该能力默认走「聊天优先」（不强制 read_skill / 工具链）。
 * 权威信号：`majorCategory === 'brainstorming'`（Hub 脑爆 Tab）。
 * slug 启发式已移除——非脑爆大类即使 slug 含 persona/brainstorm 也不默认纯聊天。
 */
export function isChatFirstCapability(
  _slug: string,
  majorCategory?: string | null,
): boolean {
  return majorCategory?.trim().toLowerCase() === "brainstorming";
}

/** 用户明确要求交付物时，脑暴会话应升档到工具链（绑定提示与 Recovery 共用）。 */
export const BRAINSTORM_DELIVERABLE_SIGNALS = [
  "生成报告",
  "写报告",
  "总结分析",
  "分析报告",
  "导出",
  "写文档",
  "写进",
  "落盘",
  "保存到",
  "artifacts",
  "PRD",
  "画布",
  "canvas",
  "路线图",
  "roadmap",
  "通稿",
  "docx",
  "pptx",
  "markdown 文件",
  "md 文件",
  "write_file",
  "交付",
  "产出文件",
] as const;

/**
 * 粗略判断用户消息是否在要「报告/总结/文件类交付」（供后续 Lite Turn 升档，可选）。
 */
export function userRequestsBrainstormDeliverable(userText: string): boolean {
  const text = userText.trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  return BRAINSTORM_DELIVERABLE_SIGNALS.some((signal) => {
    const s = signal.toLowerCase();
    return lower.includes(s) || text.includes(signal);
  });
}
