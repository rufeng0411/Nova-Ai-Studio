#!/usr/bin/env node
/**
 * Generate scripts/lib/capabilityTryPrompts.mjs from catalog + plan templates.
 * Run: node scripts/generate-capability-try-prompts.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HUB_SKILL_PACKS } from './lib/capabilityHubPacks.mjs';
import { CN_COMPLIANCE_TRY_PROMPTS } from './lib/cnComplianceTryPrompts.mjs';
import { CN_ENTERPRISE_CONSULT_TRY_PROMPTS } from './lib/cnEnterpriseConsultTryPrompts.mjs';
import { CN_ENTERPRISE_PR_TRY_PROMPTS } from './lib/cnEnterprisePrTryPrompts.mjs';
import { ENTERPRISE_MCP_BATCH1_TRY_PROMPTS } from './lib/enterpriseMcpBatch1Hub.mjs';
import { finalizeHubTryPrompt, hubPromptQualityIssues } from './lib/promptTemplateStrategy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');
const HUB_ZH_PATH = path.join(REPO_ROOT, 'config', 'capability-hub-zh.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'scripts', 'lib', 'capabilityTryPrompts.mjs');

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
const hubZh = JSON.parse(readFileSync(HUB_ZH_PATH, 'utf8'));

function zhName(slug, fallback) {
  const z = hubZh[slug]?.['zh-CN']?.display_name;
  return (z || fallback || slug).trim();
}

/** @type {Record<string, string>} */
const EXPLICIT = {
  // PD-SAAS-FORK: 企业合规前台卡 — 非专家可读填空模板（权威 scripts/lib/cnComplianceTryPrompts.mjs）
  ...CN_COMPLIANCE_TRY_PROMPTS,
  // PD-SAAS-FORK: 企业·公关前台卡（权威 scripts/lib/cnEnterprisePrTryPrompts.mjs）
  ...CN_ENTERPRISE_PR_TRY_PROMPTS,
  // PD-SAAS-FORK: 脑爆企业咨询 — 口语试一下（禁须交付）
  ...CN_ENTERPRISE_CONSULT_TRY_PROMPTS,
  // PD-SAAS-FORK: 企业 MCP 首批六卡
  ...ENTERPRISE_MCP_BATCH1_TRY_PROMPTS,
  'hub-pack-brand-website':
    '用「品牌官网全案」帮我：【写出要做的事，如：给新品牌做定位 / 写官网落地页文案 / 规划 SEO 关键词】，并附品牌背景。可做：品牌发现、定位、语气规范、落地页文案、SEO、转化优化、上线清单。',
  'hub-pack-ad-funnel':
    '用「广告漏斗全案」帮我：【如：出 10 条广告创意 / 优化落地页转化 / 制定投放预算】，附产品与目标人群。可做：广告创意、漏斗设计、落地页、付费投放、转化优化。',
  'hub-pack-aso':
    '用「应用商店优化」帮我：【如：挖关键词 / 改商店标题与描述 / 审计竞品 ASO】，附应用名称与商店链接。可做：关键词、元数据、截图方案、竞品分析、评论分析、Apple 搜索广告。',
  'hub-pack-threejs':
    '用「3D网页创作」做一个【产品或场景】的 3D 展示网页：【说明风格与交互，如：可拖拽旋转、滚动驱动动画】。可做：搭场景、调材质灯光、做动画、加交互。',
  'hub-pack-fal-video':
    '用「Fal多模态视频」帮我：【如：生成一支 10 秒产品短片 / 把这张图变成动态视频 / 批量出 3 版广告素材】（需配置 Fal Key）。可做：文生图、图生视频、口播视频、视频工作流。',
  'hub-pack-pm-toolkit':
    '用「PM工具包」帮我做产品工作：【如：给笔记 App 写 PRD / 排 Q3 路线图 / 做竞品对比】，并附产品背景。可做：PRD、路线图、竞品分析、用户故事、实验设计、GTM。',
  'hub-pack-pm-methods':
    '用「产品方法论」带我做一次工作坊式拆解：【选一个：机会方案树 / 用户旅程图 / 产品定位 / 用户故事地图】，对象是【产品或业务】。',
  'persona-buffett': '用「巴菲特思维」帮我评估：【贴上你的投资或商业决策】，从护城河、现金流与长期价值给判断。',
  'persona-duan-yongping': '用「段永平思维」帮我判断这个生意：【描述商业模式】，看它是否本分、能否长期赚钱。',
  'persona-steve-jobs': '用「乔布斯思维」帮我打磨：【产品或方案】，从核心体验与发布叙事给出尖锐意见。',
  'persona-elon-musk': '用「马斯克思维」用第一性原理拆解：【问题，如某项成本或技术路线】，找出突破口。',
  'persona-munger': '用「芒格思维」检查这个计划：【贴方案】，找出认知偏误与逆向风险。',
  'persona-feynman': '用「费曼思维」帮我真正搞懂：【概念或知识点】，讲到我能复述给别人听。',
  'persona-naval': '用「纳瓦尔思维」帮我设计个人杠杆路径：【你的职业现状与目标】。',
  'persona-taleb': '用「塔勒布思维」评估：【策略或计划】在极端情况下是否反脆弱，给加固建议。',
  'persona-zizek': '用「齐泽克思维」审视这份方案：【贴方案】，找出没明说但默认成立的前提。',
  'persona-trump': '用「特朗普思维」帮我设计这场谈判：【对手与目标】，给开场姿态与让步节奏。',
  'persona-zhang-yiming': '用「张一鸣思维」帮我梳理：【产品或团队问题】，给迭代优先级与组织建议。',
  'brainstorm-structured': '用「结构化脑暴（Superpowers）」围绕【主题】带我做一轮分步头脑风暴，最后整理成点子清单。',
  'fc-firecrawl-cli': '用「Firecrawl 联网抓取」帮我：【说明要搜索或抓取的页面/竞品 URL】（需 Firecrawl Key）。',
  'fc-firecrawl-search': '用「Firecrawl 搜索发现」围绕【关键词/主题】搜索并提取来源摘要（需 Firecrawl Key）。',
  'web-just-scrape': '用「轻量网页抓取」抓取【URL】正文并输出 markdown（可能需要 ScrapeGraph Key）。',
  'create-frontend-design': '用「前端设计规范」为【页面/组件】给出审美方向与实现建议，避免模板化 UI。',
  'create-ui-ux-pro-max': '用「UI/UX 专业审查」审查【页面或组件描述】，给出可用性与视觉层次改进清单。',
  'create-ai-video-gen': '用「AI 视频生成工作流」为【产品/主题】生成短视频脚本与分镜（需模型池视频 Key）。',
  'legal-risk-assessment': '用「法务风险评估」评估【合同/条款摘要】风险分级；注明非律师意见，须法务复核。',
  'legal-response': '用「法律回应草稿」起草对【函件/投诉】的初步回应；注明非律师意见，须法务复核。',
  'edu-fun-caveman': '用「趣味 CLI 学习」以轻松方式解释【概念】（非课纲，偏趣味探索）。',
  'mcp-playwright': '用「浏览器自动化 MCP」帮我：【说明要打开的页面或浏览器操作】。',
  'mcp-im-notify':
    '用「消息通知」向已配置通道发送一条文字（企微/钉钉/WhatsApp）。\n\n【你在做什么】调用出站通知 MCP；未配置时说明需管理员在后台「消息通道」配置。\n\n【请填写】\n- 通道：【企微 / 钉钉 / WhatsApp】\n- 正文：【要发送的内容】\n\n【请准备】需管理员已配置对应通道。\n\n【你会得到】发送成功或失败的简短说明。\n\n须交付：notify-result.md。\n写入系统分配任务目录。',
  humanizer: '用「去AI味润色」改写下面这段文字，让它读起来像真人写的：【粘贴文字】。',
  unslop: '用「去八股润色」修改下面的文字，去掉排比堆叠、套话开头和空洞词：【粘贴文字】。',
  'od-mobile-app': '用「手机界面示意」画【2026 FIFA 世界杯观赛指南】，FIFA 蓝金风格，三屏并排、带手机外框。第一步调用 scaffold_mobile_mockup（slug=world-cup-2026，preset=fifa-world-cup），再按需 edit_file 各屏。',
  'od-mobile-onboarding': '用「新手引导三屏」给【App】做首次打开引导：欢迎、价值说明、开始使用。',
  'od-dashboard': '用「数据看板页」做【业务】管理后台首页：左侧菜单、指标卡片、趋势图，用示例数据。',
  'html-ppt':
    '用「HTML 幻灯工作室」做 8 页【主题】技术分享 HTML 放映幻灯，主题 cyberpunk-neon，整稿 tech-sharing，按 SKILL 生成可全屏放映的 index.html。',
  'create-vid-scriptwriting': '用「程序化视频脚本」为【产品】做 30 秒产品演示 YAML 脚本：场景、帧数、旁白与动效说明。',
  'create-vid-saas-demo-script': '用「SaaS 演示分镜」为【SaaS 产品】写 60 秒功能演示逐镜分镜与 Remotion 时间轴。',
  'create-vid-seedance-prompt': '用「即梦分镜提示」为【主题】写 15 秒 Seedance 2.0 分镜提示词（含 @引用说明）。',
  'create-vid-seedance-codec': '用「即梦相机分镜」为【主题】规划 25 格分镜与长片分段策略（相机四维编码）。',
  'create-vid-visual-prompt': '用「影视镜头策划」把下面剧本拆成 14 字段镜头卡并写 Seedance 提示词：【粘贴剧本或梗概】。',
  'create-vid-director': '用「AI 导演分镜」以王家卫风格为【故事梗概】写镜头表与 keyframe 提示。',
  'create-vid-storyboard-pack': '用「连续性分镜包」为【广告创意】输出 continuity 分镜包：bible、镜头卡、交接矩阵。',
  'create-vid-seedance-series': '用「短剧分镜生成」把下面故事改编为四幕短剧剧本并写第 1 集 Seedance 分镜：【粘贴故事】。',
  'create-vid-viral-copy': '用「爆款视频文案」为【产品】写 3 条 30 秒爆款短视频口播脚本（含 hook）。',
  'viral-article-generator':
    '用「爆款长文生成」为【选题/行业热点】写一篇公众号气质长文（自动选风，禁问卷）。须交付：article-brief.md、article.md、quotes.md、channel-plan.md。\n写入系统分配任务目录。',
  'mkt-dmp-video-script': '用「营销视频脚本」为【产品】写一条 60 秒抖音营销视频脚本：3 秒 hook 与时间轴。',
  'mkt-brand-video': '用「品牌视频分镜」为【产品】做 15 秒品牌宣传片分镜（6–8 镜头），含旁白与画面说明。',
  'od-login-flow': '用「登录流程界面」设计【产品】的登录、注册和验证码三个页面，风格简洁。',
  'od-resume': '用「简历网页」把我的经历做成一页求职页面：【粘贴经历、技能与联系方式】。',
  'hf-gsap': '用「GSAP 动画模式库」给我的页面或视频加动效：【元素与想要的效果，如：标题弹性入场】。',
  'diagram-maker': '用「图表制作」把下面的内容画成图：【粘贴流程、结构或数据，并说明想要的图类型】。',
  'anth-canvas-design': '用「视觉画布设计」设计一张【海报或封面】：【主题、文字内容与风格】。',
  'create-ai-music': '用「AI音乐」帮我写一首歌：【主题、风格、时长】，输出歌词与编曲说明。',
  'create-color-expert': '用「配色专家」给【品牌或界面】出 3 套配色方案，附色值与使用场景。',
  'create-taste-skill': '用「审美规范」为【产品/品牌】做一页落地页 HTML，Anti-Slop 审美、先输出 Design Read。须交付：index.html。写入系统分配任务目录。',
  'create-taste-brandkit': '用「品牌视觉板」为【品牌名】生成品牌 kit 参考板与色板说明。须交付：brandkit.md。写入系统分配任务目录。',
  'create-taste-brutalist': '用「create-taste-brutalist」做【品牌/活动】Brutalist 风官网 landing。须交付 index.html。多页站点时 characters.html 与 index.html 同目录。写入系统分配任务目录；禁止 artifacts/design/ 语义目录；禁止 Task/subagent。',
  'create-taste-imagegen-web': '用「网页参考板」为【产品】生成 3 屏网页 UI 参考图板 prompt 与说明。须交付：web-moodboard.md。写入系统分配任务目录。',
  'create-taste-redesign': '用「站点改版审美」审计并改版【页面 URL 或描述】，保留品牌资产。须交付：index.html。写入系统分配任务目录。',
  'cyber-ppt': '用「Cyber 咨询PPT」把【研究报告/业务材料】做成 10 页 MBB 风可编辑 PPTX，SCR 叙事。须交付：presentation.pptx、slide_manifest.json、visual_qa_gate.json。写入系统分配任务目录。禁止 Task/subagent；走 nova-fast-path 快路径，禁止 ImageGen 全页蓝图。',
  'ppt-gorden-super': '用「Gorden 超级PPT」把【主题与要点】做成 8 页豪华图片幻灯并还原为可编辑 PPTX。须交付：presentation.pptx、slide-NN.png。写入系统分配任务目录。',
  'ppt-gorden-image-gen': '用「Gorden 图片PPT」生成 6 页【主题】豪华高密度图片型幻灯。须交付：slide-NN.png、presentation.pptx。写入系统分配任务目录。',
  'ppt-gorden-image2pptx': '用「Gorden 图转PPT」把【artifacts 内 slide PNG 路径】四层拆解为可编辑 PPTX。须交付：presentation.pptx。写入系统分配任务目录。',
  'create-ui-baseline-ui': '用「UI基线」为【产品】生成一套 UI 组件基线：按钮、表单、卡片与颜色变量。',
  'create-ui-fixing-accessibility': '用「无障碍修复」检查并修复这个页面的无障碍问题：【贴代码或页面路径】。',
  'create-ui-fixing-metadata': '用「页面元数据优化」补全这个页面的 title、description 与社交分享卡片：【页面路径或 URL】。',
  'create-ui-fixing-motion-performance': '用「动效性能优化」排查这个页面动画卡顿并优化：【页面路径或问题描述】。',
  'create-wonda': '用「wonda」帮我创作：【说明需求】。',
  'video-db-python': '用「视频库检索」把视频上传到 VideoDB 并按内容搜索片段：【视频来源与要找的内容】（需 VideoDB Key）。',
  'df-podcast-generation': '用「播客内容」把【主题或文章】改成一期播客脚本：开场、对谈要点与结尾。',
  'create-youtube-clipper':
    '用「YouTube 剪辑」处理这个视频：【粘贴 YouTube 链接】，分析章节后剪出精彩片段并配中英字幕。',
  'df-find-skills': '用「技能发现安装」帮我找：【想要的能力，如：自动生成周报】，列出可装的技能并装好。',
  'ala-code-reviewer': '用「代码审查」检查【文件或目录路径】的安全漏洞与质量问题，按严重程度列出并给修复建议。',
  'ala-debugger': '用「系统化调试」排查这个问题：【贴报错信息与复现步骤】，定位根因并修复。',
  'ala-fullstack-developer': '用「全栈开发」帮我实现：【功能需求，如：给项目加一个带登录的评论功能】。',
  'ala-python-expert': '用「Python 专家」帮我：【写脚本 / 优化代码 / 排错，贴需求或代码】。',
  'df-bootstrap': '用「AI 伙伴引导」陪我配置专属 AI 助手的性格与风格，一步步问我再生成配置。',
  'df-claude-to-deerflow': '用「DeerFlow 对接」把这个研究任务发给 DeerFlow：【研究主题】（需已部署 DeerFlow）。',
  'df-code-documentation': '用「代码文档生成」为【代码目录或仓库路径】生成 README 与 API 文档。',
  'df-skill-creator': '用「技能创建」帮我做一个新技能：【描述它要做什么】，写好并测试。',
  'df-smoke-test': '用「端到端冒烟测试」对【项目路径或服务地址】跑一轮部署与健康检查，输出测试报告。',
  'df-surprise-me': '用「创意组合展示」围绕【主题】随机组合几个技能，给我一个惊喜成果。',
  'df-vercel-deploy-claimable': '用「部署到 Vercel」把【项目路径】发布上线，给我预览链接。',
  'ala-project-planner': '用「项目拆解排期」把这个项目拆成任务与里程碑：【项目目标与期限】。',
  'ala-sprint-planner': '用「Sprint 规划」帮团队排下个迭代：【贴需求列表与团队人数】，输出故事点与 Sprint 目标。',
  'pilotdeck-skills-migration': '用「技能迁移」把我在【Claude Code 或其他工具】里的技能迁移进来，先扫描再批量导入。',
  'df-frontend-design': '用「前端界面设计」给【产品或页面】做一版高品质界面：【内容与风格偏好】。',
  'df-web-design-guidelines': '用「界面规范审查」对照 Web 设计规范检查【页面代码路径或 URL】，列出不合规项。',
  'anth-mcp-builder': '用「MCP构建」帮我搭一个 MCP 服务：【要接入的数据或工具】，写好代码并调通。',
  'dev-next-best-practices': '用「Next.js 实践」审查或搭建我的 Next.js 项目：【项目路径或需求】。',
  'dev-playwright': '用「浏览器自动化」帮我：【写 E2E 测试 / 自动化操作某网页，说明目标】。',
  'dev-sentry-sdk-setup': '用「Sentry 接入」给【项目路径】接入 Sentry 错误监控并验证上报。',
  'karpathy-guidelines': '用「AI 编码规范」审查【代码文件或目录】，按减少 AI 编码失误的准则列出问题与改法。',
  'df-ppt-generation': '用「PPT 生成」做一套演示稿：【主题 + 页数 + 用途，如：10 页融资路演】。',
  'frontend-slides': '用「HTML 演示」做【页数】页动画演示：【主题与风格】，横屏翻页、每页一屏。',
  'create-nanobanana-ppt': '用「AI 配图幻灯」把【主题】做成每页带 AI 配图的幻灯片。',
  'ala-editor': '用「专业润色」编辑下面的文稿，提升清晰度与可读性：【粘贴文稿】。',
  'ala-meeting-notes': '用「会议纪要」把这份记录整理成结构化纪要：【粘贴录音转写或速记】，列出决策与行动项。',
  'ala-technical-writer': '用「技术文档写作」为【项目或功能】写一份【README / 教程 / API 文档】。',
  'mcp-google-workspace': '用「Google 办公套件」帮我：【读或写哪个文档、表格、日历，说明内容】（需已连接 Google 账号）。',
  // mcp-notion-collab + 企业 MCP 首批：见 enterpriseMcpBatch1Hub.mjs（下方 merge）
  'anth-pptx': '用「PPT幻灯」生成一份可编辑的 PPT 文件：【主题与大纲要点】。',
  'anth-xlsx': '用「Excel表格」做一个 Excel 文件：【数据内容与想要的统计或图表】。',
  'office-ecom': '用「电商助手」处理电商运营任务：【商品文案 / listing 优化 / 活动方案】。',
  'office-epub': '用「电子书制作」把【文稿或章节目录】打包成 EPUB 电子书。',
  'office-nutrient': '用「文档API」处理文档：【转换 / 合并 / 加水印等，说明文件与目标格式】（需 Nutrient Key）。',
  'minimax-pdf': '用「高视觉质量 PDF」把【内容或文稿】排版成设计感强的 PDF 报告。',
  'pd-geo':
    '用「AI 搜索全案」给【品牌】做完整 AI 可见度包：审计清单、关键词、多平台成稿、optimized.md、评分验证与 HTML 周报。',
  'open-design':
    '用「设计总控」帮我做一个页面：【页面类型与内容，如：产品介绍页，含标题、三个功能、价格和试用按钮】，自动套用合适的设计系统，产出可预览网页。',
  'social-creative-matrix':
    '用「社媒矩阵包」把一条创意扩成国内 8 平台图文矩阵：【创意主题】，含 brief、创意锚点、copywriting、manifest 与 visuals/ 四套比例配图（各 generate_image 最多 1 次，禁止 VAP），先不发布。',
  'nova-customer-acquisition-leads':
    '用「Nova-智能获客」帮我找潜在客户：【行业 + 地区，如：北京的人工智能外包项目】，整理成结构化线索表格报告。',
  yixiaoer: '用「国内社媒发布」把这篇图文存到【平台，如小红书】草稿箱：【粘贴内容或文件】，先不公开发布。',
  'tool-generate-image': '用「对话生图」生成图片：【画面描述 + 数量 + 比例，如 3 张 16:9 露营装备主视觉】。',
  'tool-generate-video': '用「营销生视频」生成一段【时长与用途，如 8 秒抖音开场】视频：【画面描述与节奏】。',
  'tool-render-html-video': '用「HTML 转视频」把【HTML 页面路径】导出成【时长与分辨率，如 10 秒 1080p】MP4。',
  'tool-web-search': '用「联网搜索」查【主题】的最新资料，整理 5 条来源与要点。',
  'anth-docx': '用「Word文档」写一份【文档类型，如活动 brief / 新闻稿】并输出 Word 文件：【主题与要点】。',
  'edu-tutor-skills': '用「家教技能」当我的一对一家教：【年级 + 科目 + 今天要解决的问题】。',
  'edu-recursive-research': '用「教育调研」帮我调研：【教育相关主题】，多轮检索后给结构化报告。',
};

const PACK_HINTS = {
  'mkt-brand-': '品牌发现、定位、语气规范、落地页文案、SEO、转化优化、上线清单',
  'mkt-adv-': '广告创意、漏斗设计、落地页、付费投放、转化优化',
  'mkt-aso-': '关键词、元数据、截图方案、竞品分析、评论分析、Apple 搜索广告',
  'create-threejs-': '搭场景、调材质灯光、做动画、加交互',
  'fal-': '文生图、图生视频、口播视频、视频工作流',
  'pms-': 'PRD、路线图、竞品分析、用户故事、实验设计、GTM',
  'pmd-': '机会树、用户旅程、定位工作坊、用户故事地图',
};

function packPrompt(pack) {
  if (EXPLICIT[pack.slug]) return EXPLICIT[pack.slug];
  const hint = PACK_HINTS[pack.member_prefix] || '包内子技能';
  return `用「${pack.display_name}」帮我：【说明具体目标与背景】。可做：${hint}。`;
}

function templateForSlug(slug, name) {
  if (EXPLICIT[slug]) return EXPLICIT[slug];

  const pack = HUB_SKILL_PACKS.find((p) => p.slug === slug);
  if (pack) return packPrompt(pack);

  // Education: teacher lesson
  if (slug === 'teacher-lesson-planning') {
    return `用「老师备课」帮我设计一节课：【年级 + 课题】，输出教学目标、课堂活动、提问设计与配套练习。`;
  }
  if (slug.endsWith('-lesson-planning')) {
    const subj = name.replace(/备课$/, '') || name;
    return `用「${name}」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提问设计与配套练习。`;
  }

  // homework
  if (slug === 'teacher-homework-generation') {
    return `用「作业生成」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。`;
  }
  if (slug.endsWith('-homework-generation')) {
    return `用「${name}」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。`;
  }

  // unit review
  if (slug.endsWith('-unit-review')) {
    return `用「${name}」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。`;
  }

  // textbook sync
  if (slug.endsWith('-textbook-sync')) {
    return `用「${name}」陪我学：【年级册别 + 单元或课文】，先讲要点再出同步练习，错了帮我订正。`;
  }

  // exam review & sprint
  if (slug.endsWith('-exam-review') || slug.endsWith('-sprint') || slug === 'primary-final-review') {
    return `用「${name}」帮我备考：【年级 + 考试时间 + 薄弱章节】，先诊断再给两周复习计划。`;
  }

  // daily / quick practice
  if (slug.includes('daily-practice') || slug.includes('quick-practice')
    || slug.includes('vocabulary-daily') || slug.includes('mental-arithmetic')
    || slug.includes('dictation-daily') || slug.includes('recitation-daily')
    || slug.includes('reading-daily')) {
    if (slug.includes('dictation')) {
      return `用「${name}」出今天的听写练习：【年级 + 本周生字词】，做完帮我批改。`;
    }
    if (slug.includes('recitation')) {
      return `用「${name}」帮我背：【课文或古诗名】，分段检查能否完整复述。`;
    }
    if (slug.includes('mental-arithmetic')) {
      return `用「${name}」出今天 10 分钟口算：【年级 + 运算类型】，做完批改并讲错题。`;
    }
  if (slug.includes('vocabulary')) {
      return `用「${name}」出今天 10 分钟词汇练习：【年级 + 词表或单元】，做完批改。`;
    }
    if (slug.includes('reading-daily')) {
      return `用「${name}」出一篇阅读短练：【年级 + 文章或主题】，练读懂、找依据、组织答案。`;
    }
    return `用「${name}」出今天的 10 分钟练习：【年级 + 最近所学】，做完帮我批改并讲错题。`;
  }

  // preschool
  if (slug.startsWith('preschool-') || slug.startsWith('family-') || slug.startsWith('agent-parent')) {
    if (slug === 'preschool-growth-report') {
      return `用「学前成长观察报告」把这段时间的观察记录整理成成长报告：【贴观察记录】。`;
    }
    if (slug === 'preschool-school-readiness' || slug === 'preschool-family-readiness') {
      return `用「${name}」给孩子做幼小衔接准备计划：【孩子年龄与入学时间】。`;
    }
    if (slug.startsWith('family-')) {
      return `用「${name}」帮我处理：【具体家庭学习场景与现状】，给可执行方案。`;
    }
    if (slug === 'agent-parent-companion') {
      return `用「家长陪学」给我一套陪学脚本：【孩子年级 + 困扰场景】，少催促、可执行。`;
    }
    return `用「${name}」给孩子安排今天的小任务：【孩子年龄 + 当前情况】，要好玩、家长能照着做。`;
  }

  // agent-* learning
  if (slug.startsWith('agent-')) {
    const agentMap = {
      'agent-study-plan': '用「学习计划」帮我排学习计划：【年级 + 目标 + 每天可用时间】，拆到本周每天。',
      'agent-focus-training': '用「专注力训练」给孩子做专注训练方案：【年级 + 具体表现，如写作业坐不住】。',
      'agent-holiday-plan': '用「寒暑假提升」排假期计划：【年级 + 假期时长 + 想提升的科目】，学习与休息平衡。',
      'agent-homework-companion': '用「作业陪伴」陪孩子写今天的作业：【年级 + 作业内容】，卡住时给提示但不代写。',
      'agent-learning-habit': '用「学习习惯」帮孩子养成【习惯，如每天预习 15 分钟】：给固定触发动作与打卡表。',
      'agent-learning-report': '用「学情报告」把这些记录整理成学情报告：【贴练习与考试记录】，家长老师都能看懂。',
      'agent-memory-method': '用「记忆方法」帮我背【内容，如英语单词、古文】：设计可提取、可复习的记忆任务。',
      'agent-mistake-review': '用「错题复盘」分析这些错题：【贴错题】，找出错误模式并排追练计划。',
      'agent-photo-question': '用「拍照答疑」讲这道题：【拍照上传】，先讲思路再确认我听懂。',
      'agent-preview-assistant': '用「课前预习」帮我预习：【年级 + 明天要学的内容】，扫要点、标疑问、列课堂关注点。',
      'agent-review-assistant': '用「复习助手」带我复习【科目 + 范围】：先自测检索，再补漏与归纳。',
      'agent-socratic-tutor': '用「启发式讲解」教我【概念或题目】：用提问引导我自己想到答案。',
      'agent-weakness-boost': '用「薄弱项提升」攻克【薄弱点，如二次函数】：诊断、专项练习与复测。',
      'agent-weekly-review': '用「每周复盘」复盘这周学习：【贴本周情况】，输出进步、问题与下周行动。',
      'agent-question-explanation':
        '用「AI 讲题」讲这道题：【贴题目 + 年级】，用我能听懂的方式拆解，最后出一道变式题确认。',
    };
    if (agentMap[slug]) return agentMap[slug];
  }

  // college / exam prep
  if (slug.startsWith('college-') || slug.includes('-prep') || slug.includes('-sprint')
    || slug === 'civil-service-aptitude' || slug === 'civil-service-essay'
    || slug === 'adult-vocational-certificate' || slug === 'teacher-certification-sprint') {
    if (slug === 'college-academic-writing') {
      return `用「大学学术写作」改这段写作：【粘贴段落与课程要求】，理清论点与证据，规范引用。`;
    }
    if (slug === 'college-data-analysis') {
      return `用「学业·数据分析」完成课程数据分析：【贴数据与作业要求】，从清洗到结论与图表。`;
    }
    if (slug === 'college-cs-data-structure') {
      return `用「数据结构」教我【主题，如二叉树】：图示讲解、手写过程，再出一道练习。`;
    }
    if (slug === 'college-ai-foundation') {
      return `用「AI 基础」带我入门【主题，如大模型原理】：概念地图加一个能跑的小实验。`;
    }
    if (slug === 'college-cs-algorithm-interview') {
      return `用「算法面试」陪我练一道【题型，如动态规划】：先让我说思路，再纠正并复盘。`;
    }
    if (slug === 'college-cs-python') {
      return `用「Python 学习」教我【主题】：讲解加小练习，今天完成一个能运行的小成果。`;
    }
    if (slug === 'civil-service-essay') {
      return `用「公务员申论」陪我练申论：【贴题目或材料】，先写提纲，再逐段点评。`;
    }
    if (slug === 'adult-language-learning') {
      return `用「成人语言学习」陪我练【语言 + 场景，如英语商务会议】：今天完成一轮输入、输出与纠错。`;
    }
    if (slug === 'adult-workplace-writing') {
      return `用「职场写作」帮我写：【邮件 / 汇报 / 方案，说明对象与目的】，目标明确、行动可落地。`;
    }
    if (slug.includes('ielts') || slug.includes('toefl')) {
      return `用「${name}」帮我备考：【目标分数与考试时间】，听说读写诊断后给分项训练。`;
    }
    return `用「${name}」帮我备考：【考试时间与目前水平】，先诊断再给每日限时训练计划。`;
  }

  // reading / writing专项
  if (slug.includes('composition') || slug.includes('-essay') || slug.includes('-writing')
    || slug.includes('-reading') && slug.includes('chinese') || slug.includes('english-reading')) {
    if (slug.includes('writing') || slug.includes('composition') || slug.includes('essay')) {
      if (slug.includes('english')) {
        return `用「${name}」辅导这篇英语作文：【贴题目与草稿】，从任务回应、结构到句子逐层改。`;
      }
      return `用「${name}」辅导我这篇作文：【贴题目与我的草稿（没写也行）】，从审题立意到结构语言一步步改。`;
    }
    return `用「${name}」练这篇阅读：【贴文章与题目】，教我找依据、组织答案。`;
  }

  // academic research
  if (slug.startsWith('ora-') || slug === 'df-academic-paper-review' || slug === 'df-systematic-literature-review'
    || slug === 'ala-academic-researcher' || slug === 'anth-pdf' || slug === 'nova-research-academic-professional') {
    const oraMap = {
      'ora-brainstorm-research': '用「研究选题脑暴」围绕【研究方向】收敛选题：给 3 个可验证假设与实验设计草图。',
      'ora-research-manager': '用「研究项目管理」整理【课题】的文献、实验与笔记：输出研究日志与下周计划。',
      'ora-rigor-reviewer': '用「论文严谨性评审」评审这篇稿子：【附论文或草稿】，按审稿标准给分项评分与修改清单。',
      'ora-ml-paper-writing': '用「ML 论文撰写」基于【实验结果或仓库】写顶会风格论文初稿：摘要、方法与实验。',
      'ora-systems-paper-writing': '用「系统论文撰写」为【系统课题】写 OSDI/NSDI 风格大纲与引言初稿。',
      'ora-academic-plotting': '用「学术图表绘制」把【实验数据】画成论文级图表：折线与消融对比，输出 PDF/SVG。',
    };
    if (oraMap[slug]) return oraMap[slug];
    if (slug === 'anth-pdf') {
      return `用「PDF工具」处理这份 PDF：【提取正文 / 合并 / 整理成笔记，附文件】。`;
    }
    if (slug === 'nova-research-academic-professional') {
      return `用「Nova-学术专业」写【课题】专业报告：权威信源、严谨结构、参考文献可追溯。`;
    }
    if (slug === 'df-academic-paper-review') {
      return `用「学术论文评审」评阅这篇论文：【附文件】，分析方法、贡献与改进建议。`;
    }
    if (slug === 'df-systematic-literature-review') {
      return `用「系统文献综述」围绕【主题】做文献综述：检索、筛选、主题归纳与参考文献表。`;
    }
    if (slug === 'ala-academic-researcher') {
      return `用「学术写作助手」帮我：【文献综述 / 论文分析 / 写作润色，附材料与要求】。`;
    }
  }

  if (slug === 'teacher-class-analysis-lite') {
    return `用「班级学情分析」分析班级情况：【贴成绩、错题或课堂观察记录】，给出能立刻调整教学的判断。`;
  }
  if (slug === 'teacher-parent-report-lite') {
    return `用「家长反馈报告」把学生表现写成家长反馈：【贴学生情况】，客观、易懂、不制造焦虑。`;
  }

  // od-* design templates
  if (slug.startsWith('od-')) {
    if (slug === 'od-saas-landing') {
      return `用「官网落地页」做【产品】介绍页：醒目标题、三个核心功能、价格或试用按钮、页脚联系方式，风格简洁专业。`;
    }
    if (slug === 'od-waitlist-page') {
      return `用「候补名单页」做【产品】预发布页：品牌名、一句话价值、邮箱收集与提交成功态，风格简洁。`;
    }
    if (slug === 'od-web-prototype') {
      return `用「网页原型页」做【产品或场景】高保真原型：顶栏导航、至少三个内容区块，风格【简约/专业】。`;
    }
    if (slug === 'od-team-okrs') {
      return `用「团队 OKR 页」做【团队或季度】目标页：三个目标与关键结果进度条、负责人与状态。`;
    }
    if (slug === 'od-kanban-board') {
      return `用「看板任务板」做【项目】看板：待办/进行中/完成三列，每列若干示例卡片。`;
    }
    if (slug === 'od-meeting-notes') {
      return `用「会议纪要页」整理【会议主题】纪要：议题、决议与行动项（负责人+日期）。`;
    }
    if (slug === 'od-docs-page') {
      return `用「文档站点页」做【产品】帮助文档页：左侧目录与至少三章正文。`;
    }
    if (slug === 'od-blog-post') {
      return `用「博客文章页」写【主题】长文阅读页：标题、导语与分层正文。`;
    }
    if (slug === 'od-finance-report') {
      return `用「财务报告页」做【业务】经营摘要：四个 KPI 卡片与一张趋势图（示例数据并标注）。`;
    }
    if (slug === 'od-hr-onboarding') {
      return `用「入职引导页」做【公司】新人入职页：分步流程、待办清单与对接人。`;
    }
    if (slug === 'od-pm-spec') {
      return `用「产品规格页」写【功能】PRD 展示页：背景、需求列表与验收标准。`;
    }
    if (slug === 'od-gamified-app') {
      return `用「游戏化应用页」做【产品】游戏化界面示意：等级经验条、任务卡与奖励反馈。`;
    }
    if (slug === 'od-deck-swiss') {
      return `用「瑞士国际主义 Deck」做【主题】HTML 演示稿：至少四页、16 列网格、单一强调色。`;
    }
    if (slug === 'od-social-x-card') {
      return `用「X 分享卡片」做【金句或数据】16:9 分享卡：中央文案、作者署名与类型标签。`;
    }
    if (slug === 'od-poster-hero') {
      return `用「海报主视觉」做【活动】竖版海报：时间地点、三条亮点，底部留二维码位。`;
    }
    if (slug === 'od-image-gen') {
      return `用「生图存档」生成并保存一张【海报 / 封面 / 插画】图片文件：【画面描述与风格】。`;
    }
    if (slug.includes('video') || slug.includes('editorial') || slug.includes('swiss')
      || slug.includes('8bit') || slug.includes('digits') || slug.includes('field-notes')
      || slug.includes('weread')) {
      return `用「${name}」做【主题】的页面或视频分镜：【说明内容与风格】。`;
    }
    if (slug.includes('deck') || slug.includes('pricing') || slug.includes('faq')
      || slug.includes('release') || slug.includes('email') || slug.includes('social')
      || slug.includes('data-report') || slug.includes('article')) {
      return `用「${name}」做【主题或活动】：【说明必须出现的模块与风格】。`;
    }
    return `用「${name}」帮我做页面设计：【说明页面类型、内容与风格】。`;
  }

  // geo
  if (slug.startsWith('geo-')) {
    const geoMap = {
      'geo-content-optimizer': '用「AI可引用优化」改写下面的内容，让它更容易被 ChatGPT、Perplexity 等引用：【粘贴内容或 URL】。',
      'geo-seo-content-writer': '用「AI搜索成稿」写一篇面向 AI 搜索的长文：主题【主题】，目标关键词【关键词】，结构利于 AI 摘录。',
      'geo-citability': '用「AI引用评分」给这个页面打分：【URL 或粘贴内容】，输出可引用性评分与逐段改写建议。',
      'geo-competitor-analysis':
        '用「GEO竞品分析」对比【我的品牌】与【2-3 家竞品】在 AI 搜索中的可见度，输出差距与行动清单。逐模型收录全量矩阵请用 geo-monitor 三件套，本能力不重复矩阵。',
      'geo-keyword-research': '用「GEO挖词」为【品牌或产品】整理 AI 搜索关键词（20 个核心词与用户常问句式）。',
      'geo-aeo-audit': '用「AI可见审计」对【官网 URL】做四维 GEO 评分，输出修复清单与优先级。',
      'geo-on-page-audit': '用「页面可见审计」审计【页面 URL】：标题、结构、关键词与内链，列出优先修复项。',
      'geo-rank-track': '用「AI可见跟踪」给【品牌】建 AI 可见度跟踪表：本月基线与监测关键词。',
      'geo-technical-seo': '用「AI爬虫可达」检查【官网 URL】的技术 SEO：robots、llms.txt、结构化数据与可抓取性，输出修复清单。',
      'geo-visibility-probe':
        '用「大模型收录探测」对【品牌/产品/事件】做十一模型收录分析：国内必测豆包、DeepSeek、千问、百度、Kimi、腾讯元宝；国外必测 OpenAI、Gemini、Claude、Grok、Meta AI。8–12 条问句，输出 llm_coverage（11 行 models + gaps + optimization）。缺 Key 须 skipped 占位。完整报告由 geo-monitor-report 产出。',
      'geo-monitor-hub':
        '用「GEO 监测编排」为【品牌/产品/事件】聚合监测：先完成十一模型收录探测并写入 llm_coverage（必含全部 11 个 id），再合并 AgentAEO（可选），产出 monitor-data.json。勿重复全量探测。',
      'geo-monitor-report':
        '用「GEO 监测报告」读取 monitor-data.json，生成 monitor-report.md + geo-monitor-report.html，须含主流大模型收录分析、缺口与 P0/P1 优化建议。',
      'geo-cn-crawlers':
        '用「国内 AI 爬虫可达」检查【官网】对通义/豆包/文心等爬虫的可达性与 llms.txt，输出修复建议（技术层，不含逐模型收录矩阵）。',
    };
    if (geoMap[slug]) return geoMap[slug];
  }

  // mkt-*
  if (slug.startsWith('mkt-')) {
    const mktMap = {
      'mkt-copywriting': '用「广告文案」写【产品】的落地页文案：标题、三个卖点、行动按钮与 FAQ，语气专业简洁。',
      'mkt-social': '用「社媒内容与日历」为【产品】排两周内容日历，含 5 条短视频脚本与发布时间。',
      'mkt-campaign-plan': '用「活动全案」写【活动，如 618 大促】完整方案：目标、人群、渠道、内容日历与 KPI。',
      'mkt-image': '用「营销生图」生成【数量与用途，如 3 张新品宣传图】：【画面内容、风格与尺寸】。',
      'mkt-seo-audit': '用「SEO 审计」给【网站域名】做全站体检：技术问题、内容缺口与优先修复清单。',
      'mkt-ai-seo': '用「AI 可见度快检」给【品牌或官网】做一轮 AI 搜索可见度快检，列出优先改进项。',
      'mkt-performance-report': '用「投放效果报告」把【渠道数据】整理成一页效果报告：核心指标、趋势与建议。',
      'mkt-draft-content': '用「渠道草稿」按我的内容计划起草本周待发内容：【贴主题或日历】，每个渠道一版。',
      'mkt-campaign-report': '用「结案报告」把这次活动整理成结案报告（PDF 或 Word）：【粘贴活动数据与亮点】。',
      'mkt-pitch-deck': '用「比稿演示稿」做一份 10 页可编辑 PPT：主题【提案主题】，用于【客户提案或内部汇报】。',
      'mkt-campaign-budget': '用「活动预算表」做【活动】预算表：渠道、金额、周期与备注，输出 Excel。',
      'mkt-strategy-deck': '用「策略汇报 PPT」把【策略方案】整理成 12 页可汇报演示稿：【粘贴方案要点】。',
      'mkt-go-live-checklist': '用「上线检查清单」为【网站或产品】出发布前核对清单：SEO、结构化数据与渠道就绪。',
      'mkt-programmatic-seo': '用「程序化SEO」规划批量落地页：【品类与变量，如「城市 × 服务」】，输出页面模板与生成清单。',
      'mkt-review-mining': '用「评论舆情挖掘」分析这批评论：【粘贴评论或来源链接】，提炼主题、情感与产品痛点。',
      'mkt-competitive-intel': '用「竞争情报摘要」汇总【竞品】近 30 天动态，给 3 条应对建议。',
      'mkt-customer-research': '用「客户调研」整理【产品】的客户洞察：【贴访谈、问卷或评论素材】，输出 ICP 画像与痛点清单。',
      'mkt-content-creation': '用「营销内容创作」为【产品或活动】各写一条【渠道，如 LinkedIn 帖 + 小红书文案】。',
      'mkt-email-sequence': '用「邮件序列」为【产品】写 5 封新用户邮件：欢迎、价值、案例、催活、转化，各附主题行。',
      'mkt-cold-email': '用「冷邮件」写一组 B2B 开发信：目标客户【行业或职位】，产品【产品】，含首封与 2 封跟进。',
    };
    if (mktMap[slug]) return mktMap[slug];
  }

  // nova research
  if (slug.startsWith('nova-research-')) {
    const novaMap = {
      'nova-research-competitor': '用「Nova-竞品对标」对【品类】做竞品全量对标：竞品清单、维度对比与突围策略。',
      'nova-research-general': '用「Nova-通用调研」围绕【主题】写综合调研报告：背景、发现、舆情与建议。',
      'nova-research-industry-market': '用「Nova-行业市场」写【行业】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。',
      'nova-research-user-general': '用「Nova-用户研究」做【产品或人群】的八段式用户研究：画像、场景、痛点与决策因素。',
      'nova-research-product-user': '用「Nova-产品用研」为【产品】写产品用户研究报告，按固定八章展开。',
    };
    if (novaMap[slug]) return novaMap[slug];
  }
  if (slug === 'nova-ppt-aesthetic-slides') {
    return `用「Nova-美学幻灯」把【主题】做成【页数，如 4】页【画幅，如 16:9】配图 PNG 幻灯：outline → 页描述 → 逐页生图，逐页 slide-NN.png + slide-manifest.json，不要 HTML。`;
  }

  // PD-SAAS-FORK: enterprise compliance / PR front cards (fallback if EXPLICIT miss)
  if (slug.startsWith('comp-') || slug === 'mcp-cn-central-policy') {
    if (CN_COMPLIANCE_TRY_PROMPTS[slug]) return CN_COMPLIANCE_TRY_PROMPTS[slug];
    if (CN_ENTERPRISE_PR_TRY_PROMPTS[slug]) return CN_ENTERPRISE_PR_TRY_PROMPTS[slug];
  }

  // PD-SAAS-FORK: outbound IM notify MCP
  if (slug === 'mcp-im-notify') {
    return '用「消息通知」向已配置通道发送一条文字（企微/钉钉/WhatsApp）。\n\n【你在做什么】调用出站通知 MCP；未配置时说明需管理员在后台「消息通道」配置。\n\n【请填写】\n- 通道：【企微 / 钉钉 / WhatsApp】\n- 正文：【要发送的内容】\n\n【请准备】需管理员已配置对应通道。\n\n【你会得到】发送成功或失败的简短说明。\n\n须交付：notify-result.md。\n写入系统分配任务目录。';
  }

  // mcp / tools / hf / df marketing
  if (slug.startsWith('mcp-')) {
    return `用「${name}」帮我：【说明要查的数据或要执行的操作】（需已连接对应服务）。`;
  }
  if (slug.startsWith('hf-')) {
    if (slug === 'hf-website-to-video') {
      return `用「网站一键成片」抓取【网址】，自动产出一支【时长，如 25 秒】品牌宣传视频。`;
    }
    if (slug === 'hf-hyperframes') {
      return `用「HTML 代码做视频」做一支【时长】视频：【画面与节奏，如：标题淡入 + 背景视频 + 轻音乐】。`;
    }
    return `用「${name}」：【说明视频目标、时长与风格】。`;
  }
  if (slug === 'remotion-video') {
    return `用「React 程序化视频」搭一个【用途】视频模板：【要参数化的内容，如标题与数字】，方便批量渲染。`;
  }
  if (slug.startsWith('df-deep-research') || slug === 'df-github-deep-research' || slug === 'df-consulting-analysis') {
    if (slug === 'df-deep-research') {
      return `用「深度调研」围绕【研究主题】做多源调研：先列信息源，再给带结论的综述。`;
    }
    if (slug === 'df-github-deep-research') {
      return `用「GitHub 竞品调研」研究【仓库或开源方向】：项目对比、活跃度与竞争格局。`;
    }
    return `用「咨询分析」就【课题】写一份咨询级研究报告：框架化分析与结论建议。`;
  }
  if (slug.startsWith('df-') && !slug.startsWith('df-')) { /* noop */ }
  if (slug.startsWith('ala-')) {
    return `用「${name}」帮我：【说明具体任务与背景】。`;
  }

  // tool-*
  if (slug.startsWith('tool-')) {
    return `用「${name}」：【说明输入内容与期望产出】。`;
  }

  // Default: clean professional template
  return `用「${name}」帮我：【说明具体场景、目标与必须包含的信息】。`;
}

const visible = catalog.skills.filter((s) => !s.hidden_in_hub);
const prompts = {};
let missing = 0;

for (const skill of visible) {
  const name = zhName(skill.slug, skill.display_name);
  const base = templateForSlug(skill.slug, name);
  const prompt = finalizeHubTryPrompt(base, {
    slug: skill.slug,
    name,
    majorCategory: skill.major_category ?? skill.majorCategory,
  });
  if (!prompt || hubPromptQualityIssues(prompt).length > 0) {
    missing += 1;
  }
  prompts[skill.slug] = prompt;
}

// Ensure hub packs from HUB_SKILL_PACKS even if not in visible (they should be)
for (const pack of HUB_SKILL_PACKS) {
  if (!prompts[pack.slug]) {
    prompts[pack.slug] = finalizeHubTryPrompt(packPrompt(pack), {
      slug: pack.slug,
      name: pack.display_name,
      majorCategory: 'marketing',
    });
  }
}

const out = `/**
 * Hub「试一下」中文提示词（自动生成，勿手改）
 * Source: scripts/generate-capability-try-prompts.mjs
 * Visible skills: ${visible.length}
 */
import { hubPromptQualityIssues } from './promptTemplateStrategy.mjs';

/** @type {Record<string, string>} */
export const TRY_PROMPT_ZH = ${JSON.stringify(prompts, null, 2)};

export function getTryPromptZh(slug, displayName = '') {
  const direct = TRY_PROMPT_ZH[slug];
  if (direct) return direct;
  const name = (displayName || slug).trim();
  return \`用「\${name}」帮我：【说明具体场景、目标与必须包含的信息】。\`;
}

export function assertTryPromptQuality() {
  const bad = [];
  for (const [slug, text] of Object.entries(TRY_PROMPT_ZH)) {
    for (const reason of hubPromptQualityIssues(text)) {
      bad.push({ slug, reason });
    }
  }
  if (bad.length > 0) {
    throw new Error(\`try-prompt quality: \${bad.length} issue(s): \${bad.slice(0, 5).map((b) => \`\${b.slug}(\${b.reason})\`).join(', ')}\`);
  }
  return bad;
}
`;

writeFileSync(OUTPUT_PATH, out, 'utf8');
console.log(`Wrote ${Object.keys(prompts).length} prompts to ${OUTPUT_PATH}`);
if (missing) console.warn(`Warning: ${missing} prompts may need manual review`);
