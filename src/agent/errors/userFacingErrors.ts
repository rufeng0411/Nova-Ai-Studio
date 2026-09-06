// PD-SAAS-FORK: user-facing error copy and severity for UI gentle notices
import type { CanonicalMessageMetadata } from "../../model/index.js";
import { buildTaskGoalContract } from "../../saas/taskState/taskGoalContract.js";

const TRANSIENT_NETWORK_PATTERN =
  /(?:fetch failed|failed to fetch|network error|network|econnreset|econnrefused|etimedout|socket hang up|epipe|timeout|aborted|temporar|rate limit|too many requests)/i;

/** 联网类工具的单点失败（某 URL/查询不可用）不应展示「联网有些问题」 */
const TOOL_FETCH_FAILURE_PATTERN =
  /(?:web_fetch|fetch_page_images|fetch_media_asset|web search could not complete|could not fetch page|soft failure|no organic results|redirect detected|status 403|status 404|blocked|forbidden)/i;

const NETWORK_SENSITIVE_TOOL_NAMES = new Set([
  "web_search",
  "web_fetch",
  "fetch_page_images",
  // PD-SAAS-FORK P0-4: official candidate download is network-sensitive.
  "fetch_media_asset",
  "websearch",
]);

const RECOVERABLE_ERROR_CODES = new Set([
  "tool_execution_failed",
  "tool_timeout",
  "invalid_tool_input",
  "unsupported_tool",
]);

export const PERMISSION_ERROR_CODES = new Set([
  "permission_denied",
  "permission_required",
  "permission_cancelled",
]);

export type NoticeSeverity = "handling" | "pause" | "permission";

export type UserFacingErrorLabels = {
  unifiedRetry: string;
  /** Unexpected disconnect (WS/gateway) — user may tap continue. */
  networkInterrupt: string;
  networkRetry: string;
  unifiedPause: string;
  unifiedExhausted: string;
  unifiedPermission: string;
  networkTransient: string;
  recoverable: string;
  sessionRecoverable: string;
  sessionFatal: string;
  sessionPause: string;
  handlingWithAttempt: string;
  technicalDetail: string;
  expandDetails: string;
  hintNetwork: string;
  hintModel: string;
  hintPermission: string;
  hintContinue: string;
  hintStuck: string;
};

export function isProviderArrearageMessage(text: string): boolean {
  return /Arrearage|overdue-payment|account is in good standing|Insufficient Balance|insufficient[_\s-]?quota|余额不足|额度已用完|账户.*欠费|欠费/i.test(String(text ?? ""));
}

export const DEFAULT_ERROR_LABELS_ZH: UserFacingErrorLabels = {
  unifiedRetry: "可能需要些时间，请稍后",
  networkInterrupt: "网络中断，您可以继续",
  networkRetry: "可能需要些时间，请稍后",
  unifiedPause: "可能需要些时间，请稍后",
  unifiedExhausted: "您可以继续",
  unifiedPermission: "需要确认一项权限",
  networkTransient: "网络中断，您可以继续",
  recoverable: "可能需要些时间，请稍后",
  sessionRecoverable: "可能需要些时间，请稍后",
  sessionFatal: "您可以继续",
  sessionPause: "可能需要些时间，请稍后",
  handlingWithAttempt: "可能需要些时间，请稍后",
  technicalDetail: "技术详情",
  expandDetails: "查看详情",
  hintNetwork: "",
  hintModel: "",
  hintPermission: "需要授权后才能继续",
  hintContinue: "您可点击继续，我会换种方式再试",
  hintStuck: "您可点击继续，我会换种方式再试",
};

export const DEFAULT_ERROR_LABELS_EN: UserFacingErrorLabels = {
  unifiedRetry: "This may take a moment — please wait",
  networkInterrupt: "Connection interrupted — you can continue",
  networkRetry: "This may take a moment — please wait",
  unifiedPause: "This may take a moment — please wait",
  unifiedExhausted: "Could not finish automatically — you can continue",
  unifiedPermission: "Permission needed",
  networkTransient: "Connection interrupted — you can continue",
  recoverable: "This may take a moment — please wait",
  sessionRecoverable: "This may take a moment — please wait",
  sessionFatal: "Could not finish automatically — you can continue",
  sessionPause: "This may take a moment — please wait",
  handlingWithAttempt: "This may take a moment — please wait",
  technicalDetail: "Technical details",
  expandDetails: "Details",
  hintNetwork: "",
  hintModel: "",
  hintPermission: "Grant permission to continue",
  hintContinue: "Tap continue and I will try another approach",
  hintStuck: "Tap continue and I will try another approach",
};

export const DEFAULT_MAX_RECOVERY_ATTEMPTS = 8;

/** Truncated restart/apology bubbles after a failed stream — superseded by process UI / final reply. */
const TRANSIENT_PARTIAL_RESTART_PATTERNS = [
  /抱歉刚才/,
  /刚才的(?:回复|输出|回答)?(?:被)?(?:截断|中断|失败)/,
  /上一条(?:回复|输出|回答).{0,12}(?:截断|中断|失败|不完整)/,
  /我需要重新开始/,
  /只输出了部分/,
  /不要输出任何多余内容/,
  /(?:让我|我来)重新(?:开始|写|做)/,
  /(?:was|got)\s+(?:cut\s+off|truncated|interrupted)/i,
  /(?:need|have)\s+to\s+start\s+(?:over|again)/i,
  /only\s+(?:output|wrote|partially)/i,
  /sorry.*(?:just now|earlier|previous)/i,
];

export function isTransientPartialRestartNarration(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return TRANSIENT_PARTIAL_RESTART_PATTERNS.some((re) => re.test(trimmed));
}

/** Max grapheme length for a lone quantifier / connector fragment (e.g. 「两个」). */
const DEGENERATE_FRAGMENT_MAX_CHARS = 14;

const DEGENERATE_EXACT_FRAGMENTS = new Set([
  "两个", "三个", "四个", "五个", "六个", "七个", "八个",
  "接下来", "然后", "现在", "首先", "其次", "最后", "另外", "同时", "以及", "还有", "并且",
  "two", "three", "four", "next", "then", "now", "first", "also", "and", "but", "so",
]);

/**
 * Short assistant prose that must never appear as its own user-visible bubble
 * (streaming tail, thinking leak, truncated mid-sentence).
 */
export function isDegenerateUserVisibleAssistantFragment(text: string): boolean {
  if (!text || typeof text !== "string") return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (isTransientPartialRestartNarration(trimmed)) return true;
  if (isAgentRecoveryBoilerplate(trimmed)) return true;
  if (isAssistantGiveUpStopBubble(trimmed)) return true;

  const plain = trimmed
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/[*_#>\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return true;

  const normalized = plain.replace(/[。.!！?？,，]+$/g, "");
  if (DEGENERATE_EXACT_FRAGMENTS.has(plain) || DEGENERATE_EXACT_FRAGMENTS.has(normalized)) {
    return true;
  }

  const charCount = [...plain].length;
  if (/^[一二三四五六七八九十两\d]+个[。.!！?？,，]*$/.test(plain)) return true;
  if (/^[一二三四五六七八九十两\d]+[。.!！?？,，]*$/.test(plain) && charCount <= 4) return true;

  const hasTerminalPunct = /[.!?。！？?]$/.test(plain);
  const hasNumberedList = /^\d+[.、)]/.test(plain) || /\n\s*\d+[.、)]/.test(trimmed);
  const wordCount = plain.split(/\s+/).filter(Boolean).length;

  if (hasTerminalPunct && (wordCount >= 3 || charCount >= 18)) {
    return false;
  }
  if (hasNumberedList || charCount > DEGENERATE_FRAGMENT_MAX_CHARS) {
    return false;
  }

  const looksLikeTaskAck = /^(?:好的|收到|明白|OK[,.\s!]?|Got it)/i.test(plain);
  if (looksLikeTaskAck && charCount >= 4) {
    return false;
  }

  if (charCount <= 8) {
    if (hasTerminalPunct && wordCount >= 1) return false;
    return true;
  }

  if (charCount <= DEGENERATE_FRAGMENT_MAX_CHARS && !hasTerminalPunct) {
    if (/^(?:我|现在|接下来|然后|that|now|next|so|and|but|let me|i need|i will)\b/i.test(plain)) {
      return true;
    }
    return true;
  }

  return false;
}

const AGENT_RECOVERY_BOILERPLATE_PATTERNS = [
  /several tools failed/i,
  /stop retrying the same approach/i,
  /failed tools:/i,
  /连续.*工具.*失败/,
  /不要重复同一错误路径/,
  /失败工具[:：]/,
  /do not use web_search/i,
  /不要用 web_search/i,
  /deliver the html/i,
  /给出 HTML 文件路径/,
  /\brecovery:\s*try\b/i,
  /^恢复：/m,
  /for product\/landing pages with official images/i,
  /带官方图的产品\/落地页/,
  /不要向用户索要「继续」/,
  /Do not ask the user to type continue/i,
  /上一段任务因工具失败、信息获取受阻或提前停下而中断/,
  /The last stretch failed or stopped early/i,
  /previous multiple attempts were missing .*old_string/i,
  /missing the old_string parameter/i,
  /required for the edit_file tool/i,
  /Large file repair stopped/i,
  /Large file repair failed/i,
  /Repeated invalid tool input after recovery attempts/i,
  // PD-SAAS-FORK: no-progress read-loop nudge (synthetic user). Phrases are unique to the
  // nudge so the gentle user-visible "stop note" (assistant) is NOT filtered.
  /请立即停止重复读取/,
  /Stop re-reading now/i,
  /^(?:session_prepare|plugin_refresh|mcp_ready|memory_retrieve|router_judge|stage_hint)$/i,
];

export function isAgentRecoveryBoilerplate(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return AGENT_RECOVERY_BOILERPLATE_PATTERNS.some((re) => re.test(trimmed));
}

/** Hide internal recovery injections from user-visible transcript/UI. */
export function shouldHideRecoveryBubble(text: string): boolean {
  return isAgentRecoveryBoilerplate(text);
}

export function stripRecoverySection(text: string): string {
  if (!text) return "";
  let out = text;
  for (const marker of ["\n\nRecovery:", "\n\n恢复："]) {
    const idx = out.indexOf(marker);
    if (idx >= 0) out = out.slice(0, idx);
  }
  if (isAgentRecoveryBoilerplate(out)) return "";
  return out.trim();
}

export function stripAgentRecoveryBoilerplateLines(text: string): string {
  if (!text) return "";
  return stripUserFacingRecoveryCopyLines(
    String(text)
      .split(/\r?\n/)
      .filter((line) => !isAgentRecoveryBoilerplate(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

/** User-visible recovery UX copy — must not persist in assistant bubbles. */
const USER_FACING_RECOVERY_LINE_PATTERNS = [
  /^可能需要些时间，请稍后[.!。！…]*$/u,
  /^您可以继续[.!。！…]*$/u,
  /^暂时未能自动完成[，,]?\s*您可以继续[.!。！…]*$/u,
  /^网络中断，您可以继续[.!。！…]*$/u,
  /^您可以点击[「"']继续这一步[」"']，我会换种方式再试[.!。！…]*$/u,
  /^您可点击继续，我会换种方式再试[.!。！…]*$/u,
  /^This may take a moment — please wait[.!…]*$/i,
  /^Could not finish automatically — you can continue[.!…]*$/i,
  /^Connection interrupted — you can continue[.!…]*$/i,
  /^Tap "Continue this step" and I will try another approach[.!…]*$/i,
  /^请(?:您|你)?(?:回复|输入|发送|敲|打)?[「"']?继续[」"']?[.!。！…]*$/u,
  /^您可点击继续，我会换种方式再试[.!。！…]*$/u,
];

export function isUserFacingRecoveryCopyLine(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  return USER_FACING_RECOVERY_LINE_PATTERNS.some((re) => re.test(trimmed));
}

export function stripUserFacingRecoveryCopyLines(text: string): string {
  if (!text) return "";
  return String(text)
    .split(/\r?\n/)
    .filter((line) => !isUserFacingRecoveryCopyLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type RecoveryExhaustedCategory = "network" | "model" | "tool" | "stuck" | "unknown";

export function classifyRecoveryExhaustedCategory(
  code?: string,
  raw?: string,
): RecoveryExhaustedCategory {
  const text = String(raw ?? "");
  if (isPermissionErrorCode(code) || looksLikePermissionContent(text)) {
    return "unknown";
  }
  if (isTransientNetworkErrorMessage(text) && !TOOL_FETCH_FAILURE_PATTERN.test(text)) return "network";
  if (code === "agent_model_error" || /model|provider|api key|unauthorized|401|403/i.test(text)) {
    return "model";
  }
  if (code === "agent_tool_error_loop" || isAgentRecoveryBoilerplate(text)) {
    return "stuck";
  }
  if (code?.startsWith("tool_") || code === "agent_tool_error") return "tool";
  return "unknown";
}

const ASSISTANT_ASKS_USER_TO_CONTINUE_PATTERNS = [
  /请(?:您|你)?(?:回复|输入|发送|敲|打)?[「"']?继续[」"']?/,
  /需要您(?:继续|提供|确认|手动)/,
  /请您(?:继续|提供|确认|手动)/,
  /无法继续(?:执行|完成|进行)?/,
  /(?:获取|拿)不到(?:相关)?信息/,
  /未能(?:获取|检索|抓取)/,
  /请手动/,
  /if you want me to continue/i,
  /please (?:reply|type|send|say) ["']?continue["']?/i,
  /please let me know if you (?:want|would like) (?:me )?to continue/i,
  /I cannot (?:proceed|continue|complete)/i,
  /unable to (?:fetch|retrieve|get|access)/i,
  /cannot (?:fetch|retrieve|get|access)/i,
];

/** Multi-step planning in progress — do not auto_continue when strict. */
const PLANNING_IN_PROGRESS_PATTERNS = [
  /\blet me\b/i,
  /接下来/,
  /下一步/,
  /现在(?:获取|创建|编写|整理|开始|继续)/,
  /信息收集(?:完毕|完成).*(?:现在|接下来|然后)/,
  /先读取.*?(?:然后|再|逐个)/,
  /逐个补充/,
  /slide\s*\d+/i,
  /第\s*\d+\s*页/,
  /page\s*\d+/i,
  /I(?:'ll| will) (?:now |next )/i,
  /正在生成/,
  /generating slide/i,
  // PD-SAAS-FORK: Nova 调研搜完即写 — 规划性 narration 仍视为未完成
  /先加载技能/,
  /启动调研/,
  /让我再补充/,
  /整合(?:全部)?(?:调研)?数据/,
  /补充(?:一些|具体).{0,12}(?:细节|信息|品牌|数据)/,
];

export type AutoContinueOptions = {
  strict?: boolean;
  hadRecentToolSuccess?: boolean;
  latestUserText?: string;
  userGoalText?: string;
};

/** User goal implies a file deliverable (PPT/DOC/PDF/HTML artifact). */
const USER_GOAL_DELIVERABLE_PATTERNS = [
  /(?:生成|制作|导出|创建|输出).{0,24}(?:ppt|PPT|pptx|幻灯|演示)/,
  /可编辑的?\s*(?:PPT|pptx|幻灯)/,
  /(?:生成|导出|输出|制作|创建|做).{0,24}(?:docx|word|pdf|报告|html|网页|落地页|官网|网站|页面)/i,
  /(?:输出|生成|保存|交付).{0,12}(?:文件|文档|模板|清单)/,
  /(?:产出|保存|存).{0,24}artifacts\//i,
  /(?:文件路径|报路径|成果路径|交付清单|告诉我.*路径|做完告诉我)/,
  /(?:audience-intelligence|受众洞察|用户画像|人群画像|受众分析|目标人群洞察)/i,
  /(?:主视觉|海报|配图|平台草稿|drafts?)/i,
  /(?:campaign|Campaign|传播|营销).{0,40}(?:全案|brief|Brief|方案)/,
  /(?:竞品对标|竞品.*清单|competitive.*benchmark|Nova-竞品)/i,
  /(?:竞品|流量|舆情).{0,16}(?:调研|分析|挖掘)/i,
  // PD-SAAS-FORK: Hub Nova 试一下「写…报告」句式（动词「写」非「生成」）
  /(?:写|撰写).{0,40}(?:调研报告|研究报告|市场研究报告|行业报告|综合调研)/i,
  /用「Nova-(?:行业市场|通用调研|竞品对标|用户研究|产品用研|学术专业)」/i,
  /(?:市场研究报告|行业市场调研)/i,
  /(?:前端设计规范|设计规范|design\s*spec)/i,
  /(?:GEO|AEO|geo-aeo|pd-geo|optimized\.md|schema\.jsonld|visibility-report|引用评分)/i,
  /(?:社媒矩阵|social-matrix|social-creative|国内社媒|多平台文案|四套比例|小红书.*草稿)/i,
  /(?:写|生成|做|制作).{0,16}(?:视频脚本|口播脚本|分镜脚本|演示脚本|口播讲稿)/i,
  /(?:Seedance|即梦|分镜提示|storyboard prompt|scenedance)/i,
  /(?:连续性分镜包|continuity\s*分镜|分镜包|bible|镜头卡|交接矩阵|handoff)/i,
  /(?:React\s*程序化视频|Remotion|程序化视频|模板化视频|视频模板|批量渲染|render_html_video)/i,
  /(?:TimesFM|时序预测|forecast).{0,40}(?:预测|图表|结果文件|csv|CSV|json|PNG|png|路径)/i,
  /PPT(?:幻灯|演示)?/,
  /(?:humanize|五平台|一文多发|深度长文).{0,80}(?:写入系统分配任务目录|须交付)/i,
  /写入系统分配任务目录/,
  /pptxgenjs|pptx/i,
  // PD-SAAS-FORK a51fa91d: 智能获客/线索表（「整理成…报告」无「生成/输出」动词时也曾漏判）
  /(?:潜在客户|智能获客|获客|线索表|线索清单|leads-report|nova-customer-acquisition|Lead Discovery)/i,
  /(?:整理|汇总|罗列).{0,24}(?:线索|客户).{0,16}(?:表|报告|清单)/,
  /(?:整理成|做成|形成).{0,16}(?:线索表|客户清单).{0,8}报告/,
  // PD-SAAS-FORK 1bde3fb1: 内容飞轮口语（选题→长文→社媒）须编 SDM，勿被附件剥离后漏判
  /(?:内容\s*飞轮|content[-\s]?flywheel|选题\s*[→\->]\s*长文|01-topics\.md|02-longform\.md|03-social-slices\.md)/i,
  // PD-SAAS-FORK 0731: 深度蒸馏须编单槽 SDM
  /深度蒸馏/,
  /蒸馏.{0,40}危机公关方法论|危机公关方法论.{0,40}蒸馏/,
  // PD-SAAS-FORK Showcase OD：Hub 营销文案无「生成…html」动词时仍须编 SDM（成果落袋）
  /(?:定价卡片|Pricing\s*Card|价格(?:卡片|方案)|套餐(?:价格|对比))/i,
  /(?:后台管理)?仪表盘|\bdashboard\b/i,
  /(?:SaaS\s*)?(?:页面组件|UI\s*组件|设计组件)/i,
  /(?:open-design|设计总控)/i,
];

export function userGoalImpliesDeliverable(userText: string): boolean {
  if (!userText || typeof userText !== "string") return false;
  const trimmed = userText.trim();
  if (!trimmed) return false;
  return USER_GOAL_DELIVERABLE_PATTERNS.some((re) => re.test(trimmed));
}

const DIRECT_START_PATTERNS = [
  /直接开始做/,
  /直接执行/,
  /直接开做/,
  /开始执行/,
  /禁止空转/,
  /做完告诉我/,
  /不用问/,
  /不要问/,
  /别问/,
  /无需确认/,
  /无需提问/,
  /just start/i,
  /don't ask/i,
  /do not ask/i,
];

export function userGoalRequestsDirectStart(userText: string): boolean {
  if (!userText || typeof userText !== "string") return false;
  return DIRECT_START_PATTERNS.some((re) => re.test(userText));
}

export function isContinuationOnlyUserText(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  return /^(继续|继续做|接着做|往下做|继续执行|继续完成|continue|go on|resume)$/i.test(trimmed);
}

/** Auto-continue / task-resume injections must never become sidebar session titles. */
export function isSyntheticSessionTitlePrompt(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return true;
  if (isContinuationOnlyUserText(trimmed)) return true;
  if (isAgentRecoveryBoilerplate(trimmed)) return true;
  if (trimmed.startsWith("<task-resume")) return true;
  if (/<task-resume[\s>]/i.test(trimmed)) return true;
  return false;
}

/** User follow-up when a deliverable task stopped early — not a new task definition. */
export function isTaskFollowUpComplaintText(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  if (trimmed.length > 240 && userGoalImpliesDeliverable(trimmed)) return false;
  return /(?:任务(?:没有|还未|没)?完成|什么意思|怎么(?:回事|停了|中断)|为什么没有|成果(?:呢|在哪)|还没做完|连成果都|无操作)/.test(trimmed)
    && !/(?:artifacts\/|social-matrix|社媒矩阵|GEO|pptx|docx|直接开始做)/i.test(trimmed);
}

export function userReportsDeliverableOpenFailure(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  return /(?:交付物|成果|文件|链接|你给的|给我的|视频|网页|HTML|页面).{0,12}(?:打不开|无法打开|不能打开|点不开|打开不了|无法播放|不能播放|播放不了|无法使用|不能用|用不了|白屏|黑屏|文件找不到|路径不对|不存在|404)/i.test(trimmed)
    || /(?:打不开|无法打开|不能打开|点不开|打开不了|无法播放|不能播放|播放不了|无法使用|不能用|用不了|白屏|黑屏).{0,12}(?:交付物|成果|文件|链接|视频|网页|HTML|页面)/i.test(trimmed);
}

function assistantOnlyAskedGenericOpenDiagnostics(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  return /(?:什么类型的文件|在哪种设备|用哪个软件|具体报错截图|错误代码|请.*详细描述|补充.*细节|格式不对|文件损坏)/.test(trimmed)
    || /(?:已完成|路径).*?(?:outline\.md|index\.html).*?(?:视频(?:没了|需|无法|不能|未)|render_html_video|环境未就绪)/is.test(trimmed)
    || /(?:outline\.md|index\.html).*?(?:已完成|路径|视频(?:没了|需|无法|不能|未)|render_html_video|环境未就绪)/is.test(trimmed)
    || /三个文件路径.*?(?:outline\.md|index\.html)/is.test(trimmed);
}

const SETUP_ONLY_STOP_PATTERNS = [
  /npm install/i,
  /(?:is not installed|need to install|install it first)/i,
  /Good\.?\s*Now let me/i,
  /可能需要些时间，请稍后/,
  /我来创建/,
  /现在(?:开始|创建|搭建|生成)/,
  /之前因为.*(?:安装|中断)/,
  /我继续完成/,
  /开始执行/,
  /先确认资料/,
  /逐一推进/,
];

export type IncompleteDeliverableStopOptions = {
  hadRecentToolSuccess?: boolean;
  userGoalText?: string;
};

/**
 * Turn ended with success but user-requested deliverable not present —
 * e.g. model narrates "Now let me write the script" then stops without tools.
 */
export function shouldAutoContinueAfterIncompleteDeliverableStop(
  assistantText: string,
  options?: IncompleteDeliverableStopOptions,
): boolean {
  if (!assistantText || typeof assistantText !== "string") return false;
  const trimmed = assistantText.trim();
  if (!trimmed || isAgentRecoveryBoilerplate(trimmed)) return false;
  if (looksLikeTaskDelivered(trimmed)) return false;

  const userGoal = options?.userGoalText ?? "";
  if (isBareTransientNetworkErrorBody(trimmed)) {
    return userGoalImpliesDeliverable(userGoal);
  }
  if (!userGoalImpliesDeliverable(userGoal)) return false;

  const mentionsArtifactFile = hasReliableDeliveredPath(trimmed);
  const claimsDone = /(?:已完成|已生成|已保存|交付|请查收|done|delivered)/i.test(trimmed);
  if (mentionsArtifactFile && claimsDone) return false;
  if (claimsDone && hasUnreliableDeliveredFileMention(trimmed)) return true;

  const planning = PLANNING_IN_PROGRESS_PATTERNS.some((re) => re.test(trimmed));
  const setupOnly = SETUP_ONLY_STOP_PATTERNS.some((re) => re.test(trimmed));
  if (planning || setupOnly) return true;

  // Ran tools (install/read) but never produced the requested file type
  if (options?.hadRecentToolSuccess) {
    const userWantsPpt = /(?:ppt|PPT|pptx|幻灯)/i.test(userGoal);
    const hasPptxInText = /\.pptx\b/i.test(trimmed);
    if (userWantsPpt && !hasPptxInText) return true;

    // PD-SAAS-FORK: research / report goals after web_search without write_file
    const hasReportArtifact = /\.(?:md|docx|pdf|markdown)\b/i.test(trimmed)
      || /artifacts\/(?:research|reports)/i.test(trimmed);
    const userWantsReport = /(?:报告|调研|对标|Nova-)/i.test(userGoal);
    if (userWantsReport && !hasReportArtifact) return true;
  }

  return false;
}

/** 助手是否因信息缺失而提前停下并让用户手动继续 */
export function shouldAutoContinueAfterAssistantText(
  text: string,
  options?: AutoContinueOptions,
): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed || isAgentRecoveryBoilerplate(trimmed)) return false;
  if (
    userReportsDeliverableOpenFailure(options?.latestUserText ?? "")
    && assistantOnlyAskedGenericOpenDiagnostics(trimmed)
    && userGoalImpliesDeliverable(options?.userGoalText ?? "")
  ) {
    return true;
  }
  if (looksLikeTaskDelivered(trimmed)) return false;
  if (options?.strict) {
    if (options.hadRecentToolSuccess) return false;
    if (PLANNING_IN_PROGRESS_PATTERNS.some((re) => re.test(trimmed))) return false;
  }
  // PD-SAAS-FORK: after successful tools, planning narration is progress — not premature stop
  if (options?.hadRecentToolSuccess && PLANNING_IN_PROGRESS_PATTERNS.some((re) => re.test(trimmed))) {
    return false;
  }
  return ASSISTANT_ASKS_USER_TO_CONTINUE_PATTERNS.some((re) => re.test(trimmed));
}

/** Assistant-only “请您继续” stop bubble — hide when engine will auto-continue. */
export function isAssistantGiveUpStopBubble(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed || isAgentRecoveryBoilerplate(trimmed)) return false;
  if (looksLikeTaskDelivered(trimmed)) return false;
  if (PLANNING_IN_PROGRESS_PATTERNS.some((re) => re.test(trimmed))) return false;
  return ASSISTANT_ASKS_USER_TO_CONTINUE_PATTERNS.some((re) => re.test(trimmed));
}

/** 助手回复是否已包含可交付成果路径 */
export type LooksLikeTaskDeliveredOptions = {
  userGoal?: string;
  capabilitySlug?: string;
};

export function looksLikeTaskDelivered(
  text: string,
  options?: LooksLikeTaskDeliveredOptions,
): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const hasPath = hasReliableDeliveredPath(trimmed)
    || /(?<![\/\w.-])[\w.-]+\.(?:html|md|pdf|docx|pptx|xlsx|csv|png|jpe?g|mp4|webm)\b/i.test(trimmed);
  const hasDone = /(?:已完成|已生成|已保存|交付|请查收|路径如下|done|delivered|saved at)/i.test(trimmed);
  if (!hasPath || !hasDone) return false;

  const goal = String(options?.userGoal ?? "").trim();
  if (goal) {
    const contract = buildTaskGoalContract({
      userGoal: goal,
      capabilitySlug: options?.capabilitySlug,
    });
    if (contract.expectedKinds.includes("video")) {
      return /\.(?:mp4|webm)\b/i.test(trimmed);
    }
  }
  return true;
}

function hasReliableDeliveredPath(text: string): boolean {
  if (/(?:artifacts\/|write_file|saved to|file path)/i.test(text)) return true;
  const filePathPattern = /(?:^|[\s`"'(（])((?!\/[^/\s`"'()<>]+\.(?:html|md|pdf|docx|pptx|xlsx|csv|png|jpe?g)\b)[\w.-]+\/[\w./-]+\.(?:html|md|pdf|docx|pptx|xlsx|csv|png|jpe?g))\b/i;
  return filePathPattern.test(text);
}

function hasUnreliableDeliveredFileMention(text: string): boolean {
  return /(?:^|[\s`"'(（])\/[^/\s`"'()<>]+\.(?:html|md|pdf|docx|pptx|xlsx|csv|png|jpe?g)\b/i.test(text)
    || /(?:^|[\s`"'(（])[\w.-]+\.(?:html|md|pdf|docx|pptx|xlsx|csv|png|jpe?g)\b/i.test(text);
}

export type TurnCompleteOutcome = {
  exitCode?: number;
  aborted?: boolean;
  userAborted?: boolean;
  success?: boolean;
  assistantText?: string;
  userGoalText?: string;
  /** PD-SAAS-FORK: gateway error code when turn ended in hard failure. */
  errorCode?: string;
  /** PD-SAAS-FORK: false = do not UI auto-continue (model/auth/quota hard stop). */
  errorRecoverable?: boolean;
};

/** 轮次是否为不可自动续跑的硬失败（模型欠费/鉴权等） */
export function isHardTurnCompleteStop(outcome?: TurnCompleteOutcome | null): boolean {
  if (!outcome) return false;
  if (outcome.errorRecoverable === false) return true;
  if (outcome.errorCode === "agent_model_error") return true;
  return false;
}

/** 轮次结束是否应触发自动续跑（失败 turn，非用户中止） */
export function shouldAutoContinueAfterTurnOutcome(outcome: TurnCompleteOutcome): boolean {
  if (isHardTurnCompleteStop(outcome)) return false;
  if (outcome.aborted) {
    if (outcome.userAborted) return false;
    const userGoal = outcome.userGoalText ?? "";
    if (!userGoalImpliesDeliverable(userGoal)) {
      return false;
    }
    const assistantText = outcome.assistantText ?? "";
    return !looksLikeTaskDelivered(assistantText, { userGoal: userGoal });
  }
  if (outcome.exitCode !== undefined && outcome.exitCode !== 0) return true;
  if (outcome.success === false) return true;
  return false;
}

/** User message when UI/engine auto-continues after a stale/hung tool step. */
export function buildStaleTurnFallbackContinueMessage(
  locale: "zh" | "en" = "zh",
  stuckStep?: string,
): string {
  const base = buildAutoRecoveryContinueMessage(locale);
  const stepNote = stuckStep
    ? (locale === "en"
      ? ` Stalled step (skipped or timed out): ${stuckStep}. Use fallback sources; results may differ slightly.`
      : ` 卡住并已跳过的步骤：${stuckStep}。请改读已知 artifacts/ 或占位继续，结果可能略有偏差。`)
    : (locale === "en"
      ? " A tool step hung too long; skip it and use fallback paths."
      : " 某工具步骤耗时过长，请跳过并改走备选路径。");
  return `${base}${stepNote}`;
}

/** User message sent when UI/engine auto-continues after recovery exhaustion or premature stop. */
export function buildAutoRecoveryContinueMessage(
  locale: "zh" | "en" = "zh",
): string {
  if (locale === "en") {
    return [
      "The last stretch failed or stopped early.",
      "Do not ask the user to type continue.",
      "Briefly analyze what went wrong, switch to another viable approach,",
      "and finish any undelivered work now (alternate sources, placeholders, or existing files).",
    ].join(" ");
  }
  return [
    "上一段任务因工具失败、信息获取受阻或提前停下而中断。",
    "不要向用户索要「继续」或让用户手动重试。",
    "请先简要分析原因，立即换可行方案（换来源、占位图、已有本地文件等）",
    "完成尚未交付的部分。",
  ].join("");
}

/** Synthetic user turn after LargeFileRepair exhausts but partial files exist. */
export function buildLargeFilePartialContinuePrompt(
  locale: "zh" | "en",
  writtenPaths: string[],
  missingBasenames?: string[],
): { role: "user"; content: [{ type: "text"; text: string }]; metadata: CanonicalMessageMetadata } {
  const paths = writtenPaths.length > 0 ? writtenPaths.join("、") : "（已有部分文件）";
  const missing = missingBasenames?.length
    ? (locale === "en"
      ? ` Still missing: ${missingBasenames.join(", ")}.`
      : ` 仍缺：${missingBasenames.join("、")}。`)
    : "";
  const text = locale === "en"
    ? [
      "Large-content write hit limits but some files already exist.",
      `Known paths: ${paths}.${missing}`,
      "Do not restart from scratch. Use read_file + edit_file to append ONE section at a time (under 60 lines).",
      "Finish undelivered files and report all artifact paths.",
    ].join(" ")
    : [
      "大文件分段写入已达本轮上限，但工作区已有部分成果。",
      `已有文件：${paths}。${missing}`,
      "不要从头重写。请 read_file 后用 edit_file 每次只追加一小段（不超过 60 行）。",
      "补齐尚未交付的文件并在正文列出全部 artifacts 路径。",
    ].join("");
  return {
    role: "user",
    content: [{ type: "text", text }],
    metadata: { synthetic: true, purpose: "large_file_partial_continue" },
  };
}

/** Synthetic user turn when tool calls keep returning empty/invalid input during file repair. */
export function buildInvalidToolInputRecoveryPrompt(
  locale: "zh" | "en",
): { role: "user"; content: [{ type: "text"; text: string }]; metadata: CanonicalMessageMetadata } {
  const text = locale === "en"
    ? "Tool calls failed because required parameters were missing. Call write_file with BOTH file_path and content (short skeleton), or read_file with file_path, then edit_file with old_string and new_string. Continue the deliverable incrementally."
    : "工具调用因缺少必填参数失败。write_file 必须同时提供 file_path 与 content（先写短骨架）；read_file 必须提供 file_path；edit_file 必须提供 old_string 与 new_string。请分段继续完成交付。";
  return {
    role: "user",
    content: [{ type: "text", text }],
    metadata: { synthetic: true, purpose: "invalid_tool_input_recovery" },
  };
}

/** 引擎侧：助手无工具调用但提前停下时的合成续跑指令 */
export function buildPrematureStopRecoveryUserMessage(
  locale: "zh" | "en" = "zh",
  reason: "assistant_gave_up" | "soft_fetch_failure" = "assistant_gave_up",
): { role: "user"; content: [{ type: "text"; text: string }]; metadata: CanonicalMessageMetadata } {
  const base = buildAutoRecoveryContinueMessage(locale);
  const extra = reason === "soft_fetch_failure"
    ? (locale === "en"
      ? " Recent web_fetch/web_search/fetch_page_images calls returned no usable data."
      : " 最近的联网抓取未拿到可用内容。")
    : "";
  return {
    role: "user",
    content: [{ type: "text", text: `${base}${extra}` }],
    metadata: { synthetic: true, purpose: "auto_continue" },
  };
}

export function buildRecoveryExhaustedGuide(
  _category: RecoveryExhaustedCategory,
  labels: UserFacingErrorLabels = DEFAULT_ERROR_LABELS_ZH,
  options?: { autoContinue?: boolean; raw?: string },
): { summary: string; steps: string[] } {
  if (options?.autoContinue) {
    return {
      summary: labels.unifiedRetry,
      steps: [],
    };
  }
  const arrearage = isProviderArrearageMessage(options?.raw ?? "");
  const steps: string[] = arrearage
    ? [
        localeIsZh(labels)
          ? "当前模型账户余额不足，请充值或在设置里换用其他模型"
          : "This model account is out of credit — recharge or switch models in Settings",
      ]
    : [
        localeIsZh(labels)
          ? "您可以点击「继续这一步」，我会换种方式再试"
          : "Tap \"Continue this step\" and I will try another approach",
      ];
  return {
    summary: labels.unifiedExhausted,
    steps: steps.filter(Boolean),
  };
}

function localeIsZh(labels: UserFacingErrorLabels): boolean {
  return /[\u4e00-\u9fff]/.test(labels.unifiedRetry)
    || /[\u4e00-\u9fff]/.test(labels.hintContinue);
}

/** Dev stack / gateway drop / local proxy fake-ip — not end-user “check your Wi‑Fi”. */
const INFRA_DISCONNECT_PATTERN =
  /econnreset|econnrefused|websocket|ws proxy|gateway.*disconnect|code=1006|aborted_streaming|und_err_socket|other side closed|198\.18\.\d+\.\d+/i;

export function isInfrastructureDisconnectMessage(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return INFRA_DISCONNECT_PATTERN.test(text);
}

export function isTransientNetworkErrorMessage(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  if (isInfrastructureDisconnectMessage(text)) return false;
  return TRANSIENT_NETWORK_PATTERN.test(text);
}

const BARE_TRANSIENT_NETWORK_LINE =
  /^(?:fetch failed|failed to fetch|network error|econnreset|etimedout|socket hang up|econnrefused)[.!?…]*$/i;

const BARE_TRANSIENT_NOISE_LINE = /^[?？!！。.…\s]+$/;

/** User-visible text that is only a raw network failure with no actionable context. */
export function isBareTransientNetworkErrorLeak(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || trimmed.length > 120) return false;
  return BARE_TRANSIENT_NETWORK_LINE.test(trimmed);
}

/**
 * Assistant body that is only bare transient network failures (possibly repeated lines)
 * or punctuation noise — must never end a deliverable turn as the user-visible outcome.
 */
export function isBareTransientNetworkErrorBody(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || trimmed.length > 480) return false;
  if (isBareTransientNetworkErrorLeak(trimmed)) return true;
  const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  return lines.every(
    (line) => isBareTransientNetworkErrorLeak(line) || BARE_TRANSIENT_NOISE_LINE.test(line),
  );
}

/** Engine/tool hard-stop messages that must not appear as user-facing bubbles. */
export function isEngineToolHardStopLeak(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || trimmed.length > 280) return false;
  return /^(?:Large file repair (?:stopped|failed)|Repeated invalid tool input after recovery attempts)/i.test(trimmed);
}

/** 是否向用户展示「联网有些问题」（区别于 web_search 正常、web_fetch 单页失败） */
export function shouldShowNetworkRetryLabel(text: string, toolName?: string): boolean {
  if (isInfrastructureDisconnectMessage(text)) return false;
  if (!isTransientNetworkErrorMessage(text)) return false;
  const normalizedTool = (toolName ?? "").trim().toLowerCase();
  if (normalizedTool && NETWORK_SENSITIVE_TOOL_NAMES.has(normalizedTool)) {
    return false;
  }
  if (TOOL_FETCH_FAILURE_PATTERN.test(text)) {
    return false;
  }
  return true;
}

export function isPermissionErrorCode(code: string | undefined): boolean {
  return !!code && PERMISSION_ERROR_CODES.has(code);
}

function looksLikePermissionContent(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("permission") &&
    (lower.includes("denied") ||
      lower.includes("not allowed") ||
      lower.includes("requires") ||
      lower.includes("grant"))
  );
}

export function isRecoverableToolError(params: {
  errorCode?: string;
  rawContent?: unknown;
}): boolean {
  const text = stringifyContent(params.rawContent);
  if (params.errorCode && PERMISSION_ERROR_CODES.has(params.errorCode)) {
    return false;
  }
  if (looksLikePermissionContent(text)) {
    return false;
  }
  if (text.includes("<tool_use_error>") && !looksLikePermissionContent(text)) {
    return true;
  }
  if (params.errorCode && RECOVERABLE_ERROR_CODES.has(params.errorCode)) {
    return true;
  }
  return isTransientNetworkErrorMessage(text);
}

function shortenToolErrorForUser(text: string): string | null {
  if (!text) return null;
  if (isAgentRecoveryBoilerplate(text)) return null;
  const lower = text.toLowerCase();
  if (lower.includes("read_file") || lower.includes("read file")) {
    return "读取文件未成功";
  }
  if (lower.includes("write_file") || lower.includes("write file")) {
    return "写入文件未成功";
  }
  if (lower.includes("web_fetch") || lower.includes("fetch failed")) {
    return "页面获取未成功";
  }
  if (lower.includes("fetch_page_images")) {
    return "页面图片抓取未成功";
  }
  if (text.length > 200) return null;
  if (/^[a-z0-9_.\-:]+$/i.test(text.replace(/\s/g, ""))) return null;
  return text;
}

export function getTechnicalToolErrorDetail(rawContent: unknown): string | null {
  const text = stripRecoverySection(
    stringifyContent(rawContent)
      .replace(/<\/?tool_use_error>/g, "")
      .replace(/^InputValidationError:\s*/i, "")
      .trim(),
  );
  if (!text) return null;
  if (isAgentRecoveryBoilerplate(text)) return shortenToolErrorForUser(text);
  const shortened = shortenToolErrorForUser(text);
  if (shortened !== null) return shortened;
  if (text.length > 240) return null;
  return text;
}

export function buildExpandDetail(
  hints: string[],
  technicalDetail?: string | null,
): string | null {
  const parts: string[] = [];
  if (technicalDetail?.trim()) parts.push(technicalDetail.trim());
  const extraHints = hints.filter(Boolean);
  if (extraHints.length > 0) {
    parts.push(extraHints.join("\n"));
  }
  return parts.length > 0 ? parts.join("\n\n") : null;
}

function resolveRetrySummary(
  raw: string,
  labels: UserFacingErrorLabels,
  _toolName?: string,
): string {
  if (isInfrastructureDisconnectMessage(raw)) {
    return labels.networkInterrupt;
  }
  return labels.unifiedRetry;
}

export function formatUserFacingToolError(
  params: {
    toolName?: string;
    errorCode?: string;
    rawContent?: unknown;
  },
  labels: UserFacingErrorLabels = DEFAULT_ERROR_LABELS_ZH,
): {
  summary: string;
  technicalDetail: string | null;
  recoverable: boolean;
  severity: NoticeSeverity;
} {
  const rawText = stringifyContent(params.rawContent);
  const technicalDetail = getTechnicalToolErrorDetail(params.rawContent);
  const showDetail = !!technicalDetail && !isAgentRecoveryBoilerplate(rawText);

  if (isPermissionErrorCode(params.errorCode) || looksLikePermissionContent(rawText)) {
    return {
      summary: labels.unifiedPermission,
      technicalDetail: showDetail ? technicalDetail : null,
      recoverable: false,
      severity: "permission",
    };
  }

  const recoverable = isRecoverableToolError({
    errorCode: params.errorCode,
    rawContent: params.rawContent,
  });

  if (!recoverable) {
    return {
      summary: labels.unifiedPause,
      technicalDetail: showDetail ? technicalDetail : null,
      recoverable: false,
      severity: "pause",
    };
  }

  return {
    summary: resolveRetrySummary(rawText, labels, params.toolName),
    technicalDetail: showDetail ? technicalDetail : null,
    recoverable: true,
    severity: "handling",
  };
}

export type UserFacingNotice = {
  summary: string;
  severity: NoticeSeverity;
  hints: string[];
  showTechnicalDetail: boolean;
  recoverable: boolean;
  attempt?: number;
  maxAttempts?: number;
  technicalDetail?: string | null;
};

export function getErrorHints(
  code: string | undefined,
  raw: string,
  labels: UserFacingErrorLabels = DEFAULT_ERROR_LABELS_ZH,
  options?: { suppressActionableHints?: boolean },
): string[] {
  const hints: string[] = [];
  if (isPermissionErrorCode(code) || looksLikePermissionContent(raw)) {
    hints.push(labels.hintPermission);
  } else if (isProviderArrearageMessage(raw)) {
    hints.push(
      localeIsZh(labels)
        ? "当前模型账户余额不足，请充值或在设置里换用其他模型"
        : "This model account is out of credit — recharge or switch models in Settings",
    );
  } else if (code === "agent_tool_error_loop" && !options?.suppressActionableHints) {
    hints.push(labels.hintStuck);
  }
  if (labels.hintContinue && !options?.suppressActionableHints) {
    hints.push(labels.hintContinue);
  }
  return hints.filter(Boolean);
}

export function formatHandlingNotice(
  _attempt: number,
  _maxAttempts: number,
  labels: UserFacingErrorLabels = DEFAULT_ERROR_LABELS_ZH,
): UserFacingNotice {
  return {
    summary: labels.unifiedRetry,
    severity: "handling",
    hints: [],
    showTechnicalDetail: false,
    recoverable: true,
  };
}

export type FormatUserFacingNoticeOptions = {
  autoContinueEnabled?: boolean;
  suppressActionableHints?: boolean;
};

export function formatUserFacingNotice(
  params: {
    code?: string;
    raw?: string;
    recoverable?: boolean;
    attempt?: number;
    maxAttempts?: number;
    exhausted?: boolean;
  },
  labels: UserFacingErrorLabels = DEFAULT_ERROR_LABELS_ZH,
  options?: FormatUserFacingNoticeOptions,
): UserFacingNotice {
  const suppressHints = options?.suppressActionableHints === true || options?.autoContinueEnabled === true;
  const hintOptions = suppressHints ? { suppressActionableHints: true } : undefined;
  const rawFull = String(params.raw ?? "").trim();
  const raw = stripRecoverySection(rawFull);
  const code = params.code;
  const maxAttempts = params.maxAttempts ?? DEFAULT_MAX_RECOVERY_ATTEMPTS;
  if (isSessionBusyInternalError(code, rawFull)) {
    return {
      summary: labels.unifiedRetry,
      severity: "handling",
      hints: [],
      showTechnicalDetail: false,
      recoverable: true,
      technicalDetail: null,
    };
  }
  if (isBareTransientNetworkErrorBody(rawFull)) {
    return {
      summary: labels.unifiedRetry,
      severity: "handling",
      hints: [],
      showTechnicalDetail: false,
      recoverable: true,
      technicalDetail: null,
    };
  }
  if (isEngineToolHardStopLeak(rawFull) && !params.exhausted) {
    return {
      summary: labels.unifiedRetry,
      severity: "handling",
      hints: [],
      showTechnicalDetail: false,
      recoverable: true,
      technicalDetail: null,
    };
  }
  const userDetail = getTechnicalToolErrorDetail(rawFull) || (raw && !isAgentRecoveryBoilerplate(rawFull) ? raw : null);
  const showTechnicalDetail = !!userDetail && !isAgentRecoveryBoilerplate(rawFull);

  if (params.attempt !== undefined && params.attempt < maxAttempts && !params.exhausted) {
    const summary = resolveRetrySummary(rawFull, labels);
    return {
      summary,
      severity: "handling",
      hints: [],
      showTechnicalDetail: false,
      recoverable: true,
      technicalDetail: null,
    };
  }

  if (isPermissionErrorCode(code) || looksLikePermissionContent(rawFull)) {
    return {
      summary: labels.unifiedPermission,
      severity: "permission",
      hints: [],
      showTechnicalDetail,
      recoverable: false,
      technicalDetail: userDetail,
    };
  }

  if (params.exhausted || code === "agent_tool_error_loop") {
    const category = classifyRecoveryExhaustedCategory(code, rawFull);
    if (isProviderArrearageMessage(rawFull)) {
      return {
        summary: localeIsZh(labels)
          ? "当前模型余额不足，请换模型或充值"
          : "This model is out of credit — switch models or recharge",
        severity: "pause",
        hints: getErrorHints(code, rawFull, labels, hintOptions),
        showTechnicalDetail: false,
        recoverable: false,
        attempt: params.attempt,
        maxAttempts,
        technicalDetail: null,
      };
    }
    if (suppressHints) {
      return {
        summary: labels.unifiedRetry,
        severity: suppressHints ? "handling" : "pause",
        hints: [],
        showTechnicalDetail: false,
        recoverable: !suppressHints,
        attempt: params.attempt,
        maxAttempts,
        technicalDetail: null,
      };
    }
    if (isEngineToolHardStopLeak(rawFull)) {
      const guide = buildRecoveryExhaustedGuide(category, labels, { raw: rawFull, autoContinue: options?.autoContinueEnabled });
      return {
        summary: labels.unifiedExhausted,
        severity: "pause",
        hints: guide.steps.length > 0 ? guide.steps : getErrorHints(code, rawFull, labels, hintOptions),
        showTechnicalDetail: false,
        recoverable: false,
        attempt: params.attempt,
        maxAttempts,
        technicalDetail: null,
      };
    }
    const guide = buildRecoveryExhaustedGuide(category, labels, { raw: rawFull, autoContinue: options?.autoContinueEnabled });
    const summary = isInfrastructureDisconnectMessage(rawFull)
      ? labels.networkInterrupt
      : guide.summary;
    return {
      summary,
      severity: "pause",
      hints: guide.steps.length > 0 ? guide.steps : getErrorHints(code, rawFull, labels, hintOptions),
      showTechnicalDetail,
      recoverable: false,
      attempt: params.attempt,
      maxAttempts,
      technicalDetail: userDetail,
    };
  }

  const recoverable =
    params.recoverable === true ||
    code === "agent_max_turns_reached";

  if (recoverable && !params.exhausted) {
    const summary = isInfrastructureDisconnectMessage(rawFull)
      ? labels.unifiedRetry
      : resolveRetrySummary(rawFull, labels);
    return {
      summary,
      severity: "handling",
      hints: [],
      showTechnicalDetail: false,
      recoverable: true,
      technicalDetail: null,
    };
  }

  const summary = isInfrastructureDisconnectMessage(rawFull)
    ? labels.networkInterrupt
    : labels.unifiedPause;

  return {
    summary,
    severity: "pause",
    hints: getErrorHints(code, rawFull, labels),
    showTechnicalDetail,
    recoverable: false,
    attempt: params.attempt,
    maxAttempts,
    technicalDetail: userDetail,
  };
}

export function isSessionBusyInternalError(code?: string, raw?: string): boolean {
  return String(code ?? "").toLowerCase() === "session_busy"
    || /already has an active turn/i.test(String(raw ?? ""));
}

export function formatUserFacingSessionError(
  content: string,
  code?: string,
  recoverable?: boolean,
  labels: UserFacingErrorLabels = DEFAULT_ERROR_LABELS_ZH,
): string {
  return formatUserFacingNotice({ code, raw: content, recoverable }, labels).summary;
}

/** Map raw technical errors to user-safe copy (never leak fetch failed / Failed to fetch). */
export function sanitizeUserVisibleErrorText(
  raw: string,
  labels: UserFacingErrorLabels = DEFAULT_ERROR_LABELS_ZH,
): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return labels.unifiedRetry;
  return formatUserFacingNotice(
    { raw: trimmed, recoverable: true, exhausted: false },
    labels,
  ).summary;
}

/** True when an error bubble / load banner should be hidden entirely (engine auto-resumes). */
export function shouldHideBareUserVisibleError(raw: string): boolean {
  return isBareTransientNetworkErrorBody(raw);
}

function stringifyContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content === undefined || content === null) return "";
  try {
    return typeof content === "object" ? JSON.stringify(content, null, 2) : String(content);
  } catch {
    return String(content);
  }
}

export function isRecoverableToolFailureMessage(message: {
  type?: string;
  toolResult?: { isError?: boolean; errorCode?: string; content?: unknown } | null;
  noticeSeverity?: NoticeSeverity;
  recoverable?: boolean;
}): boolean {
  if (!message.toolResult?.isError) return false;
  return isRecoverableToolError({
    errorCode: message.toolResult.errorCode,
    rawContent: message.toolResult.content,
  });
}

export function hasHardToolFailure(message: {
  type?: string;
  toolResult?: { isError?: boolean; errorCode?: string; content?: unknown } | null;
  noticeSeverity?: NoticeSeverity;
  recoverable?: boolean;
}): boolean {
  if (message.type === "error") {
    if (message.noticeSeverity === "pause") return true;
    if (message.noticeSeverity === "handling" || message.noticeSeverity === "permission") return false;
    if (message.recoverable === true) return false;
    if (message.recoverable === false) return true;
    return false;
  }
  if (!message.toolResult?.isError) return false;
  if (isPermissionErrorCode(message.toolResult.errorCode)) return false;
  return !isRecoverableToolFailureMessage(message);
}
