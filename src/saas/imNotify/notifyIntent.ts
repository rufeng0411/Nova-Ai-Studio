/** PD-SAAS-FORK: gate notify tool use — only on explicit user intent. */

const NOTIFY_INTENT_RE =
  /发(到|给|送)?\s*(企微|企业微信|钉钉|whatsapp|WhatsApp|群通知|通知)|notify\s+(to\s+)?(wecom|dingtalk|whatsapp)|推送到\s*(企微|钉钉|whatsapp)/i;

const GREETING_RE = /^(你好|您好|嗨|hi|hello|hey)[啊呀嘛]?[！!。.~～\s]*$/i;

export function userWantsImNotify(text: string): boolean {
  const t = String(text || "").trim();
  if (!t || GREETING_RE.test(t)) return false;
  return NOTIFY_INTENT_RE.test(t);
}

export function buildImNotifyBindingAppendPrompt(opts: {
  flag: "off" | "shadow" | "enforce";
  userText: string;
}): string {
  if (opts.flag === "off") return "";
  if (!userWantsImNotify(opts.userText)) return "";
  const lines = [
    "用户明确要求向企业微信/钉钉/WhatsApp 发送通知。",
    "若已配置 mcp__im-notify__* 工具，优先调用 notify_send；未配置则简短说明需管理员在「后台 → 消息通道 → 出站通知」配置。",
    "禁止在寒暄或无关对话中主动发通知。WhatsApp 不支持 Markdown，请用纯文本。",
  ];
  if (opts.flag === "shadow") {
    lines.push("（shadow：可选用工具，不强制。）");
  }
  return lines.join("");
}
