# 最终交付验收门控报告（2026-06-22）

## 结论

本次已落地第一版“最终交付验收门控”：只在 AgentLoop 准备完成交付前运行，不审阅中间过程；默认使用 L0/L1 规则验收，拦截白屏、乱码、空壳、半截文件、数量不足、类型错误和多文件包缺项等硬伤。主观美术质量不作为自动重做条件。

建议进入下一阶段小流量使用。L2 深度审阅仍未默认启用，应只在高价值交付、反复失败或用户明确要求严格审阅时再加。

## 已覆盖能力

- 最终验收状态：记录预期类型/数量、已验证成果、缺失成果、坏成果、失败原因和续做提示。
- L0/L1 门控：HTML 结构与占位检查、PPTX 真文件检查、网页数量检查、分镜包必需文件检查。
- GEO 全案门控：`pd-geo` 品牌 GEO 全案会逐一验收审计清单、关键词、3 平台成稿、`optimized.md`、`schema.jsonld`、引用评分报告和 `visibility-report.html`，不再只验一个代表性 `.md` 文件。
- 成果路径门控：最终回复中列出的裸文件名、图片、JSON/JSON-LD、子目录相对路径都会进入验收；路径不准确或文件不存在时进入修复，而不是显示“自检通过”。
- 交互验收门控：所有用户可点击的成果入口（正文链接、过程区链接、成果卡片、弹窗、前往文件夹）必须逐一验证可解析、可打开、内容可读；展示数量必须等于验证通过数量。
- 自动修复：验收失败走 `acceptance_repair`，计入 `RecoveryBudget` recoverable lane，并注入精准续做提示。
- UI 文案：过程区只展示“正在检查成果 / 正在补齐成果 / 已通过自检”，不展示 raw key、内部错误或审阅细节。
- 风险控制：最终验收只由引擎侧 `AgentLoop` 负责续跑，避免与 UI 兜底续跑并行叠乘。

## 雷蛇 GEO 真实案例复盘

用户反馈的“雷蛇灵刃2026 GEO 全案”实际产物位于 SaaS 云端工作区：

`artifacts/razer-blade-2026-geo/`

排查结果：

- 真实目录只有 10 个文件，UI 成果面板曾显示 12 个，额外的 `blade16-hero.png`、`comparison-thickness.png` 在该工作区不存在。
- `visibility-report.html` 真实路径是 `artifacts/razer-blade-2026-geo/report/visibility-report.html`，浏览器实测可打开，页面标题和正文正常；用户访问错误的根因是交付列表里给了错误裸路径 `visibility-report.html`。
- `optimized.md` 真实路径是 `content/optimized.md`，小红书草稿真实路径是 `xiaohongshu-draft/draft-manifest.json`，最终交付却显示为裸文件名，导致“前往文件夹”和预览容易落到错误位置。
- 旧验收逻辑只按一个代表扩展名筛选候选成果；GEO 任务优先命中 `.md`，因此漏验 `visibility-report.html`、`schema.jsonld` 和图片。
- UI 侧 `useValidatedDeliverables` 在验证结果为空时会回退展示原始 items，导致全是坏路径时仍可能显示为 pending 成果。
- 正文 Markdown 链接已带 `turnArtifactDir`，但部分过程区/工具详情/裸文件链接打开时没有把本轮目录继续传给 `onFileOpen`，导致 `zhihu-article.md` 这类实际在 `content/` 子目录的文件点击后可能找错位置。

本轮已补：

- `validateEngineDeliverables` 改为验收所有候选成果，不再只验一个扩展名。
- 路径提取扩展到 `jsonld/json/png/jpg/webp/svg` 和子目录相对路径，并避免把远程 URL 当本地成果。
- `pd-geo` 正确归属到 GEO profile，并为品牌 GEO 全案补齐必需产物清单。
- `useValidatedDeliverables` 验证完成后不再把空结果回退成原始坏成果。
- `DeliverablePathLink` 打开文件时会把 `hintDir` 传入 `FileOpenOptions`，过程区/正文里的裸 MD 链接也能解析到真实子目录。
- 服务端批量成果验证上限从 20 提高到 80，避免多成果任务只验前一部分。

## 验证结果

- `npm run test:final-acceptance`：通过，35 个 vitest 用例 + 4 个 node test 用例。
- `npm run test:final-acceptance`（雷蛇 GEO 回归后）：通过，35 个 vitest 用例 + 6 个 node test 用例。
- `npm run test:acceptance-retry`：通过，覆盖“不合格 HTML → 生成修复提示 → 修复后通过”。
- `npm run test:process-ux`：通过，过程 UX 相关 22 个用例。
- `npm --workspace ui run test -- src/shared/useValidatedDeliverables.test.tsx src/shared/processTimelineBuilder.test.ts src/shared/processStepLabels.test.ts`：通过，验证成果面板不会在验证后继续展示全量坏路径。
- `npm --workspace ui run test -- src/components/chat/deliverables/DeliverablePathLink.test.tsx src/shared/useValidatedDeliverables.test.tsx src/components/chat-v2/MessagesPaneV2.render.test.tsx`：通过，验证裸 MD 链接携带本轮目录并打开解析后的真实文件。
- `npm run test:p0-p2:full`：通过，P0-P2 单元、集成和自检均通过。
- `npm run test:recovery-wuyutai`：通过，生成 `docs/recovery-stability-report-2026-06-22.md`。
- `npm run test:recovery-beijing-ai-report`：通过。
- `npm run analyze:task-completion`：通过，当前基线显示交付类干预率 24.2%，雷蛇 HTML 样本仍归类为 incomplete_html，可作为后续回测对照。
- `npm run build`：通过。
- UI 过程标签单测：通过，无重复 key warning。

## 不得宣称通过的 P0 场景

以下场景若后续回归出现，仍应视为门控失败：

- 白屏或乱码 HTML 仍作为成功成果展示。
- 用户明确要 5 页/多文件包，但数量不足仍显示完成。
- 用户要 PPTX，但只交 HTML 或脚本。
- 缺 Key、缺附件、权限、验证码等不可替代条件被自动空转。
- 引擎续跑和 UI 续跑同时触发，形成双重续跑。

## 剩余风险

- HTML 页数判断依赖 `<section>`、`slide/page` class、`data-page` 等结构信号；极少数合法单页复杂网页可能需要后续补更多结构识别。
- L2 深度审阅未默认启用，因此无法判断更复杂的语义缺口，只负责硬伤底线。
- 历史会话不会主动触发新验收续跑；历史回放只用于展示和分析。
- `analyze:task-completion` 是开发前后对比基线，本次还需要后续真实任务样本验证干预率是否下降。
