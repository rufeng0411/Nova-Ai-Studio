/** PD-SAAS-FORK: model-side skill lock when user clicked Hub "试一下". */

import { isChatFirstCapability } from "./chatFirstCapabilities.js";
import { isVideoApiReady } from "./media/mediaRuntimeProbe.js";
import {
  isHyperframesEngineEnabled,
  isHyperframesVideoSlug,
  HYPERFRAMES_SLIDESHOW_SLUGS,
} from "./media/hyperframesEngineFlags.js";
import { resolveCanonicalDerivedBindingHint } from "./deliverableDerivationPolicy.js";
import type { CapabilityCompletionMode } from "./intent/capabilityCompletionMode.js";
import type { OfficialMediaPolicy } from "./constraints/officialMediaRequirement.js";
import { buildAcquisitionStrategyBlock } from "./media/visualAssetPlatform/visualAcquisitionLadder.js";
import { resolveImNotifyMcpFlag } from "./imNotify/flags.js";
import { buildImNotifyBindingAppendPrompt } from "./imNotify/notifyIntent.js";

export type CapabilityBindingContext = {
  slug: string;
  /** Optional for CLI harness; falls back to slug when absent. */
  displayName?: string;
  /** Hub pack member slug prefix, e.g. mkt-brand- */
  packMemberPrefix?: string;
  /** brainstorming / marketing / … — drives chat-first vs execute binding */
  majorCategory?: string;
  /** PD-SAAS-FORK workbench yield: hub try vs free-text infer (hub never overwritten). */
  source?: "hub" | "inferred";
};

const EXECUTION_ETIQUETTE =
  "无需重复说明任务来源；缺关键输入时再提问；产出文件后在对话中给出可点击路径。"
  + "若用户消息与该能力明显无关，按常规对话处理。";

const CHAT_FIRST_INSTRUCTIONS = [
  "这是能力中心「脑爆」Tab 的对话型能力：直接在对话中按该技能的语气、视角与方法论回应。",
  "须快速回复；可短暂思考，但不要拖长时间线或多轮工具准备。",
  "默认禁止调用任何工具（含 read_skill、read_file、grep、glob、web_search、web_fetch、write_file、bash）。",
  "仅当用户明确要求生成报告、总结分析、文档、画布、导出或写入 artifacts/文件时，才启用相应工具并按技能交付。",
  "用户闲聊、探讨、角色扮演、咨询观点或口头分析时，立即用自然语言回复；不要先加载技能文件或探索工作区。",
].join("");

/** PD-SAAS-FORK: 脑爆「企业咨询」— 替换 CHAT_FIRST；与脑爆一致：快速口语、默认零工具 */
const ENTERPRISE_CONSULT_CHAT_INSTRUCTIONS = [
  "这是能力中心「脑爆 → 企业咨询」的对话顾问：用「我」以口语大白话快速回答中小微经营问题。",
  "须快速回复；可短暂思考；默认禁止调用任何工具（含 read_skill、web_search、web_fetch、write_file、扫盘）。",
  "用户明确要求正式意见书/检查清单落盘时，引导能力中心「企业」Tab 对应卡或企业类全案模板；本对话不要默认 write_file。",
  "允许最多一轮澄清（如城市、纳税身份）；禁止页数/风格偏好问卷。",
  "法域中国大陆；首次一句免责（草稿非执业意见），勿重复。禁止逃税/虚开/伪造材料指引。",
].join("");

/** 与 scripts/lib/enterpriseConsultHubTaxonomy.mjs ENTERPRISE_CONSULT_BINDS 保持同步 */
const ENTERPRISE_CONSULT_BINDS: Record<string, string[]> = {
  "consult-finance": [
    "tax-type-classifier",
    "tax-eit-return-reviewer",
    "tax-invoice-compliance-checker",
  ],
  "consult-tax": [
    "tax-invoice-compliance-checker",
    "tax-vat-rate-classification",
    "tax-input-tax-credit-checker",
    "tax-preference-application-advisor",
    "tax-deduction-compliance-checker",
  ],
  "consult-hr": [
    "zh-hiring-review",
    "zh-termination-review",
    "zh-wage-hour-qa",
    "zh-handbook-updates",
    "zh-worker-classification",
  ],
  "consult-legal": [
    "zh-entity-compliance",
    "zh-board-minutes",
    "zh-reg-gaps",
    "zh-diligence-issue-extraction",
  ],
  "consult-contract": [
    "zh-contract-review",
    "zhxx-contract-review",
    "zh-nda-review",
    "zh-saas-msa-review",
  ],
  "consult-policy": [],
};

function isEnterpriseConsultSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENTERPRISE_CONSULT_BINDS, slug.trim().toLowerCase());
}

/** @internal exported for tests */
export function resolveEnterpriseConsultExtra(slug: string): string | undefined {
  const normalized = slug.trim().toLowerCase();
  if (!isEnterpriseConsultSlug(normalized)) return undefined;
  const handoff: Record<string, string> = {
    "consult-finance": "comp-bookkeeping-xlsx",
    "consult-tax": "comp-invoice-vat",
    "consult-hr": "comp-labor-hire",
    "consult-legal": "comp-entity-compliance",
    "consult-contract": "comp-contract-review",
    "consult-policy": "comp-policy-search",
  };
  return `正式落盘清单/意见书请引导用户打开「企业」Tab 的 ${handoff[normalized] ?? "对应"} 卡或企业类全案模板；本对话默认只口语答疑。`;
}

const EXECUTE_SKILL_INSTRUCTIONS =
  "必须先 read_skill 加载该技能并按其执行，不要改用其他无关技能。";

const EXECUTE_PACK_INSTRUCTIONS =
  "必须先 read_skill 加载对应技能并按其执行，不要改用无关技能。";

const SLUG_EXTRA_INSTRUCTIONS: Record<string, string> = {
  "mcp-im-notify": [
    "这是出站消息通知能力：仅当用户明确要求发到企微/钉钉/WhatsApp 时调用 mcp__im-notify__notify_send。",
    "未配置通道时简短说明需管理员在「后台 → 消息通道 → 出站通知」配置；禁止寒暄误发；WhatsApp 用纯文本。",
  ].join(""),
  "df-image-generation": [
    "用户要求「先搜官图/基于官图改图/官网产品图」时：先 resolve_session_visual_assets(phase_a) 写入 manifest，再 generate_image 并传 reference_image_paths[] 指向 manifest 中 official 路径；",
    "禁止无 reference_image_paths 凭空 generate 产品官图；reference 须来自 manifest preparedPath/rawPath。",
    "改图完成后 write_file 交付 PNG 须引用 manifest 或 derivative 路径，禁止 placeholder.svg。",
  ].join(""),
  "od-mobile-app": [
    "执行顺序：1) scaffold_mobile_mockup（slug + preset）；2) 按需 edit_file screen-N.html；",
    "禁止 read_file skills/ 路径；读清单用 read_skill od-mobile-app relativePath=references/checklist.md；",
    "禁止在对话贴整页 html。",
  ].join(""),
  "od-poster-hero": [
    "主视觉先生图：先 generate_image（≈1）落盘 taskArtifactDir/hero.png（或同目录 PNG），再 write_file index.html 引用；禁止首轮 CSS/SVG 冒充主视觉。",
    "读清单：read_skill od-poster-hero relativePath=references/checklist.md；勿 read_file skills/。STDA 仅 artifacts/task-*，禁止 artifacts/design/。",
  ].join(""),
  "od-article-magazine": [
    "关键配图位先 generate_image（合计≤3）落盘 PNG 再写 HTML；禁止空占位当完成。官图 goal 除外。",
    "读清单：read_skill od-article-magazine relativePath=references/checklist.md；勿 read_file skills/。",
  ].join(""),
  "od-social-carousel": [
    "封面/主卡先 generate_image（≈1）落盘 PNG；次卡可用 CSS。禁止整套纯渐变充数。",
    "读清单：read_skill od-social-carousel relativePath=references/checklist.md；勿 read_file skills/。",
  ].join(""),
  "od-image-gen": [
    "必须调用 generate_image 落盘真实 PNG/JPG 到 taskArtifactDir；禁止仅 CSS/SVG；禁止 artifacts/media/ 语义目录。",
  ].join(""),
  "od-saas-landing": [
    "非官图：Hero 先 generate_image（≈1）再 write_file index.html；禁止首轮 CSS 渐变冒充 Hero。",
    "官网大图任务：resolve_session_visual_assets(phase_a) 或 fetch_page_images→fetch_media_asset，写入 manifest 后 HTML 必须引用 localizedPath；",
    "读清单：read_skill od-saas-landing relativePath=references/checklist.md；勿 read_file skills/。",
    "禁止 placeholder.svg / generate_image 冒充官图；manifest 有 official 资产时 write_file index.html 须绑定这些路径。",
    "页面须含英雄区+主CTA、卖点/信任、底部转化；禁模板彩虹渐变、禁假按钮；STDA 仅 artifacts/task-*。",
  ].join(""),
  "od-waitlist-page": [
    "Hero 非官图时先 generate_image（≈1）再写 HTML；次要装饰可用 CSS。读清单：read_skill od-waitlist-page relativePath=references/checklist.md。",
  ].join(""),
  "od-blog-post": [
    "有配图诉求时先 generate_image（≤2）落盘再引用。读清单：read_skill od-blog-post relativePath=references/checklist.md。",
  ].join(""),
  "open-design": [
    "用户已给全量需求（含多屏手机界面）时跳过问卷，直接路由子技能。",
    "创意视觉（海报/封面/杂志/落地页 Hero）：非官图时先 generate_image 落盘 PNG 再写 HTML；禁止首轮 CSS/SVG 冒充主视觉。官图任务读 references/official-product-images.md。",
    "读设计系统/清单/取图规则用 read_skill open-design relativePath=references/…，勿 read_file skills/。",
    "所有 HTML/CSS/资产必须 write_file 到系统分配 taskArtifactDir（artifacts/task-*）下的 index.html（可加同目录 css/assets）；禁止 artifacts/design/、saas-pricing/、artifacts/<语义名>/ 等非 STDA 目录。",
    "禁止 Task/subagent 代写交付 HTML——须主线程 write_file；完成后只报 taskArtifactDir 内相对路径，禁止把完整 HTML 贴进对话代替落盘。",
  ].join(""),
  "nova-bento-slides": [
    "执行顺序：1) read_skill 本技能（relativePath=references/agents-guide.zh-CN.md、strategist-lite.md、themes.md、layouts.md、quality-gates.md）；",
    "2) 用户 goal 含页数/画幅/主题时直接执行，禁止首 turn 问卷；",
    "3) Phase C 写 bento-spec.md（锁定 theme 配色/字体/配图资产），Phase D outline.json（每页 layout 配方），Phase E–F 逐页手写 elements（text/shape/image/chart/table）；",
    "4) **所见所得 WYSIWYG**：右栏 Bento 预览须与交付一致——品牌色写入 theme+accent 元素；字体层级（封面 56–76 / 标题 40–48 / 正文 16–22）；产品/场景图须 `type:image` + `doc.assets`（fetch_page_images / resolve_session_visual_assets 本地化，禁止裸外链）；按 layouts.md 坐标（x≥96，x+w≤1184）；禁止仅 2 个 text 框的白板页；",
    "5) Phase G splice-bento-shell.mjs → deck.bento.html；Phase H validate-bento-doc.mjs --strict 通过后才 write_file 终态；",
    "6) **禁止** write_file 静态 HTML/CSS 幻灯到 *.bento.html；**禁止** repair-static-html 或有损转换充数；",
    "7) 终态唯一 deck.bento.html，禁止 index.html / pptx / PNG 包替代；",
    "8) 完成后给出 deck.bento.html 相对路径，用户右栏一点即编且版式与生成一致。",
  ].join(""),
  "nova-ppt-aesthetic-slides": [
    "执行顺序：1) read_skill 本技能并读 playbook.md、references/pilotdeck-execution.md；",
    "2) 用户要求「按参考附件逐页制作/严格还原」时：必须先 read_file 用户 @ 的 PPT/PDF/DOCX 或解析对话附件全文，outline 页数与参考逐页对齐，禁止跳过附件自拟主题；无 @ 时勿读无关 index.html/README/旧 artifacts/slides-* PNG 包；",
    "3) 若用户要求官网/权威站配图：Phase D 前必须 resolve_session_visual_assets(phase_a) 或读取系统注入的 visual-asset-manifest；优先引用 manifest 中 preparedPath/rawPath 作为 slide 配图（可 prepare_visual_asset 裁剪）；禁止 generate_image 冒充产品官图；",
    "4) Phase A–E：outline.json → 页描述 → 逐页配图（manifest 路径优先；仅 ladderExhausted 且无 manifest 资产时 generate_image 作装饰背景且 placeholder=true）；",
    "4b) 多页 slide PNG：在 PILOTDECK_NOVA_SLIDE_IMAGE_PARALLEL>0 时允许并行 generate_image（同 turn 内最多 4 路），须先写 slide-manifest.json 页清单再批量出图；",
    "5) 写入 slide-manifest.json；6) 告知用户预览任一页 PNG 后点「导出 PPT」→ MinerU 可编辑 PPTX（非图片合成）。",
    "7) 美学路径仍须统一视觉风格与版式节奏；**禁止**无 preset/白底单行字/无布局幻灯图；有数据页须图表化呈现；品牌/产品图优先官网/权威站，降级位图占位须标注「图源待补」。",
    "禁止产出 HTML 幻灯或项目根 index.html；若配图阶梯全部失败须如实披露，勿用 SVG 冒充完成。",
  ].join(""),
  "html-ppt": [
    "用户消息若含 <launch-context capability=\"html-ppt\">，按其中 theme/full_deck/page_count 执行，跳过主题问卷。",
    "必须先 read_skill skillName=`html-ppt`，使用已选 assets/themes 与 templates/full-decks，产物 write_file 到 artifacts/。",
    "**禁止**无 theme/layout/CSS 的裸 HTML 幻灯（白板式 h1+ul）；每页须用 skill 内 layout 模板。",
    "用户 goal 含官网/官图时：Phase 写 HTML 前须 resolve_session_visual_assets；index.html 的 img/background 必须引用 manifest 路径，禁止 placeholder.svg。",
    "禁止 read_file skills/ 路径；交付时只给 index.html 完整相对路径。",
  ].join(""),
  "anth-pptx": [
    "执行顺序：1) read_skill 本技能（pptx / editing.md / pptxgenjs.md）；",
    "2) 用户要求「严格根据附件/分页/大纲」或 @ 了 DOCX/PPT/PDF 时：必须先 read_file 附件全文或经 document import 解析，逐页 outline 与附件页数对齐，禁止跳过附件自拟主题；",
    "3) 交付物必须是 workspace 内真实可打开的 .pptx（python-pptx / pptxgenjs / 模板编辑流程），write_file 后须在对话给出 .pptx 相对路径；",
    "4) 禁止用 presentation.html、slides.html、create_pptx.py 或空壳 presentation.pptx 代替最终交付；HTML 仅作可选预览，不得作为唯一成果；",
    "5) 若用户明确要求 PPTX/PPT/可编辑幻灯，未完成合法 .pptx 前不得宣称任务完成。",
    "6) 禁止用 bash/python 循环验证 PPT 可读性；write_file 后给出路径即可，预览异常由用户下载 Office 打开。",
    "7) 质量强制：**禁止白板/无风格/无布局**（须配色+≥3种页级 layout，禁止默认白底+bullet 堆叠）；统一母版/配色/字体层级（默认 16:9）；有数据对比须做图表；品牌/产品配图走官网或权威站（resolve_session_visual_assets→bind），降级位图占位须标注「图源待补」，其他装饰可用 generate_image；禁止 generate_image 冒充官图。",
  ].join(""),
  "ppt-master": [
    "执行顺序：1) read_skill 本技能（ppt-master / python-pptx 可编辑流程）；",
    "2) 默认 8–10 页、16:9，含母版/配色/图表，禁止首 turn 追问页数；读 `workflows/routing.md` 后默认 `workflows/generate-pptx.md`（ordinary）；",
    "3) 交付物必须是真实可编辑 .pptx（presentation.pptx），禁止 HTML 或空壳充数；",
    "4) slide PNG 仅作过程预览，不得进入 repair 必需槽。",
    "5) 禁止 read_skill df-ppt-generation 或 html-ppt 替代本技能。",
    "6) Nova Web/SaaS 路径：始终禁止 spawn Flask :5050 确认页，禁止八确认 BLOCKING，禁止首 turn 页数/模板 ask_user_question。默认 8–10 页、16:9；若已有 <launch-context capability=\"ppt-master\"> 则用其中画幅/模式/风格，仍不开 Flask。",
    "7) 质量强制：**禁止白板/无风格/无布局**；有数据对比须做图表；品牌/产品配图优先官网/权威站→位图占位（须标注）→其他可用 AI 生图；禁止假官图。",
  ].join(""),
  "open-design-preflight": [
    "若会话含 <launch-context capability=\"open-design\"> 或右栏 Preflight 已确认 surface：禁止 ask_user 选模板/设计系统问卷，直接按所选 DESIGN.md 写盘。",
  ].join(""),
  "df-ppt-generation": [
    "当用户 goal 含「演示稿、页数、.pptx、可编辑、原生可编辑 PPT」时：禁止继续本技能 PNG-only 流程；",
    "必须改 read_skill anth-pptx（首选）或 ppt-master，交付真实 .pptx，禁止 HTML/PNG 充数。",
    "仅当用户明确要「配图幻灯/PNG 包/AI 配图」且未要求 pptx 时，才可用本技能 df-ppt 流程。",
  ].join(""),
  "edu-sci-timesfm-forecasting": [
    "执行顺序：1) 必须先 read_skill 加载本技能；2) 运行或说明 scripts/check_system.py preflight；",
    "3) 必须 read_file 用户提供的 CSV/表格/时间序列数据，确认时间列、数值列、预测 horizon；",
    "4) 无 CSV/时间序列数据时，禁止编造预测数字，必须温和说明缺少数据并请求上传或仅交付可运行模板；",
    "5) 真正运行后至少交付 forecast.json 或 forecast.csv，以及 forecast.png/forecast-chart.png 图表路径。",
  ].join(""),
  "social-creative-matrix": [
    "执行顺序：1) read_skill 本技能；2) brief.md + creative-anchors.md + copywriting.md（alias copy-matrix.md）；",
    "3) **配图仅 4 张**：visuals/image-9x16.png、image-3x4.png、image-1x1.png、image-16x9.png——各调用 generate_image **最多 1 次**；",
    "4) **禁止** discover_visual_assets/prepare_visual_asset/VAP 搜图（fiction/IP/无官网 URL 时）；禁止 per-platform 多张 png、禁止 img-*.png 垃圾文件；",
    "5) manifest.json status=ready；6) 仅 user goal 含「草稿/小红书/发布」时才 yixiaoer_api + draft-status.md，否则勿做草稿步骤。",
    "禁止 Task/subagent；禁止首 turn ask_user_question。",
  ].join(""),
  "geo-keyword-research": [
    "执行顺序：1) read_skill geo-keyword-research（仅 Nova 短文，勿跑 8 阶段 SEO workflow）；2) web_search 2–4 次；",
    "3) write_file keywords.md（≥20 词 + ≥10 验证问句）；4) read_skill geo-dual-report → keywords.html；",
    "禁止 Task/subagent/CLI/Perplexity；禁止未写 md 先写 html。",
  ].join(""),
  "create-taste-brutalist": [
    "执行顺序：1) read_skill create-taste-brutalist；2) 所有 HTML/CSS 写入 **taskArtifactDir**（禁止 artifacts/design/ 语义目录）；",
    "3) 终态至少 index.html；多页时 characters.html/terminal.html 等同目录；4) **禁止 Task/subagent** 委派；",
    "5) write_file 完成后在正文给出相对路径，禁止 glob 扫其它 task-* 目录。",
  ].join(""),
  "cyber-ppt": [
    "执行顺序：1) read_skill cyber-ppt + references/nova-fast-path.md + references/nova-ppt-visual-minimum.md；2) 从 user goal 推断主题/页数，禁止首 turn ask_user_question；",
    "3) **禁止 Task/subagent**——pptx/manifest/qa_gate 必须主线程 write_file 到 taskArtifactDir；禁止 /tmp/ 或 task 外路径；",
    "4) 快路径：slide_manifest.json → **nova_build_from_manifest.py**（或 import nova_pptx_layout 的自写脚本）→ presentation.pptx + visual_qa_gate.json；",
    "5) **画布硬约束**：16:9 = 13.333×7.5 in，所有形状须 clamp 在画布内（禁止 x+w 或 y+h 越界导致变形）；qa_gate 须 canvas_bounds_pass: true；",
    "6) **禁止白板/无风格/无布局 pptx**（Dark Tech+品牌色+页型组件）；禁止 ImageGen 全页蓝图/8 风格样张挡交付；禁止 HTML/脚本充数。",
  ].join(""),
  "create-vid-scriptwriting": [
    "本能力交付口播/分镜文稿 markdown（脚本.md）；禁止首轮 generate_video / render_html_video / render_hyperframes；用户未点名成片时勿编必填 mp4。",
  ].join(""),
  "create-vid-saas-demo-script": [
    "本能力交付演示分镜文稿 markdown；禁止首轮 generate_video / render_html_video / render_hyperframes。",
  ].join(""),
  "create-vid-viral-copy": [
    "本能力交付短视频文案/脚本 markdown；禁止首轮 generate_video / render_html_video / render_hyperframes。",
  ].join(""),
  "viral-talking-script": [
    "本能力交付口播讲稿 markdown；可选 mp4 不进必填清单；禁止首轮 generate_video / render_html_video / render_hyperframes。",
  ].join(""),
  "tool-generate-video": [
    "用户要可直接播放的 mp4 成片时，优先 generate_video；勿先用 render_html_video、Remotion 或 HyperFrames，除非用户明确要可编辑工程或 HTML 录屏。",
    "write_file 产出到 artifacts/media/ 并在对话给出 mp4 相对路径。",
  ].join(""),
  "od-video-gen": [
    "用户要 mp4 成片且视频 API 已配置时，优先 generate_video；HTML/Remotion 仅作可编辑工程分支。",
  ].join(""),
  "create-wonda": [
    "音乐：wonda generate music；配音/转写：wonda generate tts 或 transcribe；需 Wonda Key（能力接入中心）。",
    "若已配置 generate_speech / transcribe_audio 内置工具，优先内置工具。",
  ].join(""),
  "create-ai-music": [
    "本能力已迁移至 Wonda：wonda generate music --model suno-music；勿使用 PILOTDECK_SKILL_MUSIC_API_KEY。",
  ].join(""),
  "pd-geo": [
    "GEO 验证顺序：① 对 keywords.md 中验证问句逐条 web_search；② 主检索失败时系统自动 fallback 博查（BOCHA_API_KEY）；",
    "③ geo_api score 评分；verify 可选（有博查 Key 时 CLI 代查）。禁止向用户说明「未配置 Perplexity Key」或要求 Perplexity/Google 搜索 API。",
    "品牌 GEO 全案首 write 必须是 geo-aeo-audit-checklist.md（精确 basename）；禁止 novapage-online-geo-full-case-*.md、artifacts/geo/ 等 SDM 外路径。",
    "禁止 mcp__browser-use__browser_navigate / Playwright 浏览器；站点取证只用 web_fetch + web_search。",
    "audit + keywords 可并行 write_file；三平台成稿（zhihu/xiaohongshu/wechat）在 audit/keywords 完成后可并行 write_file。",
    "报告类：先 write_file 各 .md 再 read_skill geo-dual-report 生成同名 .html。",
    "读清单：read_skill pd-geo relativePath=references/search-verify.md；勿 read_file skills/。",
    "禁止 Task/subagent 委派与 /tmp_workspace/；阶段产物一律写入 <task-artifact-dir>；禁止 glob/read/write 其它 artifacts/task-* 目录。",
  ].join(""),
  humanizer: [
    "禁止 Task/subagent/agent 委派；主线程 read_skill + write_file 直写 <task-artifact-dir>。",
    "禁止 glob/read/write 其它 artifacts/task-* 目录；仅本 session 分配的任务目录。",
    "须交付 article.md + 五平台 humanize（zhihu/xiaohongshu/wechat/douyin/bilibili .md）+ data-sources.md。",
    "article.md 落盘后，五平台稿与 data-sources.md 无依赖时可同 turn 并行 write_file（勿串行等待）。",
  ].join(""),
  "viral-article-generator": [
    "禁止 Task/subagent；主线程 read_skill viral-article-generator 后 write_file 直写 <task-artifact-dir>。",
    "禁止首 turn 问卷与正文「请选择风格」；禁止以 skills/vendor/viral-article-generator/ 为风格权威。",
    "须交付：article-brief.md、article.md、quotes.md、channel-plan.md（写入系统分配任务目录）；四文件同 turn 写完即停。",
    "channel-plan.md≤800 字；禁止为润色渠道/配图/口播空转；未要求配图禁 generate_image。",
    "自动主风格仅 T1-1/T1-2（full）；stub 可进 TOP3 但永不自动主写；点名 stub 或禁区/低配软切换仍交四文件；混搭硬拒绝。",
    "T1-1 禁「这意味着什么」/行动清单；T1-2 蓝字=Markdown 加粗；虚构数据标【示例数据】；选定后最多再读 1 份 style-t1-*.md。",
  ].join(""),
  "geo-aeo-audit": [
    "品牌 GEO 全案首 write 必须是 geo-aeo-audit-checklist.md（精确 basename）。",
    "禁止 browser_navigate / Playwright；站点取证只用 web_fetch + web_search。",
    "品牌可见度验证：web_search → 博查；勿配置 Perplexity API Key。",
  ].join(""),
  "geo-citability": [
    "引用评分后验证问句：web_search → 博查；勿用 Perplexity API。",
  ].join(""),
  "geo-content-optimizer": [
    "若需联网查竞品/案例：web_search → 博查；勿用 Perplexity API Key。",
  ].join(""),
  "geo-monitor-hub": [
    "监测末步须 read_skill geo-monitor-report；产出 monitor-data.json + monitor-report.md + geo-monitor-report.html 三件套。",
    "顺序：先 monitor-report.md 落盘，再 HTML。",
    "缺 AgentAEO/探测 Key 时在 JSON 标 status:skipped，仍交付 HTML 页（灰显维度）。",
  ].join(""),
  "geo-monitor-report": [
    "前置：monitor-report.md 与 monitor-data.json 已 write_file 落盘。",
    "复制 skills/geo-monitor-report/templates/geo-monitor-report.html 并注入 monitor-data.json；禁止用 od-data-report 替代。",
  ].join(""),
  "geo-dual-report": [
    "前置：同目录源 .md 已 write_file 落盘；须 read_file 该 MD 后再 write_file 同名 .html。",
    "禁止未读 MD 凭空写 HTML 或改写报告结论。",
  ].join(""),
  "geo-visibility-probe": [
    "验证问句：web_search → 博查；结果供 geo-monitor-hub 合并到 monitor-data.json。",
  ].join(""),
  "mcp-agent-aeo": [
    "需 AGENTAEO_API_KEY；无 Key 时跳过 citation 维度并标注，不中断监测流程。",
  ].join(""),
  "ala-fact-checker": [
    "执行顺序：1) read_skill 本技能；2) web_search/web_fetch 核查来源；3) 同 turn write_file 完整事实核查报告到系统分配 taskArtifactDir 下的 output.md。",
    "禁止 write_file 到 tmp_workspace/、tmp/、temp/ 或 artifacts/research-* 等语义目录；子代理/agent 须同样写入 taskArtifactDir。",
    "data-sources.md 由引擎自动 sync 到 taskArtifactDir，禁止引用同项目其他会话/任务目录下的 data-sources.md 或无关 md。",
    "禁止把同项目其他任务成果当作本轮交付；清单仅含本轮 SDM 槽位对应文件。",
  ].join(""),
};

const NOVA_RESEARCH_PREFIX = "nova-research-";

const CN_COMPLIANCE_SLUG_RE =
  /^(comp-|zh-|zhxx-|bid-|biaoshu-|mcp-cn-central-policy)/i;

const ENTERPRISE_MCP_BATCH1_SLUGS = new Set([
  "mcp-cn-erp",
  "mcp-kingdee-k3",
  "mcp-yonyou-fin",
  "mcp-tax-invoice",
  "mcp-notion-collab",
  "mcp-postgres-readonly",
]);

/** PD-SAAS-FORK: 企业 MCP 首批 — 未启用禁虚假「已连/已开票」；写操作须用户明示 */
function resolveEnterpriseMcpBatch1Extra(slug: string): string | undefined {
  const normalized = slug.trim().toLowerCase();
  if (!ENTERPRISE_MCP_BATCH1_SLUGS.has(normalized)) return undefined;
  const parts = [
    "本能力依赖后台「企业 MCP」功能开关与 mcp.json 凭据；未启用或未配置时须明确告知用户「未启用/未配置」，禁止假装已连接金蝶/用友、已开票、已写入 Notion 或已查业务库。",
    "禁止 ask_user_question 索要 API Key/Token（由管理员配置）；缺配置时直接说明并停止虚假查询。",
    "默认只读：禁止调用审批、保存单据、删凭证、开票、红冲等写工具，除非用户本轮明确授权且平台已开放写工具。",
    "成果写入系统分配 taskArtifactDir；查询摘要可用 md，勿把密钥/连接串写入对话或成果。",
  ];
  if (normalized === "mcp-cn-erp" || normalized === "mcp-kingdee-k3") {
    parts.push("金蝶相关：企业 ERP 查询与金蝶专用互斥；查询结果禁止写成「已过账/已审核」。");
  }
  if (normalized === "mcp-tax-invoice") {
    parts.push("数电发票为第三方商用服务；默认仅查询/查验；开票与红冲须 UserActionRequired，法律责任在开票方。");
  }
  if (normalized === "mcp-postgres-readonly") {
    parts.push("Postgres 仅业务库只读；禁止连接控制面 SAAS_DATABASE_URL；禁止 INSERT/UPDATE/DELETE/DDL。");
  }
  if (normalized === "mcp-notion-collab") {
    parts.push("Notion 不替代本系统项目记忆与 artifacts/task-* 成果目录。");
  }
  return parts.join("");
}

/** PD-SAAS-FORK: 企业合规卡 — 免责 + 禁问卷直开 + STDA（flag 可关） */
function resolveCnComplianceExtra(slug: string): string | undefined {
  if (process.env.PILOTDECK_CN_COMPLIANCE_BINDING === "0") return undefined;
  const normalized = slug.trim().toLowerCase();
  if (!CN_COMPLIANCE_SLUG_RE.test(normalized)) return undefined;
  const parts = [
    "法域默认中国大陆；产出为草稿/工作底稿，不构成法律、税务或劳动人事执业意见，落地前须专业审定。",
    "禁止伪造票证、隐瞒收入、虚假申报或其它违法规避指引。",
    "禁止 ask_user_question 页数/偏好问卷；用户已选能力则直接执行并 write_file。",
    "交付写入系统分配 taskArtifactDir（artifacts/task-*）；大标书/合同仅落盘摘要进对话，禁把全文塞进 tool_result。",
  ];
  if (normalized === "comp-policy-search" || normalized === "mcp-cn-central-policy") {
    parts.push(
      "政策检索优先 mcp__cn-central-policy__*；未配置时降级 web_search/web_fetch 公开 gov.cn，并在 data-sources.md 标明来源。",
    );
  }
  if (normalized.startsWith("comp-bid") || normalized.startsWith("bid-") || normalized.startsWith("biaoshu-")) {
    parts.push("招标/标书成果只写 artifacts；对话仅给路径与要点，禁止贴整本招标 PDF 或标书全文。");
  }
  // PD-SAAS-FORK: 企业·公关卡 — 传播安全口径（不代发、不编造）
  if (normalized.startsWith("comp-pr-")) {
    parts.push(
      "公关传播工作底稿：不代发新闻/通稿、不代建媒体关系、不群发邀约；对外发布前须法务与管理层审定。",
      "禁止编造未核实事实或未发生的减排/捐赠/财务数据；危机与声誉场景须标注待核实并提示法务会签。",
    );
  }
  return parts.join("");
}

/** PD-SAAS-FORK: Hub Nova 调研能力统一执行绑定（前缀匹配，勿逐 slug 复制）。 */
function resolveNovaResearchExtra(slug: string): string | undefined {
  const normalized = slug.trim().toLowerCase();
  if (!normalized.startsWith(NOVA_RESEARCH_PREFIX)) return undefined;
  const defaultBasename = normalized.includes("industry-market")
    ? "industry-market-report.md"
    : normalized.includes("user-general")
      ? "user-research-report.md"
      : normalized.includes("product-user")
        ? "product-user-research.md"
        : "research-report.md";
  return [
    "执行顺序：1) read_skill 本技能；2) web_search 2–4 次补事实与来源；3) 同 turn write_file 完整报告 md 到系统分配 taskArtifactDir（basename 按 skill/须交付 clause，禁止 artifacts/research-* 语义目录）。",
    `主交付唯一 basename：用户「须交付：」点名优先，否则默认 ${defaultBasename}；禁止擅自拆写 01-sources-and-synthesis.md / 03-report-body.md / report.docx，除非用户明确要求 Word/三件套。`,
    "若交付 HTML 报告：resolve_session_visual_assets 后 HTML 须引用 manifest 官图路径，禁止 generate_image 冒充产品图。",
    "深度 tier：用户未指定 quick/deep 时默认 standard（12 章完整结构）；禁止 ask_user_question 询问深度、数据是否充分、是否继续补充来源等偏好。",
    "搜完即写：禁止 web_search 后以 preference 问卷停住等用户发「继续」；缺数据时用已有来源与合理推断补齐并在正文标注。",
    "禁止 read_file skills/ 空转；Recovery 耗尽前至少交付一份完整 md 报告路径。",
  ].join("");
}

/** PD-SAAS-FORK 0731: 深度蒸馏 — 只交主 md，禁 research-report 三件套。 */
export function resolveDistillExtra(userGoal?: string): string | undefined {
  const goal = String(userGoal ?? "");
  if (!/深度蒸馏/.test(goal) && !(/蒸馏/.test(goal) && /危机公关方法论/.test(goal))) {
    return undefined;
  }
  return [
    "深度蒸馏任务：只交付一份主 md（basename 含「蒸馏」或 writing-style-distill.md），写入系统分配任务目录。",
    "禁止 01-sources-and-synthesis.md / 03-report-body.md / report.docx；禁止扩成正式调研三件套。",
  ].join("");
}

const VIDEO_API_FIRST_SLUGS = new Set([
  "tool-generate-video",
  "od-video-gen",
  "df-video-generation",
  "video-generation",
  "mkt-brand-video",
  "website-promo-video",
]);

const LINUX_VIDEO_SCRIPT_SLUGS = new Set([
  "df-video-generation",
  "video-generation",
  "tool-generate-video",
]);

function skipLinuxVideoScriptHint(slug: string): string | undefined {
  const isWin = process.platform === "win32";
  const isSaas = process.env.PILOTDECK_SAAS_MODE === "1";
  if (!isWin && !isSaas) return undefined;
  if (!LINUX_VIDEO_SCRIPT_SLUGS.has(slug)) return undefined;
  return "Windows/SaaS 环境：禁止 bash 调用 df-video-generation/linux generate.py；用户要 mp4 成片时直接 generate_video，write_file 到 artifacts/media/。";
}

function hyperframesBindingHint(slug: string): string | undefined {
  if (!isHyperframesEngineEnabled()) return undefined;
  const normalized = slug.trim().toLowerCase();
  if (HYPERFRAMES_SLIDESHOW_SLUGS.has(normalized)) {
    return [
      "HyperFrames 幻灯工程：read_skill hf-slideshow → hf-hyperframes-core → 在 taskArtifactDir/hf-project/ 写 HTML/deck；",
      "不要求 promo.mp4；禁止 ask_user_question 偏好门；Studio URL 非终态。",
    ].join("");
  }
  if (!isHyperframesVideoSlug(normalized)) return undefined;
  if (normalized === "hf-website-to-video" || normalized === "hf-hyperframes-media" || normalized === "hf-gsap") {
    return "本 slug 已迁移：请 read_skill 对应新 workflow（hf-product-launch-video / hf-media-use / hf-hyperframes-animation）并按 HyperFrames 约束交付 promo.mp4。";
  }
  return [
    `执行顺序：1) read_skill ${normalized}（含 NOVA-EXEC 约束）；2) read_skill hf-hyperframes 路由；3) read_skill hf-hyperframes-core；`,
    "4) write_file 至 taskArtifactDir/hf-project/（禁止 task 外 hyperframes init）；",
    "5) 官网素材须 VAP/fetch 本地化后再写入 HTML；",
    "6) render_hyperframes(project_dir=…/hf-project, output_path=promo.mp4, quality=draft)；",
    "禁止 generate_video / render_html_video；禁止 gateway-live 分镜模板（DeepSeek/灌篮等）污染用户产品语义；",
    "禁止仅交 md/Studio URL；TTS 缺 Key 不阻断 mp4。",
  ].join("");
}

function videoApiBindingHint(slug: string): string | undefined {
  if (hyperframesBindingHint(slug)) return undefined;
  if (!isVideoApiReady()) return undefined;
  if (SLUG_EXTRA_INSTRUCTIONS[slug]?.includes("generate_video")) return undefined;
  if (VIDEO_API_FIRST_SLUGS.has(slug)) {
    return "视频 API 已就绪：用户要 mp4 成片时首轮调用 generate_video，勿默认 HTML/Remotion 降级。";
  }
  return undefined;
}

function exactCapabilityScopeInstruction(input: {
  slug: string;
  completionMode?: CapabilityCompletionMode;
  manifestPathHints?: string[];
  manifestProfileId?: string;
}): string | undefined {
  const slug = input.slug.trim().toLowerCase();
  if (slug === "ala-strategy-advisor") {
    if (input.completionMode === "consultation") {
      return [
        "当前为咨询模式：可以使用 read_skill、检索、联网与读取工具完成分析，直接在对话中回答。",
        "不得创建任务文件、不得写入成果，也不得把咨询结论猜成报告合同。",
      ].join("");
    }
    if (input.completionMode === "report") {
      const basename = input.manifestPathHints?.[0] ?? "strategy-report.md";
      return `当前为报告模式：只按会话成果清单生成用户指定文件；未指定 basename 时仅生成 ${basename}，写入当前系统分配任务目录。`;
    }
  }
  if (slug === "mkt-last30days" && input.completionMode === "report") {
    if (
      input.manifestProfileId === "content_flywheel"
      || (input.manifestPathHints?.length ?? 0) > 1
    ) {
      return "用户已明确选择 content-flywheel 或列出多文件，严格按会话成果清单执行，不得增删槽位。";
    }
    const basename = input.manifestPathHints?.[0] ?? "marketing-deliverable.md";
    return `默认只生成一个成果：${basename}；不得扩展为 Campaign、内容飞轮或视觉全案。`;
  }
  if (slug === "ala-fact-checker" && input.completionMode === "report") {
    const basename = input.manifestPathHints?.[0] ?? "output.md";
    return [
      `当前为报告模式：只按会话成果清单生成本轮事实核查文件；默认 basename ${basename}，必须 write_file 到系统分配 taskArtifactDir。`,
      "禁止 tmp_workspace/、禁止引用或修复同项目其他任务目录下的文件（如无关调研案）。",
    ].join("");
  }
  if (slug === "ala-decision-helper" && input.completionMode === "report") {
    const basename = input.manifestPathHints?.[0] ?? "output.md";
    return `当前为报告模式：只生成 ${basename} 到系统分配 taskArtifactDir，不得扩写无关交付项。`;
  }
  return undefined;
}

function officialMediaOrderInstruction(input: {
  officialMediaPolicy?: OfficialMediaPolicy;
  allowPlaceholders?: boolean;
}): string | undefined {
  if (input.officialMediaPolicy !== "official_only") return undefined;
  const placeholderRule = input.allowPlaceholders
    ? "仅当系统官方素材预算耗尽后，才允许 write_file 带 PILOTDECK_OFFICIAL_MEDIA_PLACEHOLDER 标记的本地 SVG 占位图。"
    : "本任务不允许占位图；官方素材预算耗尽时必须明确报告缺口，禁止占位或伪造素材。";
  return [
    "官方素材模式为最高优先级，固定顺序且不得跳步：",
    buildAcquisitionStrategyBlock("zh-CN"),
    "0) 优先 resolve_session_visual_assets（phase_a，自动跑满六层阶梯），读 visual-asset-manifest 后直接引用路径；",
    "1) 若需细粒度控制：fetch_page_images 从可信官方页面发现候选；",
    "2) fetch_media_asset(candidateId) 将候选本地化到当前任务 assets/；",
    "3) write_file 只引用已本地化的相对路径（优先 preparedPath）并完成 HTML/文档；",
    "4) render_local_html_to_image 或 export_document 生成最终成果。",
    "禁止 generate_image 冒充产品官图，禁止 bash、MCP、远程热链或未继承本策略的子代理绕过。",
    "禁止用无标记 SVG 占位图当「配图完成」；缺口须披露并保持 needs_repair。",
    placeholderRule,
  ].join("");
}

export function buildCapabilityBindingAppendPrompt(
  context: CapabilityBindingContext,
  options: {
    completionMode?: CapabilityCompletionMode;
    manifestPathHints?: string[];
    manifestProfileId?: string;
    officialMediaPolicy?: OfficialMediaPolicy;
    allowPlaceholders?: boolean;
    userGoal?: string;
  } = {},
): string {
  const slug = context.slug.trim();
  const name = String(context.displayName ?? slug).trim() || slug;
  const prefix = context.packMemberPrefix?.trim();
  const enterpriseConsult = isEnterpriseConsultSlug(slug);
  const extra = SLUG_EXTRA_INSTRUCTIONS[slug]
    ?? resolveEnterpriseConsultExtra(slug)
    ?? resolveEnterpriseMcpBatch1Extra(slug)
    ?? resolveCnComplianceExtra(slug)
    ?? resolveNovaResearchExtra(slug)
    ?? resolveDistillExtra(options.userGoal);
  const derivedHint = resolveCanonicalDerivedBindingHint(slug, context.majorCategory);
  const videoHint = videoApiBindingHint(slug);
  const hyperframesHint = hyperframesBindingHint(slug);
  const linuxScriptSkip = skipLinuxVideoScriptHint(slug);
  const chatFirst = isChatFirstCapability(slug, context.majorCategory);
  const officialMediaOrder = officialMediaOrderInstruction(options);
  // PD-SAAS-FORK: P0-1 exact-slug constraint only; SDM remains the file-contract authority.
  const capabilityScope = exactCapabilityScopeInstruction({
    slug,
    completionMode: options.completionMode,
    manifestPathHints: options.manifestPathHints,
    manifestProfileId: options.manifestProfileId,
  });

  // PD-SAAS-FORK: consult-* 整段替换 CHAT_FIRST，禁止与禁网搜指令并存
  const leadInstructions = enterpriseConsult
    ? ENTERPRISE_CONSULT_CHAT_INSTRUCTIONS
    : chatFirst
      ? CHAT_FIRST_INSTRUCTIONS
      : EXECUTE_SKILL_INSTRUCTIONS;

  if (prefix) {
    const packLead = enterpriseConsult
      ? ENTERPRISE_CONSULT_CHAT_INSTRUCTIONS
      : chatFirst
        ? CHAT_FIRST_INSTRUCTIONS
        : `根据用户描述，从成员前缀 ${prefix} 的子技能中选用 1–3 个最贴合的项，${EXECUTE_PACK_INSTRUCTIONS}`;
    return [
      `<capability-binding>`,
      `用户在能力中心选择了能力包「${name}」（skill: ${slug}）。`,
      packLead,
      extra ?? "",
      derivedHint ?? "",
      hyperframesHint ?? "",
      videoHint ?? "",
      linuxScriptSkip ?? "",
      capabilityScope ?? "",
      officialMediaOrder ?? "",
      EXECUTION_ETIQUETTE,
      `</capability-binding>`,
    ].filter(Boolean).join("");
  }

  const imNotifyHint = buildImNotifyBindingAppendPrompt({
    flag: resolveImNotifyMcpFlag(),
    userText:
      slug === "mcp-im-notify"
        ? (options.userGoal || "发到企微通知")
        : (options.userGoal || ""),
  });

  return [
    `<capability-binding>`,
    `用户在能力中心选择了能力「${name}」（skill: ${slug}）。`,
    leadInstructions,
    extra ?? "",
    derivedHint ?? "",
    hyperframesHint ?? "",
    videoHint ?? "",
    linuxScriptSkip ?? "",
    capabilityScope ?? "",
    officialMediaOrder ?? "",
    imNotifyHint,
    EXECUTION_ETIQUETTE,
    `</capability-binding>`,
  ].filter(Boolean).join("");
}

/** PD-SAAS-FORK: design canvas agent protocol (when PILOTDECK_DESIGN_CANVAS=1 on gateway) */
export function buildDesignCanvasAgentAppendPrompt(): string {
  return [
    "<canvas-agent-protocol>",
    "设计画布任务：board 目录形如 artifacts/canvas-{id}/，权威状态为 canvas-manifest.json。",
    "生图/制图产出写入 board 下 assets/ 或 diagrams/，并用 canvas_add_asset 或 write_file 更新 manifest。",
    "用户 @ 多图融合或局部改图时，读取 <canvas-context> / <canvas-edit> 块；勿把 artifacts/slides-* 误当作画布板。",
    "可用工具：canvas_read_board、canvas_add_asset、canvas_add_diagram、canvas_update_manifest（gate 开启时）。",
    "添加流程图/脑图节点时必须调用 canvas_add_diagram（diagram_type=excalidraw|mermaid），不要仅用文字声称已完成。",
    "</canvas-agent-protocol>",
  ].join("");
}

function messageTextContent(message: { content?: unknown }): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const record = block as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : "";
    })
    .join("\n");
}

export function shouldAppendDesignCanvasAgentProtocol(text: string): boolean {
  return /artifacts\/canvas-|canvas_add_diagram|<canvas-edit>|canvas-manifest\.json/i.test(text);
}

/** Inject canvas tool protocol when the user turn references a design canvas board. */
export function resolveDesignCanvasAgentAppendFromMessages(
  messages: Array<{ role?: string; content?: unknown }>,
): string | undefined {
  const userText = messages
    .filter((message) => message.role === "user")
    .map((message) => messageTextContent(message))
    .join("\n");
  if (!shouldAppendDesignCanvasAgentProtocol(userText)) return undefined;
  return buildDesignCanvasAgentAppendPrompt();
}
