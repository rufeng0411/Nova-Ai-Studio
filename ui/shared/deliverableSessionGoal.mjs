// PD-SAAS-FORK: dual-runtime deliverable goal extraction (engine + UI).

const DELIVERABLE_GOAL_PATTERNS = [
  /(?:生成|制作|导出|创建|输出).{0,24}(?:ppt|PPT|pptx|幻灯|演示)/,
  /可编辑的?\s*(?:PPT|pptx|幻灯)/,
  /(?:生成|导出|输出|制作|创建|做).{0,24}(?:docx|word|pdf|报告|html|网页|落地页|官网|网站|页面)/i,
  /(?:产出|保存|存).{0,24}artifacts\//i,
  /(?:文件路径|报路径|成果路径|交付清单|告诉我.*路径|做完告诉我)/,
  /(?:主视觉|海报|配图|平台草稿|drafts?)/i,
  /(?:campaign|Campaign|传播|营销).{0,40}(?:全案|brief|Brief|方案)/,
  /(?:GEO|AEO|geo-aeo|pd-geo|optimized\.md|schema\.jsonld|visibility-report|引用评分)/i,
  /(?:社媒矩阵|social-matrix|social-creative|国内社媒|多平台文案|四套比例|小红书.*草稿)/i,
  /(?:内容\s*飞轮|content[-\s]?flywheel|选题\s*[→\->]\s*长文|01-topics\.md|02-longform\.md|03-social-slices\.md)/i,
  /(?:Seedance|即梦|分镜提示|storyboard prompt|scenedance)/i,
  /(?:连续性分镜包|continuity\s*分镜|分镜包|bible|镜头卡|交接矩阵|handoff)/i,
  /(?:React\s*程序化视频|Remotion|程序化视频|模板化视频|批量渲染|render_html_video)/i,
  /(?:TimesFM|时序预测|forecast).{0,40}(?:预测|图表|结果文件|csv|CSV|json|PNG|png|路径)/i,
  /PPT(?:幻灯|演示)?/,
  /pptxgenjs|pptx/i,
];

export function sharedUserGoalImpliesDeliverable(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return false;
  return DELIVERABLE_GOAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isContinuationOnlyUserText(text) {
  const trimmed = String(text ?? '').trim();
  return /^(继续|继续做|接着做|往下做|继续执行|继续完成|continue|go on|resume)$/i.test(trimmed);
}

export function isTaskFollowUpComplaintText(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return false;
  if (trimmed.length > 240 && sharedUserGoalImpliesDeliverable(trimmed)) return false;
  return /(?:任务(?:没有|还未|没)?完成|什么意思|怎么(?:回事|停了|中断)|为什么没有|成果(?:呢|在哪)|还没做完|连成果都|无操作)/.test(trimmed)
    && !/(?:artifacts\/|social-matrix|社媒矩阵|GEO|pptx|docx|直接开始做)/i.test(trimmed);
}

export function isAmbiguousFollowUpText(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed || trimmed.length > 48) return false;
  if (sharedUserGoalImpliesDeliverable(trimmed)) return false;
  if (/^(?:任务没有完成|什么意思)/.test(trimmed)) return false;
  return /^[？?…\s!！。.、,，:：;；\-—~～]+$/.test(trimmed)
    || /^(?:啥|嗯|哦|啊|呃|huh|what|\?+|？+)$/i.test(trimmed);
}

function textFromMessageContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => {
      if (!block || typeof block !== 'object') return '';
      return typeof block.text === 'string' ? block.text : '';
    })
    .join('\n');
}

/** PD-SAAS-FORK 1bde3fb1: drop inlined attachment bodies so PPT mentions inside HTML cannot become the session goal. */
function stripAttachmentNoiseFromGoalText(text) {
  return String(text ?? '')
    .replace(/<attachment\b[^>]*>[\s\S]*?<\/attachment>/gi, '')
    .replace(/\[Files attached by user[\s\S]*$/i, '')
    .trim();
}

function isUserSessionMessage(message) {
  return message?.role === 'user' || message?.type === 'user';
}

/** PD-SAAS-FORK: short follow-ups that answer PPT page/aspect preference (incl. "8，继续"). */
export function isShortClarificationAnswerText(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) return false;
  return /^(?:\d{1,3}\s*(?:页|张|个|份|pages?|slides?)?(?:\s*[，,、]?\s*(?:继续|开始|直接开始做|直接执行)?)?|(?:16:9|9:16|4:3|3:4|1:1)|(?:直接开始做|直接执行|直接开做|开始执行|开始做))$/i.test(normalized);
}

function isSubstantiveDeliverableGoal(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return false;
  return sharedUserGoalImpliesDeliverable(trimmed) || trimmed.length >= 40;
}

/** PD-SAAS-FORK: detect page count in goal text including 【6】页 / 6页 / 6 pages. */
export function goalHasPageCount(goal) {
  const text = String(goal ?? '');
  if (!text.trim()) return false;
  return /\d+\s*页/.test(text)
    || /【\s*\d+\s*】\s*页/.test(text)
    || /【\s*\d+\s*页\s*】/.test(text)
    || /\b\d+\s*pages?\b/i.test(text)
    || /[零一二三四五六七八九十两]\s*页/.test(text)
    // Merged clarification follow-ups like "8，继续" / bare "8"
    || /(?:^|\n)\s*\d{1,3}\s*(?:页)?\s*[，,、]?\s*(?:继续|开始)?\s*(?:\n|$)/m.test(text);
}

/** PD-SAAS-FORK: merge substantive session goal with short clarification follow-ups (e.g. "6页"). */
export function resolveClarificationGoal(messages) {
  const base = extractDeliverableSessionUserGoal(messages);
  const extras = [];
  for (const message of messages ?? []) {
    if (!isUserSessionMessage(message)) continue;
    const text = stripAttachmentNoiseFromGoalText(textFromMessageContent(message.content));
    if (!text || isContinuationOnlyUserText(text)) continue;
    if (isTaskFollowUpComplaintText(text) || isAmbiguousFollowUpText(text)) continue;
    // Turn Queue stamps accepted_input.synthetic=true even for real user replies — still merge
    // short page/direct-start answers so clarification does not loop (Showcase 99d4417a).
    if (
      isShortClarificationAnswerText(text)
      || /^\d+\s*页/i.test(text)
      || /直接开始做|直接执行|直接开做/.test(text)
    ) {
      if (!base.includes(text)) extras.push(text);
      continue;
    }
    if (message.metadata?.synthetic) continue;
  }
  if (extras.length === 0) return base;
  return base ? `${base}\n${extras.join("\n")}` : extras.join("\n");
}

export function extractDeliverableSessionUserGoal(messages) {
  let sessionGoal = '';
  for (const message of messages ?? []) {
    if (!isUserSessionMessage(message)) continue;
    if (message.metadata?.synthetic) continue;
    const text = stripAttachmentNoiseFromGoalText(textFromMessageContent(message.content));
    if (!text) continue;
    if (isContinuationOnlyUserText(text)) continue;
    if (isTaskFollowUpComplaintText(text)) continue;
    if (isAmbiguousFollowUpText(text)) continue;
    if (isShortClarificationAnswerText(text)) continue;
    if (isSubstantiveDeliverableGoal(text)) {
      sessionGoal = text;
    }
  }
  if (sessionGoal) return sessionGoal;

  for (let i = (messages?.length ?? 0) - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!isUserSessionMessage(message)) continue;
    if (message.metadata?.synthetic) continue;
    const text = stripAttachmentNoiseFromGoalText(textFromMessageContent(message.content));
    if (!text || isContinuationOnlyUserText(text)) continue;
    if (isTaskFollowUpComplaintText(text) || isAmbiguousFollowUpText(text)) continue;
    if (isSubstantiveDeliverableGoal(text)) return text;
  }
  return '';
}
