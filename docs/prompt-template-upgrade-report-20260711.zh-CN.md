# 提示词模板全量升级报告

> 生成时间：2026-07-11T04:51:48.762Z · 策略 `scripts/lib/promptTemplateStrategy.mjs`

## 策略摘要

| 层级 | 规则 |
|------|------|
| Hub「试一下」 | 任务句 + **须交付** + **写入系统分配任务目录**；系统侧 capability-binding 注入 read_skill |
| 流程模板 | read_skill 分步 + 禁止 read_file skills/ + 降级 + **标准成果清单** + 收尾句 |

## 统计

| 项 | 数量 |
|----|------|
| Hub 可见能力 | 599 |
| Hub 提示词变更 | 353 |
| 流程模板变更 | 35 / 35 |

## 流程模板变更明细

| 模板 | 更新前（摘要） | 更新后（摘要） |
|------|----------------|----------------|
| 正式通稿包 (`press-release-pack`) | 帮我做一篇【主题/事件】的正式新闻通稿并配一张头图，两步一次做完，每步把文件存到 artifacts/ 并告诉我路径： 1. 通稿：标题居中、导语、3 段正文、文末媒体联系人，输出 Word(.docx)。 2. 头图：与通稿主题一致的横… | 帮我做一篇【主题/事件】的正式新闻通稿并配一张头图，两步一次做完，每步写入系统分配的任务目录 并告诉我路径： 1. 通稿：标题居中、导语、3 段正文、文末媒体联系人，输出 Word(.docx)。 2. 头图：与通稿主题一致的横版宣传图，… |
| 竞品对比落地页 (`competitor-landing`) | 围绕【我的产品】对比【竞品A、竞品B】做一个竞品对比落地页，两步一次做完，产出存 artifacts/ 并报路径： 1. 竞品调研：对比定位、定价、核心功能与优劣势，列成结构化对照。 2. 对比落地页：把结论做成一页 HTML，含我方优势… | 围绕【我的产品】对比【竞品A、竞品B】做一个竞品对比落地页，两步一次做完，产出存系统分配的任务目录 1. 竞品调研：对比定位、定价、核心功能与优劣势，列成结构化对照。 2. 对比落地页：把结论做成一页 HTML，含我方优势高亮和 CTA。… |
| 单条爆款社媒 (`single-social-post`) | 帮我为【主题/产品】出一条小红书图文并存到草稿，两步一次做完： 1. 文案：小红书风格标题+正文+话题标签，并给出配图建议。 2. 存草稿：把图文存到小红书草稿箱（不要公开发布），回报任务编号。 直接开始做，做完告诉我结果。 | 帮我为【主题/产品】出一条小红书图文并存到草稿，两步一次做完： 1. 文案：小红书风格标题+正文+话题标签，并给出配图建议。 2. 存草稿：把图文存到小红书草稿箱（不要公开发布），回报任务编号。 禁止 read_file skills/；… |
| 内容营销飞轮 (`content-flywheel`) | 帮我围绕【主题/产品】做一轮内容营销，3 步一次做完，产出存 系统分配的任务目录-{时间}/ 并报路径： 1. 选题：write_file 01-topics.md（1 主话题 + 3 子选题）。 2. 长文：write_file 02-… | 帮我围绕【主题/产品】做一轮内容营销，3 步一次做完，产出存 系统分配的任务目录/ 并报路径： 1. 选题：write_file 01-topics.md（1 主话题 + 3 子选题）。 2. 长文：write_file 02-longf… |
| 调研报告交付 (`research-report`) | 帮我就【研究主题】做一份正式调研报告，3 步一次做完，存 系统分配的任务目录 并报路径： 1. 深度调研：web_search 后 write_file 保存 01-sources-and-synthesis.md（信息源 + 结论综述）… | 帮我就【研究主题】做一份正式调研报告，3 步一次做完，存 系统分配的任务目录 并报路径： 1. 深度调研：web_search 后 write_file 保存 01-sources-and-synthesis.md（信息源 + 结论综述）… |
| 落地页获客套件 (`landing-acquisition-kit`) | 帮我为【产品】搭一套获客套件，3 步一次做完，存 artifacts/ 报路径： 1. 落地页：含标题、3 个卖点、价格、免费试用 CTA 的 HTML。 2. 引流磁铁：设计一个换邮箱的资源（清单/白皮书提纲）。 3. 邮件序列：写 3… | 帮我为【产品】搭一套获客套件，3 步一次做完，存系统分配的任务目录 1. 落地页：含标题、3 个卖点、价格、免费试用 CTA 的 HTML。 2. 引流磁铁：设计一个换邮箱的资源（清单/白皮书提纲）。 3. 邮件序列：写 3-5 封欢迎培… |
| 社媒矩阵一条龙 (`social-matrix-pipeline`) | 帮我把【一条创意/主题】做成国内社媒矩阵，一次做完并存 系统分配的任务目录 1. 写 brief 与创意锚点。 2. 出四套比例配图（9:16、3:4、1:1、16:9）。 3. 写多平台文案（抖音/小红书/微博等，按需）。 4. 打包并… | 帮我把【一条创意/主题】做成国内社媒矩阵，一次做完并存 系统分配的任务目录 1. 写 brief 与创意锚点。 2. 出四套比例配图（9:16、3:4、1:1、16:9）。 3. 写多平台文案（抖音/小红书/微博等，按需）。 4. 打包并… |
| 活动复盘闭环 (`campaign-retrospective`) | 帮我做【活动名称】的复盘，3 步一次做完，存 artifacts/ 报路径： 1. 效果分析：基于我提供/粘贴的数据，read_skill mkt-performance-report，提炼关键指标、渠道表现与问题。 2. 复盘报告：整理… | 帮我做【活动名称】的复盘，3 步一次做完，存系统分配的任务目录 1. 效果分析：基于我提供/粘贴的数据，read_skill mkt-performance-report，提炼关键指标、渠道表现与问题。 2. 复盘报告：整理成 Word(… |
| 新品上市全案 (`product-launch-full`) | 帮我为【新品名称】做一套上市全案，按以下阶段一次性规划并执行，每阶段产出存 artifacts/ 并报路径： 1. 调研：竞品与目标人群速览。 2. 策略：GTM 要点（人群、差异化、节奏）。 3. 通稿：新品新闻通稿 Word(.doc… | 帮我为【新品名称】做一套上市全案，按以下阶段一次性规划并执行，每阶段产出存系统分配的任务目录 1. 调研：竞品与目标人群速览。 2. 策略：GTM 要点（人群、差异化、节奏）。 3. 通稿：新品新闻通稿 Word(.docx)。 4. 落… |
| SaaS 增长全案 (`saas-growth-full`) | 帮我为【SaaS 产品】做一套增长全案，按阶段一次规划执行，产出存 artifacts/ 报路径： 1. 市场与竞品调研。 2. 定位与定价方案。 3. 官网落地页 HTML。 4. 程序化 SEO 页模板（给【关键词族】示例）。 5. … | 帮我为【SaaS 产品】做一套增长全案，按阶段一次规划执行，产出存系统分配的任务目录 1. 市场与竞品调研。 2. 定位与定价方案。 3. 官网落地页 HTML。 4. 程序化 SEO 页模板（给【关键词族】示例）。 5. AI 搜索基线… |
| 内容 IP 启动全案 (`content-ip-full`) | 帮我为【账号/IP 主题】做一套内容 IP 启动全案，按阶段一次执行，存 artifacts/ 报路径： 1. 内容策略：定位、话题簇、内容日历方向。 2. 系列长文：写 2 篇支柱长文。 3. 社媒矩阵：把长文拆成多平台短内容 + 配图… | 帮我为【账号/IP 主题】做一套内容 IP 启动全案，按阶段一次执行，存系统分配的任务目录 1. 内容策略：定位、话题簇、内容日历方向。 2. 系列长文：写 2 篇支柱长文。 3. 社媒矩阵：把长文拆成多平台短内容 + 配图。 4. Ne… |
| 品牌传播 Campaign 全案 (`brand-campaign-full`) | 帮我做【活动主题】的品牌传播 campaign 全案，按阶段一次规划执行，产出存 artifacts/ 报路径： 1. 调研：受众与传播环境速览。 2. Campaign 策划：read_skill mkt-campaign-plan，明… | 帮我做【活动主题】的品牌传播 campaign 全案，按阶段一次规划执行，产出存系统分配的任务目录 1. 调研：受众与传播环境速览。 2. Campaign 策划：read_skill mkt-campaign-plan，明确目标、渠道与… |
| AI 可见度快检 (`geo-visibility-quick`) | 帮【品牌名】做 AI 可见度快检，2 步一次做完，全部存 系统分配的任务目录 并报路径： 1. read_skill geo-aeo-audit，输出 AEO/GEO 审计 aeo-audit.md（可结合 mkt-ai-seo 清单要点… | 帮【品牌名】做 AI 可见度快检，2 步一次做完，全部存 系统分配的任务目录 并报路径： 1. read_skill geo-aeo-audit，输出 AEO/GEO 审计 aeo-audit.md（可结合 mkt-ai-seo 清单要点… |
| AI 搜索可见度标准包 (`geo-visibility-standard`) | 帮【品牌名】做 AI 搜索可见度标准包，5 步一次做完，存 系统分配的任务目录 每步报路径： 1. read_skill geo-aeo-audit → aeo-audit.md。 2. read_skill pd-geo → keywo… | 帮【品牌名】做 AI 搜索可见度标准包，5 步一次做完，存 系统分配的任务目录 每步报路径： 1. read_skill geo-aeo-audit → aeo-audit.md。 2. read_skill pd-geo → keywo… |
| 竞品与口碑快览 (`competitive-intel-quick`) | 围绕【我的产品】对比【竞品A、竞品B】做竞品与口碑快览，2 步一次做完，存 系统分配的任务目录 并报路径： 1. 竞品简报：定位、定价、功能差异、我方机会点，输出 competitive-brief.md。 2. 口碑挖掘：汇总用户评价/… | 围绕【我的产品】对比【竞品A、竞品B】做竞品与口碑快览，2 步一次做完，存 系统分配的任务目录 并报路径： 1. 竞品简报：定位、定价、功能差异、我方机会点，输出 competitive-brief.md。 2. 口碑挖掘：汇总用户评价/… |
| 品牌 GEO 全案 (`geo-brand-full`) | 帮【品牌名】做品牌 GEO 全案，按阶段一次执行，存 系统分配的任务目录 每阶段报路径。核心优势【…】，竞品【…】。 1. geo-aeo-audit 审计清单。 2. pd-geo：关键词 + 至少 3 个平台成稿 + optimize… | 帮【品牌名】做品牌 GEO 全案，按阶段一次执行，存 系统分配的任务目录 每阶段报路径。核心优势【…】，竞品【…】。 1. geo-aeo-audit 审计清单。 2. pd-geo：关键词 + 至少 3 个平台成稿 + optimize… |
| AI 可引用内容优化 (`ai-citable-content`) | 帮我把【文章/页面主题】的现有成稿优化为 AI 更易引用的版本，2 步一次做完，存 系统分配的任务目录 并报路径： 1. read_skill geo-content-optimizer：基于我提供的正文或路径，输出 optimized.… | 帮我把【文章/页面主题】的现有成稿优化为 AI 更易引用的版本，2 步一次做完，存 系统分配的任务目录 并报路径： 1. read_skill geo-content-optimizer：基于我提供的正文或路径，输出 optimized.… |
| Campaign 策划交付包 (`campaign-strategy-pack`) | 帮我为【活动/产品主题】做 Campaign 策划交付包，4 步一次做完，存 系统分配的任务目录 每步报路径： 1. 竞品简报：read_skill mkt-competitive-brief → competitive-brief.md… | 帮我为【活动/产品主题】做 Campaign 策划交付包，4 步一次做完，存 系统分配的任务目录 每步报路径： 1. 竞品简报：read_skill mkt-competitive-brief → competitive-brief.md… |
| AI 可见度监测闭环 (`geo-monitor-loop`) | 帮【品牌名】做一轮 AI 可见度监测闭环，3 步一次做完，存 系统分配的任务目录 并报路径： 1. read_skill geo-rank-track：针对【核心关键词/问句】输出 rank-track.md（可见度变化与缺口）。 2. … | 帮【品牌名】做一轮 AI 可见度监测闭环，3 步一次做完，存 系统分配的任务目录 并报路径： 1. read_skill geo-rank-track：针对【核心关键词/问句】输出 rank-track.md（可见度变化与缺口）。 2. … |
| 大纲→PPT→炫酷视频 (`outline-ppt-video`) | 帮我把【主题】做成一支能直接发的演示视频，三步连着做，每步把文件存到 artifacts/ 并告诉我路径： 1. 先查清楚这个主题的要点，写一份 8-12 节的结构化大纲（每节一句核心观点+2-3 个支撑点）。 2. 按大纲做一套深色现代… | 帮我把【主题】做成一支能直接发的演示视频，三步连着做，每步写入系统分配的任务目录 并告诉我路径： 1. 先查清楚这个主题的要点，写一份 8-12 节的结构化大纲（每节一句核心观点+2-3 个支撑点）。 2. 按大纲做一套深色现代风的动效网… |
| 官网→品牌宣传视频 (`website-promo-video`) | 为【官网 URL】做一支 30-60 秒品牌宣传视频，三步一次做完，存 系统分配的任务目录 并报路径： 1. 用 fetch_page_images 抓取官网实际大图与核心卖点，禁止 AI 生成产品图。 2. 写 6-8 镜头分镜（每镜头… | 为【官网 URL】做一支 30-60 秒品牌宣传视频，三步一次做完，存 系统分配的任务目录 并报路径： 1. 用 fetch_page_images 抓取官网实际大图与核心卖点，禁止 AI 生成产品图。 2. 写 6-8 镜头分镜（每镜头… |
| 深度调研→双人播客 (`research-podcast`) | 围绕【主题】做一期双人播客，三步一次做完，存 系统分配的任务目录 并报路径： 1. 深度调研：多源信息、结论与争议点 → research.md。 2. 写 A/B 两位主播口语化对谈脚本（有追问有反驳，每段不超 3 句）→ script… | 围绕【主题】做一期双人播客，三步一次做完，存 系统分配的任务目录 并报路径： 1. 深度调研：多源信息、结论与争议点 → research.md。 2. 写 A/B 两位主播口语化对谈脚本（有追问有反驳，每段不超 3 句）→ script… |
| 一文多发内容矩阵 (`one-article-matrix`) | 把下面这篇长文做成五平台内容矩阵，三步一次做完，存 系统分配的任务目录 并报路径： 【在此粘贴长文或主题】 1. 整理成一篇结构清晰的长文定稿 master.md。 2. 改写为小红书（emoji+话题）、公众号（小标题）、知乎（论证）、… | 把下面这篇长文做成五平台内容矩阵，三步一次做完，存 系统分配的任务目录 并报路径： 【在此粘贴长文或主题】 1. 整理成一篇结构清晰的长文定稿 master.md。 2. 改写为小红书（emoji+话题）、公众号（小标题）、知乎（论证）、… |
| 数据→动态网页→数据视频 (`data-story-video`) | 用【数据/表格说明或文件路径】做一支数据故事视频，三步一次做完，存 系统分配的任务目录 并报路径： 1. 先给出 3 个关键结论 → analysis.md。 2. 做滚动叙事 HTML 页（数字滚动/柱图生长动效）→ story.htm… | 用【数据/表格说明或文件路径】做一支数据故事视频，三步一次做完，存 系统分配的任务目录 并报路径： 1. 先给出 3 个关键结论 → analysis.md。 2. 做滚动叙事 HTML 页（数字滚动/柱图生长动效）→ story.htm… |
| 小红书爆款工厂 (`xhs-hit-factory`) | 为【品类/账号定位】做一轮小红书爆款内容，三步一次做完，存 系统分配的任务目录 并报路径： 1. 调研热点与对标，输出选题表（热度依据+切入角度+预估人群）→ topics.md。 2. 选 3 个选题写笔记（标题 2 案、正文、5 标签… | 为【品类/账号定位】做一轮小红书爆款内容，三步一次做完，存 系统分配的任务目录 并报路径： 1. 调研热点与对标，输出选题表（热度依据+切入角度+预估人群）→ topics.md。 2. 选 3 个选题写笔记（标题 2 案、正文、5 标签… |
| 会议记录→复盘 PPT+待办 (`meeting-to-deck`) | 根据下面会议内容做复盘包，两步一次做完，存 artifacts/meeting/【会议名】/ 并报路径： 【粘贴会议记录或要点】 1. 纪要按「决议/分歧/数据」三栏整理，并列出待办（负责人+期限占位）→ minutes.md + tod… | 根据下面会议内容做复盘包，两步一次做完，存系统分配的任务目录 【粘贴会议记录或要点】 1. 纪要按「决议/分歧/数据」三栏整理，并列出待办（负责人+期限占位）→ minutes.md + todos.md。 2. 做 6-8 页复盘 HT… |
| 资料→课件→随堂测验 (`doc-to-course`) | 把【PDF/文档路径或粘贴内容】做成教学包，三步一次做完，存 artifacts/course/【主题】/ 并报路径： 1. 拆知识点（概念-例题-易错点）→ knowledge.md。 2. 做教学课件（幻灯或讲义结构）。 3. 配套 … | 把【PDF/文档路径或粘贴内容】做成教学包，三步一次做完，存系统分配的任务目录 1. 拆知识点（概念-例题-易错点）→ knowledge.md。 2. 做教学课件（幻灯或讲义结构）。 3. 配套 10 题测验含答案与解析，难度梯度 → … |
| 报告→四格式交付包 (`md-html-office-pack`) | 根据【主题/粘贴素材】做四格式交付包，两步一次做完，存 artifacts/reports/【主题】/ 并报路径： 1. 写中文调研报告 → report.md。 2. 用 export_document 依次导出 PDF、Word、可编… | 根据【主题/粘贴素材】做四格式交付包，两步一次做完，存系统分配的任务目录 1. 写中文调研报告 → report.md。 2. 用 export_document 依次导出 PDF、Word、可编辑 PPT 到同目录。 禁止 read_f… |
| 名人脑爆→观点长文 (`persona-debate-article`) | 围绕【议题】做名人脑爆长文，三步一次做完，存 系统分配的任务目录 并报路径： 1. 分别用 persona-munger、persona-elon-musk、persona-steve-jobs 各输出 300 字立场，再互相反驳一轮 →… | 围绕【议题】做名人脑爆长文，三步一次做完，存 系统分配的任务目录 并报路径： 1. 分别用 persona-munger、persona-elon-musk、persona-steve-jobs 各输出 300 字立场，再互相反驳一轮 →… |
| 销售 Battlecard 全链路 (`sales-battlecard-full`) | 为【我方产品 vs 竞品】做销售 Battlecard 全链路，三步一次做完，存 系统分配的任务目录 并报路径： 1. read_skill mkt-competitive-intel → intel.md。 2. read_skill … | 为【我方产品 vs 竞品】做销售 Battlecard 全链路，三步一次做完，存 系统分配的任务目录 并报路径： 1. read_skill mkt-competitive-intel → intel.md。 2. read_skill … |
| 法务风险快检 (`legal-risk-quick`) | 对下面【合同/函件摘要】做法务快检，两步一次做完，存 系统分配的任务目录 并报路径；全程注明「非律师意见，须法务复核」： 1. read_skill legal-risk-assessment → risk-assessment.md（严… | 对下面【合同/函件摘要】做法务快检，两步一次做完，存 系统分配的任务目录 并报路径；全程注明「非律师意见，须法务复核」： 1. read_skill legal-risk-assessment → risk-assessment.md（严… |
| 品牌广告·分镜到即梦 (`ad-storyboard-seedance`) | 帮【产品/品牌】做一支品牌广告的分镜与即梦提示词包，4 步一次做完，存 系统分配的任务目录 并报路径；每步先 read_skill 对应能力，再 write_file，写完再下一步： 1. read_skill create-vid-vi… | 帮【产品/品牌】做一支品牌广告的分镜与即梦提示词包，4 步一次做完，存 系统分配的任务目录 并报路径；每步先 read_skill 对应能力，再 write_file，写完再下一步： 1. read_skill create-vid-vi… |
| 口播爆款·脚本包 (`viral-talking-script`) | 为【主题/产品】写一条【抖音/小红书/Reels，任选】口播短视频脚本，2 步一次做完，存 系统分配的任务目录 并报路径： 1. read_skill create-vid-viral-copy：产出 3 条 hook 候选 + 口播结构… | 为【主题/产品】写一条【抖音/小红书/Reels，任选】口播短视频脚本，2 步一次做完，存 系统分配的任务目录 并报路径： 1. read_skill create-vid-viral-copy：产出 3 条 hook 候选 + 口播结构… |
| AI 短剧·四幕分镜包 (`short-drama-seedance-pack`) | 把【梗概/小说片段/题材】做成 AI 短剧前期分镜包，4 步一次做完，存 系统分配的任务目录 并报路径；每步 read_skill 后 write_file： 1. read_skill create-vid-seedance-serie… | 把【梗概/小说片段/题材】做成 AI 短剧前期分镜包，4 步一次做完，存 系统分配的任务目录 并报路径；每步 read_skill 后 write_file： 1. read_skill create-vid-seedance-serie… |
| SaaS 演示·脚本到 Remotion 成片 (`saas-demo-remotion-full`) | 为【产品名/核心功能】做一支 SaaS 产品演示视频，3 步一次做完，存 系统分配的任务目录 并报路径： 1. read_skill create-vid-saas-demo-script：根据【功能点/用户痛点/时长 60-90s】写 … | 为【产品名/核心功能】做一支 SaaS 产品演示视频，3 步一次做完，存 系统分配的任务目录 并报路径： 1. read_skill create-vid-saas-demo-script：根据【功能点/用户痛点/时长 60-90s】写 … |

## Hub 能力变更明细（全量）

| slug | 名称 | 更新前 | 更新后 |
|------|------|--------|--------|
| `ala-academic-researcher` | 学术写作助手 | 用「学术写作助手」帮我：【文献综述 / 论文分析 / 写作润色，附材料与要求】。 | 用「学术写作助手」帮我：【文献综述 / 论文分析 / 写作润色，附材料与要求】。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `ala-code-reviewer` | code-reviewer | 用「代码审查」检查【文件或目录路径】的安全漏洞与质量问题，按严重程度列出并给修复建议。 | 用「代码审查」检查【文件或目录路径】的安全漏洞与质量问题，按严重程度列出并给修复建议。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `ala-debugger` | debugger | 用「系统化调试」排查这个问题：【贴报错信息与复现步骤】，定位根因并修复。 | 用「系统化调试」排查这个问题：【贴报错信息与复现步骤】，定位根因并修复。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `ala-decision-helper` | 决策助手 | 用「决策助手」帮我：【说明具体任务与背景】。 | 用「决策助手」帮我：【说明具体任务与背景】。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `ala-editor` | editor | 用「专业润色」编辑下面的文稿，提升清晰度与可读性：【粘贴文稿】。 | 用「专业润色」编辑下面的文稿，提升清晰度与可读性：【粘贴文稿】。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `ala-fact-checker` | 事实核查 | 用「事实核查」帮我：【说明具体任务与背景】。 | 用「事实核查」帮我：【说明具体任务与背景】。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `ala-fullstack-developer` | fullstack-developer | 用「全栈开发」帮我实现：【功能需求，如：给项目加一个带登录的评论功能】。 | 用「全栈开发」帮我实现：【功能需求，如：给项目加一个带登录的评论功能】。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `ala-meeting-notes` | meeting-notes | 用「会议纪要」把这份记录整理成结构化纪要：【粘贴录音转写或速记】，列出决策与行动项。 | 用「会议纪要」把这份记录整理成结构化纪要：【粘贴录音转写或速记】，列出决策与行动项。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `ala-project-planner` | project-planner | 用「项目拆解排期」把这个项目拆成任务与里程碑：【项目目标与期限】。 | 用「项目拆解排期」把这个项目拆成任务与里程碑：【项目目标与期限】。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `ala-python-expert` | python-expert | 用「Python 专家」帮我：【写脚本 / 优化代码 / 排错，贴需求或代码】。 | 用「Python 专家」帮我：【写脚本 / 优化代码 / 排错，贴需求或代码】。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `ala-sprint-planner` | sprint-planner | 用「Sprint 规划」帮团队排下个迭代：【贴需求列表与团队人数】，输出故事点与 Sprint 目标。 | 用「Sprint 规划」帮团队排下个迭代：【贴需求列表与团队人数】，输出故事点与 Sprint 目标。须交付：output.md 或修订稿（按任务）。写入系统… |
| `ala-technical-writer` | technical-writer | 用「技术文档写作」为【项目或功能】写一份【README / 教程 / API 文档】。 | 用「技术文档写作」为【项目或功能】写一份【README / 教程 / API 文档】。须交付：output.md 或修订稿（按任务）。写入系统分配任务目录。 |
| `anth-canvas-design` | canvas-design | 用「视觉画布设计」设计一张【海报或封面】：【主题、文字内容与风格】。 | 用「视觉画布设计」设计一张【海报或封面】：【主题、文字内容与风格】。须交付：办公格式文件（docx/pptx/xlsx/pdf）。写入系统分配任务目录。 |
| `anth-docx` | Word 文档 | 用「Word文档」写一份【文档类型，如活动 brief / 新闻稿】并输出 Word 文件：【主题与要点】。 | 用「Word文档」写一份【文档类型，如活动 brief / 新闻稿】并输出 Word 文件：【主题与要点】。须交付：*.docx（Word 可打开）。写入系统… |
| `anth-mcp-builder` | mcp-builder | 用「MCP构建」帮我搭一个 MCP 服务：【要接入的数据或工具】，写好代码并调通。 | 用「MCP构建」帮我搭一个 MCP 服务：【要接入的数据或工具】，写好代码并调通。须交付：办公格式文件（docx/pptx/xlsx/pdf）。写入系统分配任… |
| `anth-pdf` | PDF 论文解析 | 用「PDF工具」处理这份 PDF：【提取正文 / 合并 / 整理成笔记，附文件】。 | 用「PDF工具」处理这份 PDF：【提取正文 / 合并 / 整理成笔记，附文件】。须交付：办公格式文件（docx/pptx/xlsx/pdf）。写入系统分配任… |
| `anth-pptx` | pptx | 用「PPT幻灯」生成一份可编辑的 PPT 文件：【主题与大纲要点】。 | 用「PPT幻灯」生成一份可编辑的 PPT 文件：【主题与大纲要点】。须交付：presentation.pptx（真实可编辑 PPT）。写入系统分配任务目录。 |
| `anth-xlsx` | xlsx | 用「Excel表格」做一个 Excel 文件：【数据内容与想要的统计或图表】。 | 用「Excel表格」做一个 Excel 文件：【数据内容与想要的统计或图表】。须交付：办公格式文件（docx/pptx/xlsx/pdf）。写入系统分配任务目… |
| `create-vid-director` | AI 导演分镜 | 用「AI 导演分镜」以王家卫风格为【故事梗概】写镜头表与 keyframe 提示。 | 用「AI 导演分镜」以王家卫风格为【故事梗概】写镜头表与 keyframe 提示。须交付：02-director-board.md（镜头表与 keyframe… |
| `create-vid-saas-demo-script` | SaaS 演示分镜 | 用「SaaS 演示分镜」为【SaaS 产品】写 60 秒功能演示逐镜分镜与 Remotion 时间轴。 | 用「SaaS 演示分镜」为【SaaS 产品】写 60 秒功能演示逐镜分镜与 Remotion 时间轴。须交付：分镜/脚本 md（按技能 playbook）。写… |
| `create-vid-scriptwriting` | 程序化视频脚本 | 用「程序化视频脚本」为【产品】做 30 秒产品演示 YAML 脚本：场景、帧数、旁白与动效说明。 | 用「程序化视频脚本」为【产品】做 30 秒产品演示 YAML 脚本：场景、帧数、旁白与动效说明。须交付：分镜/脚本 md（按技能 playbook）。写入系统… |
| `create-vid-seedance-codec` | 即梦相机分镜 | 用「即梦相机分镜」为【主题】规划 25 格分镜与长片分段策略（相机四维编码）。 | 用「即梦相机分镜」为【主题】规划 25 格分镜与长片分段策略（相机四维编码）。须交付：分镜/脚本 md（按技能 playbook）。写入系统分配任务目录。 |
| `create-vid-seedance-prompt` | 即梦分镜提示 | 用「即梦分镜提示」为【主题】写 15 秒 Seedance 2.0 分镜提示词（含 @引用说明）。 | 用「即梦分镜提示」为【主题】写 15 秒 Seedance 2.0 分镜提示词（含 @引用说明）。须交付：03-seedance-prompts.md（含 @… |
| `create-vid-seedance-series` | 短剧分镜生成 | 用「短剧分镜生成」把下面故事改编为四幕短剧剧本并写第 1 集 Seedance 分镜：【粘贴故事】。 | 用「短剧分镜生成」把下面故事改编为四幕短剧剧本并写第 1 集 Seedance 分镜：【粘贴故事】。须交付：分镜/脚本 md（按技能 playbook）。写入… |
| `create-vid-storyboard-pack` | 连续性分镜包 | 用「连续性分镜包」为【广告创意】输出 continuity 分镜包：bible、镜头卡、交接矩阵。 | 用「连续性分镜包」为【广告创意】输出 continuity 分镜包：bible、镜头卡、交接矩阵。须交付：continuity_bible.md、shot_c… |
| `create-vid-viral-copy` | 爆款视频文案 | 用「爆款视频文案」为【产品】写 3 条 30 秒爆款短视频口播脚本（含 hook）。 | 用「爆款视频文案」为【产品】写 3 条 30 秒爆款短视频口播脚本（含 hook）。须交付：01-hooks.md（3 条 hook + 结构）。写入系统分配… |
| `create-vid-visual-prompt` | 影视镜头策划 | 用「影视镜头策划」把下面剧本拆成 14 字段镜头卡并写 Seedance 提示词：【粘贴剧本或梗概】。 | 用「影视镜头策划」把下面剧本拆成 14 字段镜头卡并写 Seedance 提示词：【粘贴剧本或梗概】。须交付：01-shot-cards.md（14 字段镜头… |
| `df-deep-research` | 深度调研 | 用「深度调研」围绕【研究主题】做多源调研：先列信息源，再给带结论的综述。 | 用「深度调研」围绕【研究主题】做多源调研：先列信息源，再给带结论的综述。须交付：research-report.md（信息源 + 结论综述）。写入系统分配任务… |
| `edu-sci-timesfm-forecasting` | 时序预测 TimesFM | 用「时序预测 TimesFM」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「时序预测 TimesFM」帮我：【说明具体场景、目标与必须包含的信息】。须交付：forecast.json 或 forecast.csv、forecast… |
| `frontend-slides` | HTML 演示 | 用「HTML 演示」做【页数】页动画演示：【主题与风格】，横屏翻页、每页一屏。 | 用「HTML 演示」做【页数】页动画演示：【主题与风格】，横屏翻页、每页一屏。须交付：index.html（横屏翻页演示）。写入系统分配任务目录。 |
| `geo-aeo-audit` | AI 可见度审计 | 用「AI可见审计」对【官网 URL】做四维 GEO 评分，输出修复清单与优先级。 | 用「AI可见审计」对【官网 URL】做四维 GEO 评分，输出修复清单与优先级。须交付：aeo-audit.md（四维评分与修复清单）。写入系统分配任务目录。 |
| `geo-citability` | AI 引用评分 | 用「AI引用评分」给这个页面打分：【URL 或粘贴内容】，输出可引用性评分与逐段改写建议。 | 用「AI引用评分」给这个页面打分：【URL 或粘贴内容】，输出可引用性评分与逐段改写建议。须交付：citability-report.md（评分与逐段建议）。… |
| `geo-competitor-analysis` | AI 竞品可见度 | 用「GEO竞品分析」对比【我的品牌】与【2-3 家竞品】在 AI 搜索中的可见度，输出差距与行动清单。 | 用「GEO竞品分析」对比【我的品牌】与【2-3 家竞品】在 AI 搜索中的可见度，输出差距与行动清单。须交付：geo-competitor-report.md… |
| `geo-content-optimizer` | AI 可引用内容优化 | 用「AI可引用优化」改写下面的内容，让它更容易被 ChatGPT、Perplexity 等引用：【粘贴内容或 URL】。 | 用「AI可引用优化」改写下面的内容，让它更容易被 ChatGPT、Perplexity 等引用：【粘贴内容或 URL】。须交付：optimized.md（AI… |
| `geo-keyword-research` | AI 关键词调研 | 用「GEO挖词」为【品牌或产品】整理 AI 搜索关键词：20 个核心词与用户常问句式。 | 用「GEO挖词」为【品牌或产品】整理 AI 搜索关键词：20 个核心词与用户常问句式。须交付：keywords.md（核心词与用户问句）。写入系统分配任务目录。 |
| `geo-on-page-audit` | 页面 AI 可见度审计 | 用「页面可见审计」审计【页面 URL】：标题、结构、关键词与内链，列出优先修复项。 | 用「页面可见审计」审计【页面 URL】：标题、结构、关键词与内链，列出优先修复项。须交付：geo-deliverable.md（审计/优化/评分类成果）。写入… |
| `geo-rank-track` | AI 可见度跟踪 | 用「AI可见跟踪」给【品牌】建 AI 可见度跟踪表：本月基线与监测关键词。 | 用「AI可见跟踪」给【品牌】建 AI 可见度跟踪表：本月基线与监测关键词。须交付：rank-track.md（基线与监测词）。写入系统分配任务目录。 |
| `geo-seo-content-writer` | AI 搜索友好成稿 | 用「AI搜索成稿」写一篇面向 AI 搜索的长文：主题【主题】，目标关键词【关键词】，结构利于 AI 摘录。 | 用「AI搜索成稿」写一篇面向 AI 搜索的长文：主题【主题】，目标关键词【关键词】，结构利于 AI 摘录。须交付：geo-deliverable.md（审计/… |
| `geo-technical-seo` | AI 爬虫与技术可达 | 用「AI爬虫可达」检查【官网 URL】的技术 SEO：robots、llms.txt、结构化数据与可抓取性，输出修复清单。 | 用「AI爬虫可达」检查【官网 URL】的技术 SEO：robots、llms.txt、结构化数据与可抓取性，输出修复清单。须交付：technical-seo-… |
| `hf-gsap` | GSAP 动画模式库 | 用「GSAP 动画模式库」给我的页面或视频加动效：【元素与想要的效果，如：标题弹性入场】。 | 用「GSAP 动画模式库」给我的页面或视频加动效：【元素与想要的效果，如：标题弹性入场】。须交付：视频或分镜 md/mp4。写入系统分配任务目录。 |
| `hf-hyperframes` | HTML 代码做视频 | 用「HTML 代码做视频」做一支【时长】视频：【画面与节奏，如：标题淡入 + 背景视频 + 轻音乐】。 | 用「HTML 代码做视频」做一支【时长】视频：【画面与节奏，如：标题淡入 + 背景视频 + 轻音乐】。须交付：*.mp4 或 HyperFrames 工程说明… |
| `hf-hyperframes-cli` | 视频工程工具链 | 用「视频工程工具链」：【说明视频目标、时长与风格】。 | 用「视频工程工具链」：【说明视频目标、时长与风格】。须交付：视频或分镜 md/mp4。写入系统分配任务目录。 |
| `hf-hyperframes-media` | 视频素材预处理 | 用「视频素材预处理」：【说明视频目标、时长与风格】。 | 用「视频素材预处理」：【说明视频目标、时长与风格】。须交付：视频或分镜 md/mp4。写入系统分配任务目录。 |
| `hf-website-to-video` | 网站一键成片 | 用「网站一键成片」抓取【网址】，自动产出一支【时长，如 25 秒】品牌宣传视频。 | 用「网站一键成片」抓取【网址】，自动产出一支【时长，如 25 秒】品牌宣传视频。须交付：storyboard.md、promo.mp4（或分镜+素材清单）。写… |
| `html-ppt` | HTML 幻灯工作室 | 用「HTML 幻灯工作室」做 8 页【主题】技术分享 HTML 放映幻灯，主题 cyberpunk-neon，整稿 tech-sharing，按 SKILL … | 用「HTML 幻灯工作室」做 8 页【主题】技术分享 HTML 放映幻灯，主题 cyberpunk-neon，整稿 tech-sharing，按 SKILL … |
| `hub-pack-ad-funnel` | 广告漏斗全案 | 用「广告漏斗全案」帮我：【如：出 10 条广告创意 / 优化落地页转化 / 制定投放预算】，附产品与目标人群。可做：广告创意、漏斗设计、落地页、付费投放、转化… | 用「广告漏斗全案」帮我：【如：出 10 条广告创意 / 优化落地页转化 / 制定投放预算】，附产品与目标人群。可做：广告创意、漏斗设计、落地页、付费投放、转化… |
| `hub-pack-aso` | 应用商店优化 | 用「应用商店优化」帮我：【如：挖关键词 / 改商店标题与描述 / 审计竞品 ASO】，附应用名称与商店链接。可做：关键词、元数据、截图方案、竞品分析、评论分析… | 用「应用商店优化」帮我：【如：挖关键词 / 改商店标题与描述 / 审计竞品 ASO】，附应用名称与商店链接。可做：关键词、元数据、截图方案、竞品分析、评论分析… |
| `hub-pack-brand-website` | 品牌官网全案 | 用「品牌官网全案」帮我：【写出要做的事，如：给新品牌做定位 / 写官网落地页文案 / 规划 SEO 关键词】，并附品牌背景。可做：品牌发现、定位、语气规范、落… | 用「品牌官网全案」帮我：【写出要做的事，如：给新品牌做定位 / 写官网落地页文案 / 规划 SEO 关键词】，并附品牌背景。可做：品牌发现、定位、语气规范、落… |
| `hub-pack-fal-video` | Fal 多模态视频 | 用「Fal多模态视频」帮我：【如：生成一支 10 秒产品短片 / 把这张图变成动态视频 / 批量出 3 版广告素材】（需配置 Fal Key）。可做：文生图、… | 用「Fal多模态视频」帮我：【如：生成一支 10 秒产品短片 / 把这张图变成动态视频 / 批量出 3 版广告素材】（需配置 Fal Key）。可做：文生图、… |
| `legal-response` | 法律回应草稿 | 用「法律回应草稿」起草对【函件/投诉】的初步回应；注明非律师意见，须法务复核。 | 用「法律回应草稿」起草对【函件/投诉】的初步回应；注明非律师意见，须法务复核。须交付：response-draft.md（非律师意见）。写入系统分配任务目录。 |
| `legal-risk-assessment` | 法务风险评估 | 用「法务风险评估」评估【合同/条款摘要】风险分级；注明非律师意见，须法务复核。 | 用「法务风险评估」评估【合同/条款摘要】风险分级；注明非律师意见，须法务复核。须交付：risk-assessment.md（非律师意见）。写入系统分配任务目录。 |
| `mkt-ab-testing` | A/B 测试 | 用「A/B 测试」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「A/B 测试」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务… |
| `mkt-ad-creative` | 投放创意 | 用「投放创意」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「投放创意」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-ads` | 付费投放 | 用「付费投放」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「付费投放」帮我：【说明具体场景、目标与必须包含的信息】。须交付：ads-plan.md、channel-matrix.md。写入系统分配任务目录。 |
| `mkt-ai-seo` | AI 可见度快检 | 用「AI 可见度快检」给【品牌或官网】做一轮 AI 搜索可见度快检，列出优先改进项。 | 用「AI 可见度快检」给【品牌或官网】做一轮 AI 搜索可见度快检，列出优先改进项。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-analytics` | 数据分析 | 用「数据分析」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「数据分析」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-brand-video` | 品牌视频分镜 | 用「品牌视频分镜」为【产品】做 15 秒品牌宣传片分镜（6–8 镜头），含旁白与画面说明。 | 用「品牌视频分镜」为【产品】做 15 秒品牌宣传片分镜（6–8 镜头），含旁白与画面说明。须交付：storyboard.md（6–8 镜分镜）。写入系统分配任… |
| `mkt-campaign-budget` | 活动预算表 | 用「活动预算表」做【活动】预算表：渠道、金额、周期与备注，输出 Excel。 | 用「活动预算表」做【活动】预算表：渠道、金额、周期与备注，输出 Excel。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-campaign-plan` | 活动全案 | 用「活动全案」写【活动，如 618 大促】完整方案：目标、人群、渠道、内容日历与 KPI。 | 用「活动全案」写【活动，如 618 大促】完整方案：目标、人群、渠道、内容日历与 KPI。须交付：marketing-deliverable.md（按场景结构… |
| `mkt-campaign-report` | 结案报告 | 用「结案报告」把这次活动整理成结案报告（PDF 或 Word）：【粘贴活动数据与亮点】。 | 用「结案报告」把这次活动整理成结案报告（PDF 或 Word）：【粘贴活动数据与亮点】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-churn-prevention` | 流失预防 | 用「流失预防」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「流失预防」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-claude-seo` | seo | 用「seo」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「seo」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-co-marketing` | 联名营销 | 用「联名营销」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「联名营销」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-cold-email` | 冷邮件 | 用「冷邮件」写一组 B2B 开发信：目标客户【行业或职位】，产品【产品】，含首封与 2 封跟进。 | 用「冷邮件」写一组 B2B 开发信：目标客户【行业或职位】，产品【产品】，含首封与 2 封跟进。须交付：marketing-deliverable.md（按场… |
| `mkt-community-marketing` | 社区营销 | 用「社区营销」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「社区营销」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-competitive-intel` | 竞争情报摘要 | 用「竞争情报摘要」汇总【竞品】近 30 天动态，给 3 条应对建议。 | 用「竞争情报摘要」汇总【竞品】近 30 天动态，给 3 条应对建议。须交付：intel.md。写入系统分配任务目录。 |
| `mkt-content-creation` | 营销内容创作 | 用「营销内容创作」为【产品或活动】各写一条【渠道，如 LinkedIn 帖 + 小红书文案】。 | 用「营销内容创作」为【产品或活动】各写一条【渠道，如 LinkedIn 帖 + 小红书文案】。须交付：marketing-deliverable.md（按场景… |
| `mkt-content-strategy` | 内容策略 | 用「内容策略」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「内容策略」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-copy-editing` | 文案润色 | 用「文案润色」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「文案润色」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-copywriting` | 广告文案 | 用「广告文案」写【产品】的落地页文案：标题、三个卖点、行动按钮与 FAQ，语气专业简洁。 | 用「广告文案」写【产品】的落地页文案：标题、三个卖点、行动按钮与 FAQ，语气专业简洁。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-cro` | 转化率优化 | 用「转化率优化」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「转化率优化」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目… |
| `mkt-customer-research` | 客户调研 | 用「客户调研」整理【产品】的客户洞察：【贴访谈、问卷或评论素材】，输出 ICP 画像与痛点清单。 | 用「客户调研」整理【产品】的客户洞察：【贴访谈、问卷或评论素材】，输出 ICP 画像与痛点清单。须交付：marketing-deliverable.md（按场… |
| `mkt-directory-submissions` | 目录提交 | 用「目录提交」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「目录提交」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-dmp-ab-test-plan` | ab-test-plan | 用「ab-test-plan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「ab-test-plan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-ad-creative` | ad-creative | 用「ad-creative」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「ad-creative」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-add-integration` | add-integration | 用「add-integration」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「add-integration」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-aeo-audit` | aeo-audit | 用「aeo-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「aeo-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分… |
| `mkt-dmp-aeo-geo` | aeo-geo | 用「aeo-geo」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「aeo-geo」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任… |
| `mkt-dmp-agency-dashboard` | agency-dashboard | 用「agency-dashboard」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「agency-dashboard」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-analytics-insights` | analytics-insights | 用「analytics-insights」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「analytics-insights」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-anomaly-scan` | anomaly-scan | 用「anomaly-scan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「anomaly-scan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-attribution-model` | attribution-model | 用「attribution-model」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「attribution-model」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-attribution-report` | attribution-report | 用「attribution-report」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「attribution-report」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-audience-intelligence` | audience-intelligence | 用「audience-intelligence」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「audience-intelligence」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景… |
| `mkt-dmp-audience-profile` | audience-profile | 用「audience-profile」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「audience-profile」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-autopilot-status` | autopilot-status | 用「autopilot-status」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「autopilot-status」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-backlink-gap` | backlink-gap | 用「backlink-gap」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「backlink-gap」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-brand-setup` | brand-setup | 用「brand-setup」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「brand-setup」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-budget-optimizer` | budget-optimizer | 用「budget-optimizer」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「budget-optimizer」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-budget-tracker` | budget-tracker | 用「budget-tracker」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「budget-tracker」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-c2pa-metadata` | c2pa-metadata | 用「c2pa-metadata」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「c2pa-metadata」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-dmp-campaign-audit` | campaign-audit | 用「campaign-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「campaign-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-campaign-orchestrator` | campaign-orchestrator | 用「campaign-orchestrator」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「campaign-orchestrator」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景… |
| `mkt-dmp-campaign-plan` | campaign-plan | 用「campaign-plan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「campaign-plan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-dmp-campaign-status` | campaign-status | 用「campaign-status」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「campaign-status」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-case-study-plan` | case-study-plan | 用「case-study-plan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「case-study-plan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-check` | check | 用「check」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「check」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目… |
| `mkt-dmp-churn-risk` | churn-risk | 用「churn-risk」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「churn-risk」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统… |
| `mkt-dmp-client-onboarding` | client-onboarding | 用「client-onboarding」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「client-onboarding」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-client-proposal` | client-proposal | 用「client-proposal」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「client-proposal」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-client-report` | client-report | 用「client-report」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「client-report」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-dmp-client-validation-document` | client-validation-document | 用「client-validation-document」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「client-validation-document」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.m… |
| `mkt-dmp-cohort-analysis` | cohort-analysis | 用「cohort-analysis」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「cohort-analysis」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-competitor-alerts` | competitor-alerts | 用「competitor-alerts」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「competitor-alerts」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-competitor-analysis` | competitor-analysis | 用「competitor-analysis」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「competitor-analysis」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构… |
| `mkt-dmp-competitor-monitor` | competitor-monitor | 用「competitor-monitor」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「competitor-monitor」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-competitor-pages` | competitor-pages | 用「competitor-pages」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「competitor-pages」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-connect` | connect | 用「connect」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「connect」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任… |
| `mkt-dmp-content-brief` | content-brief | 用「content-brief」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「content-brief」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-dmp-content-calendar` | content-calendar | 用「content-calendar」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「content-calendar」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-content-decay-scan` | content-decay-scan | 用「content-decay-scan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「content-decay-scan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-content-engine` | content-engine | 用「content-engine」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「content-engine」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-content-repurpose` | content-repurpose | 用「content-repurpose」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「content-repurpose」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-context-engine` | context-engine | 用「context-engine」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「context-engine」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-continuous-improvement-loop` | continuous-improvement-loop | 用「continuous-improvement-loop」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「continuous-improvement-loop」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.… |
| `mkt-dmp-counter-narrative` | counter-narrative | 用「counter-narrative」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「counter-narrative」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-cowork-setup` | cowork-setup | 用「cowork-setup」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「cowork-setup」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-creative-health` | creative-health | 用「creative-health」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「creative-health」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-creative-testing-framework` | creative-testing-framework | 用「creative-testing-framework」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「creative-testing-framework」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.m… |
| `mkt-dmp-credential-switch` | credential-switch | 用「credential-switch」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「credential-switch」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-crisis-response` | crisis-response | 用「crisis-response」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「crisis-response」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-crm-sync` | crm-sync | 用「crm-sync」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「crm-sync」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配… |
| `mkt-dmp-cro` | cro | 用「cro」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「cro」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-dmp-dark-funnel` | dark-funnel | 用「dark-funnel」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「dark-funnel」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-data-export` | data-export | 用「data-export」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「data-export」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-data-import` | data-import | 用「data-import」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「data-import」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-digital-pr` | digital-pr | 用「digital-pr」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「digital-pr」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统… |
| `mkt-dmp-email-sequence` | email-sequence | 用「email-sequence」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「email-sequence」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-emerging-channels` | emerging-channels | 用「emerging-channels」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「emerging-channels」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-engagement-workflow` | engagement-workflow | 用「engagement-workflow」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「engagement-workflow」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构… |
| `mkt-dmp-entity-audit` | entity-audit | 用「entity-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「entity-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-eval-config` | eval-config | 用「eval-config」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「eval-config」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-eval-content` | eval-content | 用「eval-content」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「eval-content」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-eval-suite` | eval-suite | 用「eval-suite」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「eval-suite」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统… |
| `mkt-dmp-exec-summary` | exec-summary | 用「exec-summary」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「exec-summary」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-executive-dashboard` | executive-dashboard | 用「executive-dashboard」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「executive-dashboard」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构… |
| `mkt-dmp-focus-group` | focus-group | 用「focus-group」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「focus-group」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-four-core-documents` | four-core-documents | 用「four-core-documents」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「four-core-documents」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构… |
| `mkt-dmp-funnel-architect` | funnel-architect | 用「funnel-architect」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「funnel-architect」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-funnel-audit` | funnel-audit | 用「funnel-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「funnel-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-geo-monitor` | geo-monitor | 用「geo-monitor」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「geo-monitor」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-growth-engineering` | growth-engineering | 用「growth-engineering」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「growth-engineering」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-growth-plan` | growth-plan | 用「growth-plan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「growth-plan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-gsc-ai-performance` | gsc-ai-performance | 用「gsc-ai-performance」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「gsc-ai-performance」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-help` | help | 用「help」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「help」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-dmp-hreflang-check` | hreflang-check | 用「hreflang-check」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「hreflang-check」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-image-seo-audit` | image-seo-audit | 用「image-seo-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「image-seo-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-import-guidelines` | import-guidelines | 用「import-guidelines」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「import-guidelines」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-import-sop` | import-sop | 用「import-sop」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「import-sop」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统… |
| `mkt-dmp-import-template` | import-template | 用「import-template」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「import-template」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-influencer-brief` | influencer-brief | 用「influencer-brief」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「influencer-brief」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-influencer-creator` | influencer-creator | 用「influencer-creator」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「influencer-creator」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-integrations` | integrations | 用「integrations」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「integrations」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-intelligence-report` | intelligence-report | 用「intelligence-report」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「intelligence-report」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构… |
| `mkt-dmp-journey-design` | journey-design | 用「journey-design」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「journey-design」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-keyword-cluster` | keyword-cluster | 用「keyword-cluster」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「keyword-cluster」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-keyword-research` | keyword-research | 用「keyword-research」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「keyword-research」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-landing-page-audit` | landing-page-audit | 用「landing-page-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「landing-page-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-language-audit` | language-audit | 用「language-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「language-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-language-config` | language-config | 用「language-config」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「language-config」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-launch-ad-campaign` | launch-ad-campaign | 用「launch-ad-campaign」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「launch-ad-campaign」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-launch-campaign` | launch-campaign | 用「launch-campaign」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「launch-campaign」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-launch-plan` | launch-plan | 用「launch-plan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「launch-plan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-lead-import` | lead-import | 用「lead-import」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「lead-import」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-learn` | learn | 用「learn」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「learn」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目… |
| `mkt-dmp-live-dashboard` | live-dashboard | 用「live-dashboard」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「live-dashboard」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-local-seo` | local-seo | 用「local-seo」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「local-seo」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分… |
| `mkt-dmp-local-seo-audit` | local-seo-audit | 用「local-seo-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「local-seo-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-localize-campaign` | localize-campaign | 用「localize-campaign」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「localize-campaign」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-loop-detect` | loop-detect | 用「loop-detect」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「loop-detect」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-market-weather` | market-weather | 用「market-weather」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「market-weather」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-marketing-automation` | marketing-automation | 用「marketing-automation」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「marketing-automation」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结… |
| `mkt-dmp-martech-audit` | martech-audit | 用「martech-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「martech-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-dmp-media-plan` | media-plan | 用「media-plan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「media-plan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统… |
| `mkt-dmp-message-test` | message-test | 用「message-test」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「message-test」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-multilingual-score` | multilingual-score | 用「multilingual-score」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「multilingual-score」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-narrative-landscape` | narrative-landscape | 用「narrative-landscape」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「narrative-landscape」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构… |
| `mkt-dmp-narrative-tracker` | narrative-tracker | 用「narrative-tracker」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「narrative-tracker」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-page-seo-analysis` | page-seo-analysis | 用「page-seo-analysis」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「page-seo-analysis」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-paid-advertising` | paid-advertising | 用「paid-advertising」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「paid-advertising」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-pdf-report` | pdf-report | 用「pdf-report」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「pdf-report」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统… |
| `mkt-dmp-performance-check` | performance-check | 用「performance-check」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「performance-check」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-performance-report` | performance-report | 用「performance-report」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「performance-report」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-dmp-pipeline-update` | pipeline-update | 用「pipeline-update」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「pipeline-update」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-pr-pitch` | pr-pitch | 用「pr-pitch」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「pr-pitch」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配… |
| `mkt-dmp-pricing-test` | pricing-test | 用「pricing-test」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「pricing-test」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-programmatic-seo` | programmatic-seo | 用「programmatic-seo」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「programmatic-seo」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-prompt-test` | prompt-test | 用「prompt-test」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「prompt-test」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-publish-blog` | publish-blog | 用「publish-blog」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「publish-blog」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-qbr-plan` | qbr-plan | 用「qbr-plan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「qbr-plan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配… |
| `mkt-dmp-quality-report` | quality-report | 用「quality-report」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「quality-report」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-rank-monitor` | rank-monitor | 用「rank-monitor」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「rank-monitor」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-recall` | recall | 用「recall」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「recall」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务… |
| `mkt-dmp-redirect-manager` | redirect-manager | 用「redirect-manager」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「redirect-manager」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-region-config` | region-config | 用「region-config」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「region-config」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-dmp-reputation-management` | reputation-management | 用「reputation-management」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「reputation-management」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景… |
| `mkt-dmp-retargeting-strategy` | retargeting-strategy | 用「retargeting-strategy」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「retargeting-strategy」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结… |
| `mkt-dmp-review-response` | review-response | 用「review-response」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「review-response」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-roi-calculator` | roi-calculator | 用「roi-calculator」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「roi-calculator」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-save-knowledge` | save-knowledge | 用「save-knowledge」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「save-knowledge」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-schedule-social` | schedule-social | 用「schedule-social」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「schedule-social」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-search-knowledge` | search-knowledge | 用「search-knowledge」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「search-knowledge」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-segment-audience` | segment-audience | 用「segment-audience」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「segment-audience」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-send-email-campaign` | send-email-campaign | 用「send-email-campaign」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「send-email-campaign」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构… |
| `mkt-dmp-send-notification` | send-notification | 用「send-notification」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「send-notification」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-send-report` | send-report | 用「send-report」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「send-report」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-send-sms` | send-sms | 用「send-sms」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「send-sms」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配… |
| `mkt-dmp-seo-audit` | seo-audit | 用「seo-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「seo-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分… |
| `mkt-dmp-seo-drift` | seo-drift | 用「seo-drift」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「seo-drift」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分… |
| `mkt-dmp-seo-implement` | seo-implement | 用「seo-implement」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「seo-implement」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-dmp-seo-plan` | seo-plan | 用「seo-plan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「seo-plan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配… |
| `mkt-dmp-serp-tracker` | serp-tracker | 用「serp-tracker」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「serp-tracker」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-share-of-voice` | share-of-voice | 用「share-of-voice」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「share-of-voice」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-simulate` | simulate | 用「simulate」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「simulate」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配… |
| `mkt-dmp-sitemap-manager` | sitemap-manager | 用「sitemap-manager」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「sitemap-manager」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-social-strategy` | social-strategy | 用「social-strategy」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「social-strategy」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-sop-library` | sop-library | 用「sop-library」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「sop-library」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-status` | status | 用「status」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「status」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务… |
| `mkt-dmp-switch-brand` | switch-brand | 用「switch-brand」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「switch-brand」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-sync-memory` | sync-memory | 用「sync-memory」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「sync-memory」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-team-assign` | team-assign | 用「team-assign」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「team-assign」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-dmp-tech-seo-audit` | tech-seo-audit | 用「tech-seo-audit」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「tech-seo-audit」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-dmp-technical-seo` | technical-seo | 用「technical-seo」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「technical-seo」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-dmp-translate-content` | translate-content | 用「translate-content」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「translate-content」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输… |
| `mkt-dmp-validate-output` | validate-output | 用「validate-output」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「validate-output」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-dmp-validate-profile` | validate-profile | 用「validate-profile」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「validate-profile」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-dmp-verify-claims` | verify-claims | 用「verify-claims」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「verify-claims」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-dmp-video-script` | 营销视频脚本 | 用「营销视频脚本」为【产品】写一条 60 秒抖音营销视频脚本：3 秒 hook 与时间轴。 | 用「营销视频脚本」为【产品】写一条 60 秒抖音营销视频脚本：3 秒 hook 与时间轴。须交付：02-script-timed.md（时间轴口播脚本）。写入… |
| `mkt-dmp-webinar-plan` | webinar-plan | 用「webinar-plan」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「webinar-plan」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入… |
| `mkt-dmp-what-if` | what-if | 用「what-if」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「what-if」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任… |
| `mkt-dmp-yearly-planner` | yearly-planner | 用「yearly-planner」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「yearly-planner」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。… |
| `mkt-draft-content` | 渠道草稿 | 用「渠道草稿」按我的内容计划起草本周待发内容：【贴主题或日历】，每个渠道一版。 | 用「渠道草稿」按我的内容计划起草本周待发内容：【贴主题或日历】，每个渠道一版。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-email-bible` | email-marketing-bible | 用「email-marketing-bible」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「email-marketing-bible」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景… |
| `mkt-email-sequence` | 邮件序列 | 用「邮件序列」为【产品】写 5 封新用户邮件：欢迎、价值、案例、催活、转化，各附主题行。 | 用「邮件序列」为【产品】写 5 封新用户邮件：欢迎、价值、案例、催活、转化，各附主题行。须交付：marketing-deliverable.md（按场景结构化… |
| `mkt-emails` | 邮件营销 | 用「邮件营销」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「邮件营销」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-free-tools` | 免费工具 | 用「免费工具」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「免费工具」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-go-live-checklist` | 上线检查清单 | 用「上线检查清单」为【网站或产品】出发布前核对清单：SEO、结构化数据与渠道就绪。 | 用「上线检查清单」为【网站或产品】出发布前核对清单：SEO、结构化数据与渠道就绪。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-image` | 营销生图 | 用「营销生图」生成【数量与用途，如 3 张新品宣传图】：【画面内容、风格与尺寸】。 | 用「营销生图」生成【数量与用途，如 3 张新品宣传图】：【画面内容、风格与尺寸】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-last30days` | last30days | 用「last30days」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「last30days」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统… |
| `mkt-launch` | 上市策略 | 用「上市策略」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「上市策略」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-lead-magnets` | Lead Magnet | 用「Lead Magnet」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「Lead Magnet」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-marketing-ideas` | 创意点子 | 用「创意点子」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「创意点子」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-marketing-plan` | 营销计划 | 用「营销计划」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「营销计划」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-marketing-psychology` | 消费心理 | 用「消费心理」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「消费心理」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-onboarding` | 新用户激活 | 用「新用户激活」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「新用户激活」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目… |
| `mkt-paywalls` | 付费墙 | 用「付费墙」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「付费墙」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-performance-report` | 投放效果报告 | 用「投放效果报告」把【渠道数据】整理成一页效果报告：核心指标、趋势与建议。 | 用「投放效果报告」把【渠道数据】整理成一页效果报告：核心指标、趋势与建议。须交付：marketing-deliverable.md（按场景结构化输出）。写入系… |
| `mkt-pitch-deck` | 比稿演示稿 | 用「比稿演示稿」做一份 10 页可编辑 PPT：主题【提案主题】，用于【客户提案或内部汇报】。 | 用「比稿演示稿」做一份 10 页可编辑 PPT：主题【提案主题】，用于【客户提案或内部汇报】。须交付：marketing-deliverable.md（按场景… |
| `mkt-popups` | 弹窗转化 | 用「弹窗转化」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「弹窗转化」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-pricing` | 定价包装 | 用「定价包装」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「定价包装」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-product-marketing` | 产品营销 | 用「产品营销」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「产品营销」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-programmatic-seo` | 批量 SEO 页 | 用「程序化SEO」规划批量落地页：【品类与变量，如「城市 × 服务」】，输出页面模板与生成清单。 | 用「程序化SEO」规划批量落地页：【品类与变量，如「城市 × 服务」】，输出页面模板与生成清单。须交付：marketing-deliverable.md（按场… |
| `mkt-prospecting` | 潜客开发 | 用「潜客开发」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「潜客开发」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-referrals` | 推荐计划 | 用「推荐计划」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「推荐计划」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-review-mining` | 评论舆情挖掘 | 用「评论舆情挖掘」分析这批评论：【粘贴评论或来源链接】，提炼主题、情感与产品痛点。 | 用「评论舆情挖掘」分析这批评论：【粘贴评论或来源链接】，提炼主题、情感与产品痛点。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-revops` | B2B 收入运营 | 用「B2B 收入运营」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「B2B 收入运营」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配… |
| `mkt-sales-enablement` | 销售赋能 | 用「销售赋能」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「销售赋能」帮我：【说明具体场景、目标与必须包含的信息】。须交付：talk-track.md。写入系统分配任务目录。 |
| `mkt-schema` | 结构化数据 | 用「结构化数据」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「结构化数据」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目… |
| `mkt-screenshots` | mkt-screenshots | 用「mkt-screenshots」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「mkt-screenshots」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）… |
| `mkt-seo-audit` | SEO 审计 | 用「SEO 审计」给【网站域名】做全站体检：技术问题、内容缺口与优先修复清单。 | 用「SEO 审计」给【网站域名】做全站体检：技术问题、内容缺口与优先修复清单。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-signup` | 注册转化 | 用「注册转化」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「注册转化」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-site-architecture` | 站点结构 | 用「站点结构」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「站点结构」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-sms` | 短信触达 | 用「短信触达」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「短信触达」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-social` | 社媒内容与日历 | 用「社媒内容与日历」为【产品】排两周内容日历，含 5 条短视频脚本与发布时间。 | 用「社媒内容与日历」为【产品】排两周内容日历，含 5 条短视频脚本与发布时间。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-strategy-deck` | 策略汇报 PPT | 用「策略汇报 PPT」把【策略方案】整理成 12 页可汇报演示稿：【粘贴方案要点】。 | 用「策略汇报 PPT」把【策略方案】整理成 12 页可汇报演示稿：【粘贴方案要点】。须交付：marketing-deliverable.md（按场景结构化输出… |
| `mkt-typefully` | mkt-typefully | 用「mkt-typefully」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「mkt-typefully」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写… |
| `mkt-typefully-typefully` | typefully | 用「typefully」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「typefully」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分… |
| `mkt-video` | 营销视频 | 用「营销视频」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「营销视频」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构化输出）。写入系统分配任务目录。 |
| `mkt-x-article-publisher` | x-article-publisher | 用「x-article-publisher」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「x-article-publisher」帮我：【说明具体场景、目标与必须包含的信息】。须交付：marketing-deliverable.md（按场景结构… |
| `nova-customer-acquisition-leads` | Nova-智能获客 | 用「Nova-智能获客」帮我找潜在客户：【行业 + 地区，如：北京的人工智能外包项目】，输出整理好的线索表格报告。 | 用「Nova-智能获客」帮我找潜在客户：【行业 + 地区，如：北京的人工智能外包项目】，整理成结构化线索表格报告。须交付：leads-report.md（结构… |
| `nova-ppt-aesthetic-slides` | Nova-美学幻灯 | 用「Nova-美学幻灯」把【主题】做成【页数，如 4】页【画幅，如 16:9】配图 PNG 幻灯（outline → 页描述 → 逐页 generate_im… | 用「Nova-美学幻灯」把【主题】做成【页数，如 4】页【画幅，如 16:9】配图 PNG 幻灯：outline → 页描述 → 逐页生图，逐页 slide-… |
| `nova-research-academic-professional` | Nova-学术专业 | 用「Nova-学术专业」写【课题】专业报告：权威信源、严谨结构、参考文献可追溯。 | 用「Nova-学术专业」写【课题】专业报告：权威信源、严谨结构、参考文献可追溯。须交付：academic-report.md（权威信源、参考文献可追溯）。写入… |
| `nova-research-competitor` | Nova-竞品对标 | 用「Nova-竞品对标」对【品类】做竞品全量对标：竞品清单、维度对比与突围策略。 | 用「Nova-竞品对标」对【品类】做竞品全量对标：竞品清单、维度对比与突围策略。须交付：competitor-benchmark-report.md（竞品清单… |
| `nova-research-general` | Nova-通用调研 | 用「Nova-通用调研」围绕【主题】写综合调研报告：背景、发现、舆情与建议。 | 用「Nova-通用调研」围绕【主题】写综合调研报告：背景、发现、舆情与建议。须交付：research-report.md（背景、发现、舆情与建议）。写入系统分… |
| `nova-research-industry-market` | Nova-行业市场 | 用「Nova-行业市场」写【行业】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。 | 用「Nova-行业市场」写【行业】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。须交付：industry-market-report.md（规模… |
| `nova-research-product-user` | Nova-产品用研 | 用「Nova-产品用研」为【产品】写产品用户研究报告，按固定八章展开。 | 用「Nova-产品用研」为【产品】写产品用户研究报告，按固定八章展开。须交付：product-user-research.md（固定八章）。写入系统分配任务目… |
| `nova-research-user-general` | Nova-用户研究 | 用「Nova-用户研究」做【产品或人群】的八段式用户研究：画像、场景、痛点与决策因素。 | 用「Nova-用户研究」做【产品或人群】的八段式用户研究：画像、场景、痛点与决策因素。须交付：user-research-report.md（八段式用户研究）… |
| `od-after-hours-editorial` | 深夜编辑风视频 | 用「深夜编辑风视频」做【主题】的页面或视频分镜：【说明内容与风格】。 | 用「深夜编辑风视频」做【主题】的页面或视频分镜：【说明内容与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-article-magazine` | 杂志长文 | 用「杂志长文」做【主题或活动】：【说明必须出现的模块与风格】。 | 用「杂志长文」做【主题或活动】：【说明必须出现的模块与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-dashboard` | od-dashboard | 用「数据看板页」做【业务】管理后台首页：左侧菜单、指标卡片、趋势图，用示例数据。 | 用「数据看板页」做【业务】管理后台首页：左侧菜单、指标卡片、趋势图，用示例数据。须交付：index.html（后台首页示例数据）。写入系统分配任务目录。 |
| `od-data-report` | 数据报告页 | 用「数据报告页」做【主题或活动】：【说明必须出现的模块与风格】。 | 用「数据报告页」做【主题或活动】：【说明必须出现的模块与风格】。须交付：report.html（数据汇报页）。写入系统分配任务目录。 |
| `od-deck-magazine` | HTML 比稿 | 用「HTML 比稿」做【主题或活动】：【说明必须出现的模块与风格】。 | 用「HTML 比稿」做【主题或活动】：【说明必须出现的模块与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-digits-fintech` | od-digits-fintech | 用「od-digits-fintech」做【主题】的页面或视频分镜：【说明内容与风格】。 | 用「od-digits-fintech」做【主题】的页面或视频分镜：【说明内容与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-editorial-burgundy` | od-editorial-burgundy | 用「od-editorial-burgundy」做【主题】的页面或视频分镜：【说明内容与风格】。 | 用「od-editorial-burgundy」做【主题】的页面或视频分镜：【说明内容与风格】。须交付：index.html 或指定页面文件。写入系统分配任务… |
| `od-email-marketing` | 邮件营销页 | 用「邮件营销页」做【主题或活动】：【说明必须出现的模块与风格】。 | 用「邮件营销页」做【主题或活动】：【说明必须出现的模块与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-faq-page` | FAQ 页面 | 用「FAQ 页面」做【主题或活动】：【说明必须出现的模块与风格】。 | 用「FAQ 页面」做【主题或活动】：【说明必须出现的模块与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-field-notes-editorial` | 田野笔记视频 | 用「田野笔记视频」做【主题】的页面或视频分镜：【说明内容与风格】。 | 用「田野笔记视频」做【主题】的页面或视频分镜：【说明内容与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-figma` | Figma 工作流 | 用「Figma 工作流」帮我做页面设计：【说明页面类型、内容与风格】。 | 用「Figma 工作流」帮我做页面设计：【说明页面类型、内容与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-image-gen` | od-image-gen | 用「生图存档」生成并保存一张【海报 / 封面 / 插画】图片文件：【画面描述与风格】。 | 用「生图存档」生成并保存一张【海报 / 封面 / 插画】图片文件：【画面描述与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-login-flow` | od-login-flow | 用「登录流程界面」设计【产品】的登录、注册和验证码三个页面，风格简洁。 | 用「登录流程界面」设计【产品】的登录、注册和验证码三个页面，风格简洁。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-mobile-app` | od-mobile-app | 用「手机界面示意」画【2026 FIFA 世界杯观赛指南】，FIFA 蓝金风格，三屏并排、带手机外框。第一步调用 scaffold_mobile_mockup… | 用「手机界面示意」画【2026 FIFA 世界杯观赛指南】，FIFA 蓝金风格，三屏并排、带手机外框。第一步调用 scaffold_mobile_mockup… |
| `od-mobile-onboarding` | od-mobile-onboarding | 用「新手引导三屏」给【App】做首次打开引导：欢迎、价值说明、开始使用。 | 用「新手引导三屏」给【App】做首次打开引导：欢迎、价值说明、开始使用。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-poster-hero` | 海报主视觉 | 用「海报主视觉」做【活动】竖版海报：时间地点、三条亮点，底部留二维码位。 | 用「海报主视觉」做【活动】竖版海报：时间地点、三条亮点，底部留二维码位。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-pricing-page` | 定价页 | 用「定价页」做【主题或活动】：【说明必须出现的模块与风格】。 | 用「定价页」做【主题或活动】：【说明必须出现的模块与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-pricing-upgrade` | 升级页 | 用「升级页」做【主题或活动】：【说明必须出现的模块与风格】。 | 用「升级页」做【主题或活动】：【说明必须出现的模块与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-release-notes-one-pager` | 更新说明页 | 用「更新说明页」做【主题或活动】：【说明必须出现的模块与风格】。 | 用「更新说明页」做【主题或活动】：【说明必须出现的模块与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-research-decision-room` | 调研决策室 | 用「调研决策室」帮我做页面设计：【说明页面类型、内容与风格】。 | 用「调研决策室」帮我做页面设计：【说明页面类型、内容与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-resume` | od-resume | 用「简历网页」把我的经历做成一页求职页面：【粘贴经历、技能与联系方式】。 | 用「简历网页」把我的经历做成一页求职页面：【粘贴经历、技能与联系方式】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-saas-landing` | 官网落地页 | 用「官网落地页」做【产品】介绍页：醒目标题、三个核心功能、价格或试用按钮、页脚联系方式，风格简洁专业。 | 用「官网落地页」做【产品】介绍页：醒目标题、三个核心功能、价格或试用按钮、页脚联系方式，风格简洁专业。须交付：index.html（含标题、功能、CTA、页脚… |
| `od-social-carousel` | 社媒轮播 | 用「社媒轮播」做【主题或活动】：【说明必须出现的模块与风格】。 | 用「社媒轮播」做【主题或活动】：【说明必须出现的模块与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `od-swiss-creative` | od-swiss-creative | 用「od-swiss-creative」做【主题】的页面或视频分镜：【说明内容与风格】。 | 用「od-swiss-creative」做【主题】的页面或视频分镜：【说明内容与风格】。须交付：index.html 或指定页面文件。写入系统分配任务目录。 |
| `open-design` | 设计总控 | 用「设计总控」帮我做一个页面：【页面类型与内容，如：产品介绍页，含标题、三个功能、价格和试用按钮】，自动套用合适的设计系统。 | 用「设计总控」帮我做一个页面：【页面类型与内容，如：产品介绍页，含标题、三个功能、价格和试用按钮】，自动套用合适的设计系统，产出可预览网页。须交付：index… |
| `ora-academic-plotting` | 学术图表绘制 | 用「学术图表绘制」把【实验数据】画成论文级图表：折线与消融对比，输出 PDF/SVG。 | 用「学术图表绘制」把【实验数据】画成论文级图表：折线与消融对比，输出 PDF/SVG。须交付：academic-output.md 或论文级图表 PDF/SV… |
| `ora-brainstorm-research` | 研究选题脑暴 | 用「研究选题脑暴」围绕【研究方向】收敛选题：给 3 个可验证假设与实验设计草图。 | 用「研究选题脑暴」围绕【研究方向】收敛选题：给 3 个可验证假设与实验设计草图。须交付：academic-output.md 或论文级图表 PDF/SVG。写… |
| `ora-ml-paper-writing` | ML 论文撰写 | 用「ML 论文撰写」辅导我这篇作文：【贴题目与我的草稿（没写也行）】，从审题立意到结构语言一步步改。 | 用「ML 论文撰写」辅导我这篇作文：【贴题目与我的草稿（没写也行）】，从审题立意到结构语言一步步改。须交付：academic-output.md 或论文级图表… |
| `ora-research-manager` | 研究项目管理 | 用「研究项目管理」整理【课题】的文献、实验与笔记：输出研究日志与下周计划。 | 用「研究项目管理」整理【课题】的文献、实验与笔记：输出研究日志与下周计划。须交付：academic-output.md 或论文级图表 PDF/SVG。写入系统… |
| `ora-rigor-reviewer` | 论文严谨性评审 | 用「论文严谨性评审」评审这篇稿子：【附论文或草稿】，按审稿标准给分项评分与修改清单。 | 用「论文严谨性评审」评审这篇稿子：【附论文或草稿】，按审稿标准给分项评分与修改清单。须交付：academic-output.md 或论文级图表 PDF/SVG… |
| `ora-systems-paper-writing` | 系统论文撰写 | 用「系统论文撰写」辅导我这篇作文：【贴题目与我的草稿（没写也行）】，从审题立意到结构语言一步步改。 | 用「系统论文撰写」辅导我这篇作文：【贴题目与我的草稿（没写也行）】，从审题立意到结构语言一步步改。须交付：academic-output.md 或论文级图表 … |
| `pd-geo` | AI 搜索全案 | 用「AI 搜索全案」给【品牌】做完整 AI 可见度包：审计、关键词、平台成稿、评分验证与周报。 | 用「AI 搜索全案」给【品牌】做完整 AI 可见度包：审计清单、关键词、多平台成稿、optimized.md、评分验证与 HTML 周报。须交付：aeo-au… |
| `pms-competitive-battlecard` | 竞品 Battlecard | 用「竞品 Battlecard」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「竞品 Battlecard」帮我：【说明具体场景、目标与必须包含的信息】。须交付：battlecard.md。写入系统分配任务目录。 |
| `ppt-master` | 原生可编辑 PPT | 用「原生可编辑 PPT」帮我：【说明具体场景、目标与必须包含的信息】。 | 用「原生可编辑 PPT」帮我：【说明具体场景、目标与必须包含的信息】。须交付：presentation.pptx（8–10 页可编辑 PPT）。写入系统分配任… |
| `remotion-video` | React 程序化视频 | 用「React 程序化视频」搭一个【用途】视频模板：【要参数化的内容，如标题与数字】，方便批量渲染。 | 用「React 程序化视频」搭一个【用途】视频模板：【要参数化的内容，如标题与数字】，方便批量渲染。须交付：03/out.mp4、Remotion 工程目录。… |
| `social-creative-matrix` | 社媒矩阵包 | 用「社媒矩阵包」把一条创意扩成国内 8 平台图文矩阵：【创意主题】，含四套比例配图，先不发布。 | 用「社媒矩阵包」把一条创意扩成国内 8 平台图文矩阵：【创意主题】，含 brief、创意锚点、全平台文案、manifest 与四套比例配图，先不发布。须交付：… |
| `teacher-biology-homework-generation` | teacher-biology-homework-generation | 用「teacher-biology-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。 | 用「teacher-biology-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。须交付：ho… |
| `teacher-biology-lesson-planning` | teacher-biology-lesson-planning | 用「teacher-biology-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提… | 用「teacher-biology-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提… |
| `teacher-biology-unit-review` | teacher-biology-unit-review | 用「teacher-biology-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。 | 用「teacher-biology-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。须交付：unit-revi… |
| `teacher-chemistry-homework-generation` | teacher-chemistry-homework-generation | 用「teacher-chemistry-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。 | 用「teacher-chemistry-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。须交付：… |
| `teacher-chemistry-lesson-planning` | teacher-chemistry-lesson-planning | 用「teacher-chemistry-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动… | 用「teacher-chemistry-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动… |
| `teacher-chemistry-unit-review` | teacher-chemistry-unit-review | 用「teacher-chemistry-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。 | 用「teacher-chemistry-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。须交付：unit-re… |
| `teacher-chinese-homework-generation` | teacher-chinese-homework-generation | 用「teacher-chinese-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。 | 用「teacher-chinese-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。须交付：ho… |
| `teacher-chinese-lesson-planning` | teacher-chinese-lesson-planning | 用「teacher-chinese-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提… | 用「teacher-chinese-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提… |
| `teacher-chinese-unit-review` | teacher-chinese-unit-review | 用「teacher-chinese-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。 | 用「teacher-chinese-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。须交付：unit-revi… |
| `teacher-english-homework-generation` | teacher-english-homework-generation | 用「teacher-english-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。 | 用「teacher-english-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。须交付：ho… |
| `teacher-english-lesson-planning` | teacher-english-lesson-planning | 用「teacher-english-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提… | 用「teacher-english-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提… |
| `teacher-english-unit-review` | teacher-english-unit-review | 用「teacher-english-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。 | 用「teacher-english-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。须交付：unit-revi… |
| `teacher-geography-homework-generation` | teacher-geography-homework-generation | 用「teacher-geography-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。 | 用「teacher-geography-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。须交付：… |
| `teacher-geography-lesson-planning` | teacher-geography-lesson-planning | 用「teacher-geography-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动… | 用「teacher-geography-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动… |
| `teacher-geography-unit-review` | teacher-geography-unit-review | 用「teacher-geography-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。 | 用「teacher-geography-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。须交付：unit-re… |
| `teacher-history-homework-generation` | teacher-history-homework-generation | 用「teacher-history-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。 | 用「teacher-history-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。须交付：ho… |
| `teacher-history-lesson-planning` | teacher-history-lesson-planning | 用「teacher-history-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提… | 用「teacher-history-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提… |
| `teacher-history-unit-review` | teacher-history-unit-review | 用「teacher-history-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。 | 用「teacher-history-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。须交付：unit-revi… |
| `teacher-homework-generation` | teacher-homework-generation | 用「作业生成」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。 | 用「作业生成」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。须交付：homework.md（分层作业 + 答案）。写入系统分配任务目录。 |
| `teacher-lesson-planning` | teacher-lesson-planning | 用「老师备课」帮我设计一节课：【年级 + 课题】，输出教学目标、课堂活动、提问设计与配套练习。 | 用「老师备课」帮我设计一节课：【年级 + 课题】，输出教学目标、课堂活动、提问设计与配套练习。须交付：lesson-plan.md（目标、活动、练习）。写入系… |
| `teacher-math-homework-generation` | teacher-math-homework-generation | 用「teacher-math-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。 | 用「teacher-math-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。须交付：homew… |
| `teacher-math-lesson-planning` | teacher-math-lesson-planning | 用「teacher-math-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提问设计… | 用「teacher-math-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提问设计… |
| `teacher-math-unit-review` | teacher-math-unit-review | 用「teacher-math-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。 | 用「teacher-math-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。须交付：unit-review.… |
| `teacher-physics-homework-generation` | teacher-physics-homework-generation | 用「teacher-physics-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。 | 用「teacher-physics-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。须交付：ho… |
| `teacher-physics-lesson-planning` | teacher-physics-lesson-planning | 用「teacher-physics-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提… | 用「teacher-physics-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、提… |
| `teacher-physics-unit-review` | teacher-physics-unit-review | 用「teacher-physics-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。 | 用「teacher-physics-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。须交付：unit-revi… |
| `teacher-politics-homework-generation` | teacher-politics-homework-generation | 用「teacher-politics-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。 | 用「teacher-politics-homework-generation」出一份分层作业：【年级 + 本周所学内容】，含基础、提高两档，附答案。须交付：h… |
| `teacher-politics-lesson-planning` | teacher-politics-lesson-planning | 用「teacher-politics-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、… | 用「teacher-politics-lesson-planning」帮我设计一节课：【年级 + 课题，如：八年级上册《光的折射》】，输出教学目标、课堂活动、… |
| `teacher-politics-unit-review` | teacher-politics-unit-review | 用「teacher-politics-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。 | 用「teacher-politics-unit-review」帮我复习：【年级 + 单元名】，输出知识结构图、易错点清单和一套自测题。须交付：unit-rev… |
| `tool-compose-images-document` | 图像合成文档 | 用「图像合成文档」：【说明输入内容与期望产出】。 | 用「图像合成文档」：【说明输入内容与期望产出】。须交付：按工具产出对应格式文件。写入系统分配任务目录。缺 Key 或外部服务不可用时仍交付 md 说明，勿中断。 |
| `tool-export-document` | 一键导出办公文档 | 用「一键导出办公文档」：【说明输入内容与期望产出】。 | 用「一键导出办公文档」：【说明输入内容与期望产出】。须交付：按工具产出对应格式文件。写入系统分配任务目录。缺 Key 或外部服务不可用时仍交付 md 说明，勿… |
| `tool-generate-image` | 对话生图 | 用「对话生图」生成图片：【画面描述 + 数量 + 比例，如 3 张 16:9 露营装备主视觉】。 | 用「对话生图」生成图片：【画面描述 + 数量 + 比例，如 3 张 16:9 露营装备主视觉】。须交付：*.png 或 *.jpg。写入系统分配任务目录。缺 … |
| `tool-generate-speech` | 语音合成 | 用「语音合成」：【说明输入内容与期望产出】。 | 用「语音合成」：【说明输入内容与期望产出】。须交付：按工具产出对应格式文件。写入系统分配任务目录。缺 Key 或外部服务不可用时仍交付 md 说明，勿中断。 |
| `tool-generate-video` | 营销生视频 | 用「营销生视频」生成一段【时长与用途，如 8 秒抖音开场】视频：【画面描述与节奏】。 | 用「营销生视频」生成一段【时长与用途，如 8 秒抖音开场】视频：【画面描述与节奏】。须交付：*.mp4。写入系统分配任务目录。缺 Key 或外部服务不可用时仍… |
| `tool-ocr-editable-pptx` | 图片转可编辑 PPT | 用「图片转可编辑 PPT」：【说明输入内容与期望产出】。 | 用「图片转可编辑 PPT」：【说明输入内容与期望产出】。须交付：按工具产出对应格式文件。写入系统分配任务目录。缺 Key 或外部服务不可用时仍交付 md 说明… |
| `tool-parse-attachment` | 分析对话附件 | 用「分析对话附件」：【说明输入内容与期望产出】。 | 用「分析对话附件」：【说明输入内容与期望产出】。须交付：按工具产出对应格式文件。写入系统分配任务目录。缺 Key 或外部服务不可用时仍交付 md 说明，勿中断。 |
| `tool-render-html-video` | HTML 转视频 | 用「HTML 转视频」把【HTML 页面路径】导出成【时长与分辨率，如 10 秒 1080p】MP4。 | 用「HTML 转视频」把【HTML 页面路径】导出成【时长与分辨率，如 10 秒 1080p】MP4。须交付：*.mp4。写入系统分配任务目录。缺 Key 或… |
| `tool-transcribe-audio` | 语音转写 | 用「语音转写」：【说明输入内容与期望产出】。 | 用「语音转写」：【说明输入内容与期望产出】。须交付：按工具产出对应格式文件。写入系统分配任务目录。缺 Key 或外部服务不可用时仍交付 md 说明，勿中断。 |
| `tool-web-search` | 联网搜索 | 用「联网搜索」查【主题】的最新资料，整理 5 条来源与要点。 | 用「联网搜索」查【主题】的最新资料，整理 5 条来源与要点。须交付：search-summary.md（5 条来源与要点）。写入系统分配任务目录。缺 Key … |
| `yixiaoer` | 国内社媒发布 | 用「国内社媒发布」把这篇图文存到【平台，如小红书】草稿箱：【粘贴内容或文件】，先不公开发布。 | 用「国内社媒发布」把这篇图文存到【平台，如小红书】草稿箱：【粘贴内容或文件】，先不公开发布。须交付：草稿任务编号（不公开发布）。写入系统分配任务目录。 |

## 快照

- `F:\Ai-pilotdeck\artifacts\prompt-upgrade-20260711/`

