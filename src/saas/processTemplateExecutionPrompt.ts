// PD-SAAS-FORK: stable execution paths for multi-step process templates
import type { PromptLanguage } from "../context/prompt/resolvePromptLanguage.js";

const RESEARCH_REPORT_RE =
  /调研报告|正式调研|深度调研.*图表.*(?:word|docx|Word)|研究主题.*(?:docx|word)|research report.*(?:chart|docx)|市场研究报告|行业市场调研|(?:写|撰写).{0,24}报告/i;

// PD-SAAS-FORK: broader research-class tasks (competitor benchmarking, lead-gen, market
// research) must also take the stable research recovery path (web_search → write_file md
// → optional export) instead of the generic mobile-mockup recovery copy. A real worldcup
// competitor-benchmark run got the mockup copy ("scaffold_mobile_mockup") and looped on
// read_file because this detector did not recognize "竞品对标/获客/线索".
const RESEARCH_TASK_RE =
  /竞品对标|竞品全量对标|竞品分析|竞品清单|竞品流量|竞争对手|对标分析|竞争情报|获客|潜在客户|客户线索|线索表格|线索报告|线索清单|市场调研|行业调研|用户调研|用户研究|用研|市场格局|产业分析|行业报告|市场研究报告|行业市场调研|白皮书|竞品情报|intel\.md|battlecard|competitor\s+(?:analysis|benchmark|benchmarking)|lead(?:s|\s+generation)|market\s+research|用「Nova-(?:行业市场|通用调研|竞品对标|用户研究|学术专业)」/i;

/** Nova-产品用研 has its own MD+HTML contract — not generic research-report workflow. */
export const PRODUCT_USER_RESEARCH_DELIVERABLE_GOAL =
  /product-user-research\.(?:md|html)|Nova-产品用研|nova-research-product-user/i;

export function isProductUserResearchDeliverableGoal(
  userGoal: string,
  capabilitySlug?: string,
): boolean {
  const goal = String(userGoal ?? "").trim();
  const slug = String(capabilitySlug ?? "").trim().toLowerCase();
  return PRODUCT_USER_RESEARCH_DELIVERABLE_GOAL.test(goal)
    || slug === "nova-research-product-user";
}

const BATTLECARD_FULL_RE =
  /(?:销售\s*)?battlecard\s*全链路|battlecard\s*pack|intel\.md\s*\+\s*battlecard|竞品情报\s*\+\s*battlecard|mkt-competitive-intel.*pms-competitive-battlecard/i;

const GEO_BRAND_FULL_RE =
  /品牌\s*GEO\s*全案|geo-brand-full|AI\s*搜索可见度标准包|mkt-schema.*geo-citability|schema\.jsonld.*visibility-report/i;

const BEIJING_AI_RE =
  /北京.*(?:企业|地区).*(?:人工智能|AI).*(?:转型|业务)|北京地区.*AI/i;

const CONTENT_FLYWHEEL_RE =
  /内容营销|一轮内容|选题.*长文.*社媒|长文.*社媒切片|content marketing.*social/i;

const CONTENT_MATRIX_RE =
  /内容矩阵|五平台|一文多发|小红书.*公众号.*知乎|multi-platform matrix|humanizer.*配图/i;

const BRAND_CAMPAIGN_FULL_RE =
  /(?:campaign\s*全案|品牌传播\s*campaign|campaign\s*全|营销全案|品牌大促\s*campaign)/i;

const PRODUCT_LAUNCH_FULL_RE =
  /(?:上市全案|新品上市|product[-\s]launch(?:\s+full)?)/i;

const SOCIAL_MATRIX_TEMPLATE_RE =
  /(?:社媒矩阵|social-matrix|social-creative-matrix|国内社媒矩阵|全平台文案.*配图)/i;

export function extractUserTextFromMessage(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c): c is { type: string; text?: string } => c && typeof c === "object" && (c as { type?: string }).type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
}

export function detectResearchReportTurn(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return false;
  if (isProductUserResearchDeliverableGoal(text)) return false;
  return RESEARCH_REPORT_RE.test(text)
    || RESEARCH_TASK_RE.test(text)
    || (BEIJING_AI_RE.test(text) && /(?:报告|调研|docx|word|图表)/i.test(text));
}

export function detectContentFlywheelTurn(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return false;
  if (detectResearchReportTurn(text) || detectContentMatrixTurn(text)) return false;
  return CONTENT_FLYWHEEL_RE.test(text)
    || (/(?:3\s*步|三步)/.test(text) && /选题/.test(text) && /长文/.test(text) && /社媒/.test(text));
}

export function detectContentMatrixTurn(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return false;
  if (detectResearchReportTurn(text)) return false;
  return CONTENT_MATRIX_RE.test(text)
    || (/(?:3\s*步|三步)/.test(text) && /master\.md|五平台|矩阵/.test(text));
}

export function detectBrandCampaignFullTurn(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return false;
  if (detectProductLaunchFullTurn(text)) return false;
  return BRAND_CAMPAIGN_FULL_RE.test(text)
    || (/(?:campaign|品牌传播)/i.test(text) && /(?:全案|各阶段|一次规划)/i.test(text));
}

export function detectProductLaunchFullTurn(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return false;
  return PRODUCT_LAUNCH_FULL_RE.test(text)
    || (/(?:上市|launch)/i.test(text) && /(?:全案|各阶段|一次规划|一次性)/i.test(text));
}

export function detectSocialMatrixTurn(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return false;
  if (detectBrandCampaignFullTurn(text)) return false;
  return SOCIAL_MATRIX_TEMPLATE_RE.test(text);
}

export function detectBattlecardFullTurn(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return false;
  return BATTLECARD_FULL_RE.test(text)
    || (/(?:battlecard|竞品情报|销售话术)/i.test(text) && /(?:全链路|三步|intel\.md|talk-track)/i.test(text));
}

export function detectGeoBrandFullTurn(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return false;
  return GEO_BRAND_FULL_RE.test(text)
    || (/(?:品牌\s*GEO|geo\/)/i.test(text) && /(?:全案|schema\.jsonld|visibility-report)/i.test(text));
}

const RESEARCH_ZH = `<research-report-execution>
用户要的是「调研 + 图表 + 正式 Word」一次交付。按下面路径执行，禁止空转 read_file skills/ 或 bash/python 解析 docx。

阶段与产物（每阶段写完文件再进入下一阶段）：
1. 调研：web_search 2–4 次 → write_file 保存 01-sources-and-synthesis.md 到已分配 taskArtifactDir（含信息源列表、结论综述）。
2. 图表：优先在 01 文稿内用 Markdown 表格 + Mermaid 图表达关键数据；若必须出图，write_file 保存 02-charts.md 到同目录；禁止为读技能清单反复 read_file skills/。
3. Word：先 write_file 整合稿 03-report-body.md（摘要、正文、图表引用、结论建议），再调用 export_document 将 03-report-body.md 导出为同目录 .docx；export 失败时交付 03-report-body.md 并说明，勿无限 recovery。

禁止：read_file skills/ 路径；未写 md 就直接 anth-docx 长链；同一失败工具连续重试。
Recovery 耗尽前：若 .docx 未就绪，至少交付 01 + 03 两个 md 文件。
</research-report-execution>`;

const RESEARCH_EN = `<research-report-execution>
Deliver research + charts + formal Word in one run under the assigned taskArtifactDir: web_search → 01-sources-and-synthesis.md → charts in md → 03-report-body.md → export_document .docx. No read_file skills/. Deliver md files if export fails.
</research-report-execution>`;

const CONTENT_ZH = `<content-flywheel-execution>
用户要的是「选题 + 长文 + 社媒切片」一次交付。按下面路径执行，禁止空转 read_file skills/。

阶段与产物（每阶段写完文件再进入下一阶段；中文 UI 可用《{主题}》选题规划.md / 长文成稿.md / 社媒切片.md，pathHints alias 保留 01-topics.md 等）：
1. 选题：write_file 01-topics.md 到已分配 taskArtifactDir（1 个主话题 + 3 个子选题 + 各 1 句卖点）。
2. 长文：write_file 02-longform.md（结构清晰：小标题、要点、结论；可 web_search 1–2 次补事实，勿超过 4 次搜索）。
3. 社媒：write_file 03-social-slices.md（从 02 拆 3–5 条短文/脚本，标注适配平台与建议配图一句）。

禁止：read_file skills/；在 md 未就绪前 generate_image/bash 空转；同一工具失败连续重试。
Recovery 耗尽前：至少交付 01-topics.md + 02-longform.md。
</content-flywheel-execution>`;

const CONTENT_EN = `<content-flywheel-execution>
Deliver topics + long-form + social slices in one run under the assigned taskArtifactDir: 01-topics.md → 02-longform.md → 03-social-slices.md. No read_file skills/. Deliver at least 01+02 md before recovery exhausts.
</content-flywheel-execution>`;

const MATRIX_ZH = `<content-matrix-execution>
用户要的是「长文定稿 + 五平台改写 + 人味化润色」一次交付。按下面路径执行，禁止空转 read_file skills/。

阶段与产物（中文 UI 主文件名可用《{主题}》深度长文.md 等，pathHints alias 保留 article.md / zhihu.md 等）：
1. 定稿：write_file article.md 到已分配 taskArtifactDir（结构清晰长文）。
2. 五平台（02-platforms）：article.md 落盘后，zhihu.md、xiaohongshu.md、wechat.md、douyin.md、bilibili.md 与 data-sources.md **无依赖时可同 turn 并行 write_file**（勿串行等待）。
3. 禁止 Task/subagent 委派；glob/read/write 其它 artifacts/task-* 目录；/tmp_workspace/。

禁止：read_file skills/；同一工具失败连续 recovery。
Recovery 耗尽前：至少交付 article.md + 2 个平台稿。
</content-matrix-execution>`;

const MATRIX_EN = `<content-matrix-execution>
Deliver article.md + five platform variants under the assigned taskArtifactDir. After article.md, parallel write_file platform drafts when independent. No Task/subagent delegation; no glob/read/write other artifacts/task-*; no /tmp_workspace/. No read_file skills/. Deliver at least article + 2 platform md before recovery exhausts.
</content-matrix-execution>`;

const CAMPAIGN_ZH = `<brand-campaign-execution>
用户要的是「品牌 campaign 全案」（流程模板 brand-campaign-full：7 阶段，**不含官网**）。按顺序 write_file 到已分配 taskArtifactDir，每阶段落盘后再进下一阶段。

阶段与产物：
1. 调研：research-report.md（受众与传播环境速览，可 web_search）
2. Campaign 策划：read_skill mkt-campaign-plan → campaign-plan.md（目标、渠道、节奏）
3. 传播 brief：先 write_file campaign-brief.md，再 **export_document → campaign-brief.docx**（同 basename，须真二进制 Word）
4. 主视觉：先 resolve_session_visual_assets(phase_a) + prepare_visual_asset，再 write_file key-visual-poster.png（**禁止** generate_image / placeholder 默认兜底；img src 须 manifest 相对路径）
5. 多平台：社媒文案 + 四套比例配图（copy-matrix.md + social-*.png，write 前须 read manifest 并绑定 preparedPath/rawPath）
   **并行提示**：主视觉（stage 4）与社媒包（stage 5）在 SDM 中为 campaign-independent 组——brief docx 落盘后 key-visual 与 copy-matrix 可并行 write_file；仍须 manifest 绑定官图，禁止 placeholder 冒充。

6. 发布：仅存草稿清单 draft-status.md（不公开发布；yixiaoer 不可用则清单降级）
7. 监测：monitoring-template.md（read_skill mkt-campaign-report 框架）

标准成果清单共 6 项（调研 md、brief docx、海报、社媒包、草稿编号、监测模板）。**禁止**额外生成 index.html/官方网站，除非用户明确要求。

禁止 read_file skills/ 空转；禁止 Task/subagent/agent 委派；用户 goal 含官网/官图时 **禁止** generate_image 与 SVG 占位冒充官图；配图失败须继续 resolve/prepare 或披露缺口。
Recovery 耗尽前：至少交付 research-report.md + campaign-brief.docx + monitoring-template.md。
</brand-campaign-execution>`;

const CAMPAIGN_EN = `<brand-campaign-execution>
Deliver brand-campaign-full (7 phases, no website unless user asks). Write under taskArtifactDir: research-report.md → campaign-plan.md → campaign-brief.docx → resolve_session_visual_assets + prepare_visual_asset → key-visual-poster.png → copy-matrix.md + social images from manifest → draft-status.md → monitoring-template.md. Do not add index.html by default. For official-image goals: no generate_image or HTML placeholder defaults. At least research + brief docx + monitoring before recovery exhausts.
</brand-campaign-execution>`;

const PRODUCT_LAUNCH_ZH = `<product-launch-execution>
用户要的是「新品上市全案」（product-launch-full：调研→GTM→通稿→落地页→社媒→上线检查→草稿）。按顺序 write_file 到已分配 taskArtifactDir。

标准成果清单（7 项）：research.md、gtm-strategy.md、press-release.docx、landing.html、03-social-slices.md、go-live-checklist.md、draft-status.md。

**禁止** resolve_session_visual_assets / prepare_visual_asset / fetch_page_images / 浏览器截图，除非用户 goal **明确要求**「官图/官网产品图/官方素材」。
landing.html：非官图时 Hero 优先 generate_image（≈1）落盘 PNG 再写 HTML 引用；版式可用 CSS，**禁止**首轮纯渐变冒充 Hero。**禁止**在 task 目录生成 assets/_capture、assets/prepared、visual-asset-manifest.json（非官图）。
press-release：先 write_file press-release.md，再 export_document → press-release.docx。

禁止 read_file skills/ 空转；禁止 Task/subagent 委派。
Recovery 耗尽前：至少交付 research.md + gtm-strategy.md + press-release.docx。
</product-launch-execution>`;

const PRODUCT_LAUNCH_EN = `<product-launch-execution>
Deliver product-launch-full under taskArtifactDir: research.md → gtm-strategy.md → press-release.docx → landing.html → 03-social-slices.md → go-live-checklist.md → draft-status.md.
Do NOT call resolve_session_visual_assets unless the user explicitly requires official/product imagery. For non-official goals, prefer generate_image once for the landing Hero PNG before HTML; do not lead with CSS gradient as the hero. No assets/_capture|prepared|visual-asset-manifest unless official media requested.
</product-launch-execution>`;

const SOCIAL_MATRIX_ZH = `<social-matrix-execution>
用户要的是「社媒矩阵」一次交付。按顺序 write_file 到已分配 taskArtifactDir：

1. brief.md + creative-anchors.md
2. copywriting.md（alias copy-matrix.md，8 平台文案）
3. **仅 4 张配图**：visuals/image-9x16.png、visuals/image-3x4.png、visuals/image-1x1.png、visuals/image-16x9.png（各 generate_image **最多 1 次**）
4. manifest.json

禁止：read_file skills/；Task/subagent；discover_visual_assets/VAP 搜图（fiction/IP 无官网 URL）；根目录 visual-*.png 或 img-*.png 垃圾文件；每平台多张 png。
draft-status.md / 蚁小二 **仅** user goal 含「草稿/小红书/发布」时才做。
生图失败：visuals/ SVG 占位 + manifest placeholder=true，**不阻塞**文案 passed。
Recovery 耗尽前：至少 brief.md + copywriting.md + manifest.json。
</social-matrix-execution>`;

const SOCIAL_MATRIX_EN = `<social-matrix-execution>
Deliver social matrix pack under the assigned taskArtifactDir: brief → anchors → copy → manifest → optional images. Image failures must not block copy/manifest.
</social-matrix-execution>`;

const BATTLECARD_ZH = `<battlecard-full-execution>
用户要的是「竞品情报 + Battlecard + 销售话术」三步一次交付。按顺序 write_file 到已分配 taskArtifactDir：

1. intel.md（竞争情报摘要）
2. battlecard.md（一页纸比稿要点）
3. talk-track.md（含 5 条常见异议回应）

禁止 read_file skills/ 空转；每步落盘后再进下一步。
Recovery 耗尽前：至少交付 intel.md + battlecard.md。
</battlecard-full-execution>`;

const BATTLECARD_EN = `<battlecard-full-execution>
Deliver intel.md + battlecard.md + talk-track.md under the assigned taskArtifactDir in one run. No read_file skills/. At least intel + battlecard before recovery exhausts.
</battlecard-full-execution>`;

const GEO_BRAND_ZH = `<geo-brand-full-execution>
用户要的是「品牌 GEO 全案」按阶段一次交付，全部写入已分配 taskArtifactDir。执行步骤（workflow）与验收清单（SDM）分离：步骤可 7 步，但验收以以下 7 项文件为准：

标准成果清单（验收唯一依据）：
1. geo-aeo-audit-checklist.md
2. keywords-research.md
3. 平台成稿×3：zhihu-article.md、xiaohongshu-article.md、wechat-article.md
4. optimized.md
5. schema.jsonld
6. citability-report.md
7. visibility-report.html
（可选：draft-status.md 草稿编号，不计入必交）

**首 write 必须是 geo-aeo-audit-checklist.md**（精确 basename，禁止 novapage-online-geo-full-case-*.md、artifacts/geo/ 等 SDM 外路径）。
**禁止** mcp__browser-use__browser_navigate / Playwright 浏览器；站点取证只用 web_fetch + web_search（失败走博查 fallback）。

执行顺序参考：
1. geo-aeo-audit → 审计清单（首 write）
2. pd-geo → 关键词 + 平台成稿 + optimized.md
3. geo-content-optimizer → 优化 optimized.md
4. mkt-schema → schema.jsonld
5. geo-citability → 评分/验证（web_search/博查，勿 Perplexity API）
6. od-data-report → visibility-report.html

**并行提示**：audit + keywords 可并行 write_file；三平台成稿可并行 write_file（须先完成 audit/keywords 阶段）。

禁止 read_file skills/ 空转；验证不可用须降级仍交付上述清单文件。
Recovery 耗尽前：至少交付 geo-aeo-audit-checklist.md + optimized.md + visibility-report.html。
</geo-brand-full-execution>`;

const GEO_BRAND_EN = `<geo-brand-full-execution>
Deliver brand GEO full case under the assigned taskArtifactDir. Workflow steps are separate from acceptance — these 7 files are the SDM checklist:
geo-aeo-audit-checklist.md, keywords-research.md, 3 platform drafts (zhihu/xiaohongshu/wechat .md), optimized.md, schema.jsonld, citability-report.md, visibility-report.html.
First write MUST be geo-aeo-audit-checklist.md (exact basename). No browser_navigate / Playwright — use web_fetch + web_search only.
Parallel write_file allowed for independent platform drafts after audit/keywords.
Degrade gracefully; no read_file skills/. At least audit checklist + optimized + visibility report before recovery exhausts.
</geo-brand-full-execution>`;

export function buildResearchReportExecutionPrompt(language: PromptLanguage = "zh-CN"): string {
  return language === "zh-CN" ? RESEARCH_ZH : RESEARCH_EN;
}

export function buildContentFlywheelExecutionPrompt(language: PromptLanguage = "zh-CN"): string {
  return language === "zh-CN" ? CONTENT_ZH : CONTENT_EN;
}

export function buildContentMatrixExecutionPrompt(language: PromptLanguage = "zh-CN"): string {
  return language === "zh-CN" ? MATRIX_ZH : MATRIX_EN;
}

export function buildBrandCampaignExecutionPrompt(language: PromptLanguage = "zh-CN"): string {
  return language === "zh-CN" ? CAMPAIGN_ZH : CAMPAIGN_EN;
}

export function buildProductLaunchExecutionPrompt(language: PromptLanguage = "zh-CN"): string {
  return language === "zh-CN" ? PRODUCT_LAUNCH_ZH : PRODUCT_LAUNCH_EN;
}

export function buildSocialMatrixExecutionPrompt(language: PromptLanguage = "zh-CN"): string {
  return language === "zh-CN" ? SOCIAL_MATRIX_ZH : SOCIAL_MATRIX_EN;
}

export function buildBattlecardFullExecutionPrompt(language: PromptLanguage = "zh-CN"): string {
  return language === "zh-CN" ? BATTLECARD_ZH : BATTLECARD_EN;
}

export function buildGeoBrandFullExecutionPrompt(language: PromptLanguage = "zh-CN"): string {
  return language === "zh-CN" ? GEO_BRAND_ZH : GEO_BRAND_EN;
}

/** PD-SAAS-FORK: resume turn — prefer existing stage artifacts as soft checkpoints. */
export function buildSoftCheckpointResumeHint(language: PromptLanguage = "zh-CN"): string {
  if (language === "zh-CN") {
    return `<process-template-checkpoint>
续跑时优先 @ 引用工作区已有阶段产物（如 01-*.md / 03-*.md）；若文件已存在则禁止重复 write_file 同路径。
禁止 read_file skills/ 空转；从首个未完成阶段继续。
</process-template-checkpoint>`;
  }
  return `<process-template-checkpoint>
On resume, @ existing stage artifacts (01-*.md / 03-*.md) first; do not rewrite files that already exist. Continue from the first incomplete stage.
</process-template-checkpoint>`;
}

/**
 * PD-SAAS-FORK b665c75c / 0731: 与 hasExplicitLiteMustDeliverOverride 同构
 * （须交付单 md、无 docx/三件套 basename）。本地解析避免循环依赖。
 */
export function isLiteMustDeliverMdOnlyGoal(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return false;
  const match = text.match(/须交付\s*[:：]\s*([\s\S]*?)(?:写入系统分配任务目录|写入系统|$)/i);
  if (!match?.[1]) return false;
  const clause = match[1].replace(/[。.!！?？]\s*$/, "").trim();
  if (!clause || !/\.md\b/i.test(clause)) return false;
  if (/\.docx\b|Word\s*正式|01-sources-and-synthesis|03-report-body/i.test(clause)) return false;
  // Ignore non-basename noise; require at least one .md token like parseMustDeliverClause.
  const mdTokens = clause.match(/[A-Za-z0-9_\u4e00-\u9fff][A-Za-z0-9._\u4e00-\u9fff\-]*\.md\b/gi) ?? [];
  return mdTokens.length >= 1;
}

export function resolveProcessTemplateAppendFromMessages(
  messages: Array<{ role?: string; content?: unknown }>,
  language: PromptLanguage,
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== "user") continue;
    const text = extractUserTextFromMessage(msg.content);
    if (text.includes("<task-resume")) {
      return buildSoftCheckpointResumeHint(language);
    }
    if (detectBattlecardFullTurn(text)) {
      return buildBattlecardFullExecutionPrompt(language);
    }
    if (detectGeoBrandFullTurn(text)) {
      return buildGeoBrandFullExecutionPrompt(language);
    }
    if (detectResearchReportTurn(text) && !isLiteMustDeliverMdOnlyGoal(text)) {
      return buildResearchReportExecutionPrompt(language);
    }
    if (detectContentFlywheelTurn(text)) {
      return buildContentFlywheelExecutionPrompt(language);
    }
    if (detectContentMatrixTurn(text)) {
      return buildContentMatrixExecutionPrompt(language);
    }
    if (detectProductLaunchFullTurn(text)) {
      return buildProductLaunchExecutionPrompt(language);
    }
    if (detectBrandCampaignFullTurn(text)) {
      return buildBrandCampaignExecutionPrompt(language);
    }
    if (detectSocialMatrixTurn(text)) {
      return buildSocialMatrixExecutionPrompt(language);
    }
    break;
  }
  return undefined;
}

/** @deprecated use resolveProcessTemplateAppendFromMessages */
export function resolveResearchReportAppendFromMessages(
  messages: Array<{ role?: string; content?: unknown }>,
  language: PromptLanguage,
): string | undefined {
  return resolveProcessTemplateAppendFromMessages(messages, language);
}
