# 全案模板目录（自动生成）

> 生成时间：2026-08-19T16:48:08.024Z · 源文件 `config/process-templates.json`

| 类别 | 数量 |
|------|------|
| 营销 (`marketing`) | 20 |
| 企业 (`enterprise`) | 7 |
| GEO (`geo`) | 9 |
| 办公 (`office`) | 3 |
| 创作 (`creation`) | 6 |

## 模板列表

### 品牌广告·分镜到即梦 (`ad-storyboard-seedance`)

- **类别**：marketing · **体量徽章**：standard · 4 步
- **成果**：镜头卡 + 导演分镜 + 即梦 prompt 包（可选试渲染样片）
- **场景**：TVC/信息流广告，要先专业分镜再 AI 出片或交接即梦
- **流程**：影视镜头策划卡 → AI 导演分镜 → 即梦分镜提示词 → 试渲染关键镜头（可选）
- **产出物**：01-shot-cards.md + 02-director-board.md + 03-seedance-prompts.md（+ 可选 preview.mp4）
- **关联能力**：create-vid-visual-prompt, create-vid-director, create-vid-seedance-prompt, tool-generate-video

### 品牌传播 Campaign 全案 (`brand-campaign-full`)

- **类别**：marketing · **体量徽章**：full · 7 步
- **成果**：调研→Campaign 策划→brief→主视觉→多平台内容→发布→监测
- **场景**：一场品牌/活动传播战役（需蚁小二）
- **流程**：受众&环境调研 → Campaign 策划 → 传播 brief(Word) → 主视觉海报 → 多平台文案+配图 → 发布草稿 → 监测复盘模板
- **产出物**：调研 .md + brief .docx + 海报 + 社媒包 + 草稿编号 + 监测模板
- **关联能力**：mkt-customer-research, mkt-campaign-plan, anth-docx, od-poster-hero, social-creative-matrix, yixiaoer, mkt-campaign-report

### 活动复盘闭环 (`campaign-retrospective`)

- **类别**：marketing · **体量徽章**：standard · 3 步
- **成果**：数据分析 + Word 复盘报告 + 下一轮策略
- **场景**：一场活动/投放结束后复盘
- **流程**：投放效果分析 → Word 复盘报告 → 下一轮优化动作
- **产出物**：分析 .md + 复盘 .docx + 策略 .md
- **关联能力**：mkt-performance-report, anth-docx, mkt-marketing-plan

### Campaign 策划交付包 (`campaign-strategy-pack`)

- **类别**：marketing · **体量徽章**：standard · 4 步
- **成果**：Campaign 计划 + 策略演示稿 + Word 摘要
- **场景**：比稿或内部立项，需要完整策划物料
- **流程**：竞品与市场速览 → Campaign 计划 → 策略演示稿 → Word 策划摘要
- **产出物**：competitive-brief.md + campaign-plan.md + strategy-deck.html + summary.docx
- **关联能力**：mkt-competitive-brief, mkt-campaign-plan, mkt-strategy-deck, anth-docx

### 竞品与口碑快览 (`competitive-intel-quick`)

- **类别**：marketing · **体量徽章**：light · 2 步
- **成果**：竞品简报 + 品牌提及/口碑要点
- **场景**：立项或比稿前快速摸清竞品与舆论环境
- **流程**：竞品对照简报 → 口碑与提及挖掘
- **产出物**：competitive-brief.md + sentiment-notes.md
- **关联能力**：mkt-competitive-brief, mkt-review-mining

### 竞品对比落地页 (`competitor-landing`)

- **类别**：marketing · **体量徽章**：light · 2 步
- **成果**：竞品调研结论 + 一页对比落地页
- **场景**：比稿/销售场景，要「我们 vs 竞品」页面
- **流程**：竞品调研简报 → 对比落地页(HTML)
- **产出物**：调研 .md + 对比页 .html
- **关联能力**：mkt-competitive-brief, od-pricing-page

### 内容营销飞轮 (`content-flywheel`)

- **类别**：marketing · **体量徽章**：standard · 3 步
- **成果**：选题 + 一篇长文 + 多条社媒切片
- **场景**：用一个主题持续产内容
- **流程**：选题（主+子） → 长文 → 拆成 3–5 条社媒短内容
- **产出物**：选题 .md + 长文 .md + 社媒切片 .md
- **关联能力**：mkt-content-strategy, mkt-copywriting, mkt-social

### 内容 IP 启动全案 (`content-ip-full`)

- **类别**：marketing · **体量徽章**：full · 5 步
- **成果**：内容策略→系列长文→社媒矩阵→Newsletter→复盘
- **场景**：从零做一个内容账号/IP
- **流程**：内容策略 → 2 篇支柱长文 → 社媒矩阵切片+配图 → Newsletter → 复盘与下期选题
- **产出物**：策略 .md + 长文×2 + 社媒包 + newsletter .md + 复盘 .md
- **关联能力**：mkt-content-strategy, mkt-copywriting, social-creative-matrix, df-newsletter-generation, ala-data-analyst

### 落地页获客套件 (`landing-acquisition-kit`)

- **类别**：marketing · **体量徽章**：standard · 3 步
- **成果**：落地页 + 引流磁铁 + 邮件序列
- **场景**：新功能/产品获客上线
- **流程**：落地页(HTML) → 引流磁铁资源 → 3–5 封培育邮件
- **产出物**：landing .html + 磁铁 .md + 邮件序列 .md
- **关联能力**：od-saas-landing, mkt-lead-magnets, mkt-emails

### 一文多发内容矩阵 (`one-article-matrix`)

- **类别**：marketing · **体量徽章**：standard · 3 步
- **成果**：五平台改写稿 + 每平台配图（人味化润色）
- **场景**：一篇长文拆成多平台可发版本
- **流程**：长文定稿 → 五平台改写 → 人味化润色+配图
- **产出物**：5 份稿件 + 5 张配图
- **关联能力**：ala-content-writer, social-creative-matrix, humanizer, od-image-gen

### 名人脑爆→观点长文 (`persona-debate-article`)

- **类别**：marketing · **体量徽章**：light · 3 步
- **成果**：辩论纪要 + 观点长文 + 金句卡片
- **场景**：用多位大师视角碰撞后写成深度长文
- **流程**：三位大师辩论 → 观点合成长文 → 金句配图卡片
- **产出物**：debate.md + article.md + 3 张金句卡片
- **关联能力**：persona-munger, persona-elon-musk, persona-steve-jobs, ala-content-writer, od-image-gen

### 正式通稿包 (`press-release-pack`)

- **类别**：marketing · **体量徽章**：light · 2 步
- **成果**：一篇正式新闻通稿 + 一张配套头图
- **场景**：要对外发稿，需要 Word 通稿配主图
- **流程**：写新闻通稿(Word) → 生成主题一致的头图
- **产出物**：1 个 .docx + 1 张 .png
- **关联能力**：anth-docx, od-image-gen

### 新品上市全案 (`product-launch-full`)

- **类别**：marketing · **体量徽章**：full · 7 步
- **成果**：调研→策略→通稿→落地页→社媒矩阵→上线检查→发布草稿
- **场景**：一个新品从 0 到对外发布的整套物料（需蚁小二）
- **流程**：竞品&人群调研 → GTM 策略 → Word 通稿 → 落地页 → 社媒矩阵 → 上线检查清单 → 发布草稿
- **产出物**：调研/策略 .md + 通稿 .docx + landing .html + 社媒矩阵包 + 草稿编号
- **关联能力**：mkt-competitive-brief, mkt-marketing-plan, mkt-go-live-checklist, anth-docx, open-design, social-creative-matrix, yixiaoer

### 调研报告交付 (`research-report`)

- **类别**：marketing · **体量徽章**：standard · 3 步
- **成果**：深度调研 + 图表 + 正式 Word 报告
- **场景**：要给客户/上级一份像样的调研报告
- **流程**：深度调研综述 → 关键数据图表 → 整合并导出 Word
- **产出物**：调研 .md + 图表（Mermaid/表格）+ export_document 导出 .docx
- **关联能力**：df-deep-research, pd-document-export

### SaaS 增长全案 (`saas-growth-full`)

- **类别**：marketing · **体量徽章**：full · 8 步
- **成果**：调研→定位定价→官网→SEO 页→邮件→投放→复盘
- **场景**：SaaS 产品系统性获客增长
- **流程**：市场&竞品调研 → 定位定价 → 官网落地页 → 程序化 SEO 页模板 → AI 搜索可见度基线 → 邮件培育 → 投放计划 → 复盘模板
- **产出物**：8 项增长全案文件（含 geo 基线与复盘模板）
- **关联能力**：mkt-customer-research, mkt-pricing, od-saas-landing, mkt-programmatic-seo, pd-geo, mkt-emails, mkt-ads, ala-data-analyst

### 销售 Battlecard 全链路 (`sales-battlecard-full`)

- **类别**：marketing · **体量徽章**：standard · 3 步
- **成果**：竞品情报 + Battlecard + 销售话术
- **场景**：销售比稿前需要一页纸+异议回应
- **流程**：竞争情报 → Battlecard → 销售话术
- **产出物**：intel.md + battlecard.md + talk-track.md
- **关联能力**：mkt-competitive-intel, pms-competitive-battlecard, mkt-sales-enablement

### 单条爆款社媒 (`single-social-post`)

- **类别**：marketing · **体量徽章**：light · 2 步
- **成果**：一条平台风格图文 + 存入草稿
- **场景**：日常单条种草/发帖（需已配置蚁小二）
- **流程**：文案+配图建议 → 存平台草稿（不公开）
- **产出物**：文案 .md + 草稿任务编号
- **关联能力**：mkt-social, yixiaoer

### 社媒矩阵一条龙 (`social-matrix-pipeline`)

- **类别**：marketing · **体量徽章**：standard · 4 步
- **成果**：一条创意 → 多平台文案 + visuals/ 四套配图 + manifest
- **场景**：一个主题全平台同步发图文（默认只落盘，不推草稿）
- **流程**：brief + 创意锚点 → 四套配图(9:16/3:4/1:1/16:9) → 多平台文案 → manifest 打包交付
- **产出物**：brief + 四套配图(visuals/) + copywriting + manifest
- **关联能力**：social-creative-matrix

### 口播爆款·脚本包 (`viral-talking-script`)

- **类别**：marketing · **体量徽章**：light · 2 步
- **成果**：3 条 hook 候选 + 带时间轴的完整口播脚本
- **场景**：抖音/小红书/Reels 口播，先写稿再拍或 TTS
- **流程**：爆款结构与 hook → 营销口播脚本精修
- **产出物**：01-hooks.md + 02-script-timed.md（+ 可选 preview-8s.mp4）
- **关联能力**：create-vid-viral-copy, mkt-dmp-video-script, tool-generate-video

### 小红书爆款工厂 (`xhs-hit-factory`)

- **类别**：marketing · **体量徽章**：standard · 3 步
- **成果**：选题表 + 3 组图文笔记与封面
- **场景**：批量产出小红书风格图文笔记
- **流程**：热点与对标调研 → 5 选题+3 篇笔记 → 润色+竖版封面
- **产出物**：topics.md + 3 组笔记+封面
- **关联能力**：nova-research-user-general, yixiaoer, humanizer, od-image-gen

### 招标解析与标书草案 (`cn-bid-response-pack`)

- **类别**：enterprise · **体量徽章**：full · 3 步
- **成果**：招标解析报告 + 商务标草案 + 技术标草案
- **场景**：有招标文件，需要解析并起草商务/技术标骨架
- **流程**：解析招标 → 商务标草案 → 技术标草案
- **产出物**：招标文件解析报告.md + 商务标草案.md + 技术标草案.md
- **关联能力**：bid-analysis, bid-commercial-proposal, bid-tech-proposal

### 出纳月结核对包 (`cn-cashier-month-pack`)

- **类别**：enterprise · **体量徽章**：light · 2 步
- **成果**：出纳日常核对清单 + 发票增值税要点
- **场景**：月末核对开票/进项与税额
- **流程**：发票进项核对 → 出纳清单
- **产出物**：出纳日常核对清单.md + 发票与增值税合规要点.md
- **关联能力**：tax-invoice-compliance-checker, tax-input-tax-credit-checker

### 商事合同审查包 (`cn-contract-review-pack`)

- **类别**：enterprise · **体量徽章**：standard · 3 步
- **成果**：合同审查意见书 + 红线改法清单
- **场景**：上传或粘贴合同，需要风险意见与改法方向
- **流程**：通读合同 → 审查意见 → 红线改法清单
- **产出物**：合同审查意见书.md + 合同红线改法清单.md
- **关联能力**：zh-contract-review, zhxx-contract-review

### 主体与隐私合规入门 (`cn-entity-privacy-pack`)

- **类别**：enterprise · **体量徽章**：light · 2 步
- **成果**：经营主体检查清单 + 个人信息保护评估草稿
- **场景**：新设或自查公司主体与收集个人信息是否合规
- **流程**：主体合规速查 → 隐私合规评估
- **产出物**：经营主体合规检查清单.md + 个人信息保护合规评估.md
- **关联能力**：zh-entity-compliance, zh-pia-generation

### 用工录用与解除包 (`cn-labor-hire-exit-pack`)

- **类别**：enterprise · **体量徽章**：standard · 2 步
- **成果**：录用审查意见 + 解除终止风险意见
- **场景**：招人入职或协商/解除离职需要程序与风险提示
- **流程**：录用审查 → 解除风险
- **产出物**：录用审查意见.md + 解除终止风险意见.md
- **关联能力**：zh-hiring-review, zh-termination-review

### 惠企政策与申报清单 (`cn-policy-subsidy-pack`)

- **类别**：enterprise · **体量徽章**：standard · 2 步
- **成果**：政策检索摘要 + 补贴申报材料清单
- **场景**：想找惠企/资质政策并弄清要准备哪些材料
- **流程**：政策检索 → 申报材料清单
- **产出物**：政策检索摘要.md + 补贴申报材料清单.md
- **关联能力**：comp-policy-search

### 法务风险快检 (`legal-risk-quick`)

- **类别**：enterprise · **体量徽章**：light · 2 步
- **成果**：风险评估 + 回应草稿（非律师意见）
- **场景**：收到合同/函件需快速分级与草稿
- **流程**：风险评估 → 回应草稿
- **产出物**：risk-assessment.md + response-draft.md
- **关联能力**：legal-risk-assessment, legal-response

### AI 可引用内容优化 (`ai-citable-content`)

- **类别**：geo · **体量徽章**：light · 2 步
- **成果**：成稿优化 + 引用评分报告
- **场景**：已有文章/落地页，想提升被 AI 引用概率
- **流程**：可引用性改写 → 引用评分报告
- **产出物**：optimization-report.md + optimization-report.html + optimized.md + citability-report.md + citability-report.html
- **关联能力**：geo-content-optimizer, geo-citability

### GEO 基线调研包 (`geo-baseline-pack`)

- **类别**：geo · **体量徽章**：light · 3 步
- **成果**：关键词 + 竞品 + AI 可见度清单
- **场景**：品牌首次进入 GEO Tab 基线阶段
- **流程**：关键词与问句 → 竞品可见度 → AI 可见度清单
- **产出物**：keywords.md + keywords.html + competitor-visibility.md + competitor-visibility.html + audit-checklist.md + audit-checklist.html
- **关联能力**：geo-keyword-research, geo-competitor-analysis, mkt-ai-seo

### 品牌 GEO 全案 (`geo-brand-full`)

- **类别**：geo · **体量徽章**：full · 7 步
- **成果**：标准包 + JSON-LD + 可选社媒草稿
- **场景**：品牌要在 AI 搜索与多平台内容同时布局（可选蚁小二草稿）
- **流程**：AEO/GEO 审计 → 关键词与多平台成稿 → AI 可引用内容优化 → JSON-LD 结构化数据 → 引用评分与验证 → HTML 周报 → 存平台草稿（不公开）
- **产出物**：geo 全套文件 + schema.jsonld + 可选草稿编号
- **关联能力**：geo-aeo-audit, pd-geo, geo-content-optimizer, mkt-schema, geo-citability, od-data-report, yixiaoer

### GEO 监测仪表盘 (`geo-monitor-dashboard`)

- **类别**：geo · **体量徽章**：standard · 3 步
- **成果**：主流大模型收录矩阵 + 优化建议 + HTML 仪表盘
- **场景**：geo_monitor 主入口：品牌/产品/事件的大模型收录分析
- **流程**：大模型收录采集 → 监测编排 → 可视化报告
- **产出物**：monitor-data.json + monitor-report.md + geo-monitor-report.html
- **关联能力**：geo-monitor-hub, geo-monitor-report, geo-visibility-probe, mcp-agent-aeo

### AI 可见度监测闭环 (`geo-monitor-loop`)

- **类别**：geo · **体量徽章**：standard · 4 步
- **成果**：主流大模型收录矩阵 + 优化建议 + HTML 监测报告
- **场景**：持续监测品牌/产品/事件在各主流大模型中的收录与可见度
- **流程**：大模型收录探测 → 品牌提及监测 → 监测数据聚合 → 双格式监测报告
- **产出物**：monitor-report.md + geo-monitor-report.html + monitor-data.json
- **关联能力**：geo-visibility-probe, mkt-brand-mention, geo-monitor-hub, geo-monitor-report

### GEO 监测周报对比 (`geo-monitor-weekly`)

- **类别**：geo · **体量徽章**：light · 2 步
- **成果**：收录得分趋势对比 + 优化建议更新
- **场景**：周期复跑监测
- **流程**：复跑采集与对比 → 趋势报告
- **产出物**：monitor-data.json（含 trend）+ 双格式报告
- **关联能力**：geo-monitor-hub, geo-monitor-report

### GEO 技术结构包 (`geo-technical-pack`)

- **类别**：geo · **体量徽章**：standard · 4 步
- **成果**：AEO 审计 + 技术 SEO + schema + 国内爬虫
- **场景**：站点 AI 可达与技术基线一次性检查
- **流程**：AEO 快检 → 技术 SEO → 结构化数据 → 国内 AI 爬虫
- **产出物**：aeo-audit.md + aeo-audit.html + technical-seo-audit.md + technical-seo-audit.html + schema.jsonld + llms.txt
- **关联能力**：geo-aeo-audit, geo-technical-seo, mkt-schema, geo-cn-crawlers

### AI 可见度快检 (`geo-visibility-quick`)

- **类别**：geo · **体量徽章**：light · 2 步
- **成果**：审计清单 + 关键词与验证问句
- **场景**：先摸清品牌在 AI 搜索里的可见度缺口
- **流程**：AEO/GEO 审计 → 关键词与验证问句
- **产出物**：aeo-audit-checklist.md + geo-aeo-audit-checklist.md + aeo-audit.html + keywords.md + keywords.html + verification-plan.md
- **关联能力**：geo-aeo-audit, mkt-ai-seo, pd-geo

### AI 搜索可见度标准包 (`geo-visibility-standard`)

- **类别**：geo · **体量徽章**：standard · 5 步
- **成果**：审计+关键词+双平台成稿+评分验证+HTML 周报
- **场景**：系统化提升品牌在 AI 回答中的提及与引用
- **流程**：AEO/GEO 审计 → 关键词与双平台成稿 → AI 可引用内容优化 → 评分与提及验证 → HTML 可见度周报
- **产出物**：5 项 geo 标准包（含 visibility-report.html）
- **关联能力**：geo-aeo-audit, pd-geo, geo-content-optimizer, od-data-report

### 资料→课件→随堂测验 (`doc-to-course`)

- **类别**：office · **体量徽章**：standard · 3 步
- **成果**：知识点提纲 + 教学课件 + 测验卷
- **场景**：把 PDF/文档变成可教可测的学习包
- **流程**：拆知识点 → 教学课件 → 随堂测验
- **产出物**：knowledge.md + course slides + quiz.md
- **关联能力**：anth-pdf, teacher-lesson-planning, teacher-homework-generation

### 报告→四格式交付包 (`md-html-office-pack`)

- **类别**：office · **体量徽章**：light · 2 步
- **成果**：一份 Markdown 报告 + PDF + Word + 可编辑 PPT
- **场景**：写完调研/结案 Markdown 后一键导出多种办公格式
- **流程**：撰写报告 → 一键导出
- **产出物**：report.md + report.pdf + report.docx + report.pptx
- **关联能力**：pd-document-export

### 会议记录→复盘 PPT+待办 (`meeting-to-deck`)

- **类别**：office · **体量徽章**：light · 2 步
- **成果**：结构化纪要 + 复盘幻灯 + 待办清单
- **场景**：会后快速产出复盘与跟进行动
- **流程**：纪要结构化 → 复盘幻灯
- **产出物**：minutes.md + recap.html + todos.md
- **关联能力**：ala-meeting-notes, frontend-slides

### 数据→动态网页→数据视频 (`data-story-video`)

- **类别**：creation · **体量徽章**：full · 3 步
- **成果**：分析结论 + 滚动叙事页 + 数据动画视频
- **场景**：用数据讲故事并导出可分享视频
- **流程**：读数分析 → 滚动叙事数据页 → 录成数据视频
- **产出物**：analysis.md + story.html + video.mp4
- **关联能力**：df-data-analysis, od-data-report, tool-render-html-video

### 大纲→PPT→炫酷视频 (`outline-ppt-video`)

- **类别**：creation · **体量徽章**：full · 3 步
- **成果**：一份大纲 + 一套动效演示页 + 一支可直接发布的成片
- **场景**：要做发布会/课程/提案，想从一句话直接拿到能放映的演示和能发的视频
- **流程**：调研并写结构化大纲 → 大纲生成动效演示页 → 演示页渲染成片
- **产出物**：1 个 .md 大纲 + 1 个 .html 演示 + 1 个 .mp4 视频
- **关联能力**：nova-research-general, frontend-slides, hf-hyperframes

### 深度调研→双人播客 (`research-podcast`)

- **类别**：creation · **体量徽章**：standard · 3 步
- **成果**：调研报告 + 对谈脚本 + 播客音频
- **场景**：把资料调研变成可听的播客节目
- **流程**：深度调研 → 双主播对谈脚本 → 生成播客音频
- **产出物**：research.md + script.md + podcast.mp3
- **关联能力**：df-deep-research, ala-content-writer, df-podcast-generation

### SaaS 演示·脚本到 Remotion 成片 (`saas-demo-remotion-full`)

- **类别**：creation · **体量徽章**：full · 3 步
- **成果**：UI 逐镜分镜 + Remotion YAML 脚本 + 可发布 mp4
- **场景**：B 端产品 Demo / 功能发布片，要 UI 保真程序化成片
- **流程**：SaaS 演示分镜 → 程序化 YAML 脚本 → Remotion 渲染成片
- **产出物**：01-demo-storyboard.md + 02-script.yaml + 03/out.mp4
- **关联能力**：create-vid-saas-demo-script, create-vid-scriptwriting, remotion-video

### AI 短剧·四幕分镜包 (`short-drama-seedance-pack`)

- **类别**：creation · **体量徽章**：full · 4 步
- **成果**：四幕剧本 + 连续性分镜包 + 即梦分段时间线（可选试出片）
- **场景**：小说/梗概变系列短剧，给即梦或剪辑交接完整前期
- **流程**：四幕剧本与素材清单 → 连续性分镜交付包 → 即梦相机分镜与分段 → 试渲染首集镜头（可选）
- **产出物**：01-script-acts.md + 03-bible/ + 04-shot-cards.md + 05-seedance-timeline.md（+ 可选 ep01-clips/）
- **关联能力**：create-vid-seedance-series, create-vid-storyboard-pack, create-vid-seedance-codec, tool-generate-video

### 官网→品牌宣传视频 (`website-promo-video`)

- **类别**：creation · **体量徽章**：standard · 3 步
- **成果**：分镜脚本 + 30-60 秒品牌宣传片（含字幕）
- **场景**：已有官网，要快速产出能投放的品牌短片
- **流程**：抓取官网真图与卖点 → 写分镜与旁白 → 网站转宣传视频
- **产出物**：storyboard.md + promo.mp4
- **关联能力**：mkt-brand-video, hf-product-launch-video
