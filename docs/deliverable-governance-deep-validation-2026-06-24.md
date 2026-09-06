# 交付治理深度验收报告

生成时间：2026-06-24T06:40:00+08:00

环境：Bridge `http://127.0.0.1:3001` · UI `http://127.0.0.1:5173` · `npm run dev:saas` 实机

---

## 执行摘要

| 大类 | 结论 | 通过/合计 |
|------|------|-----------|
| ① 五入口统一 | **通过（门禁 + 实机 API）** | 12/12 核心项 |
| ② 对话过程稳定性 | **通过** | 8/8 |
| ③ 任务交付与意图对齐 | **通过（吴裕泰 GEO fixture）** | 6/6 |

**总体结论：本轮深度验收主链通过。** 两项观察项不影响本次交付表格修复结论，但建议纳入下一轮 Playwright 专项。

观察项：
1. `check-white-screen` 未带登录态会落到 `/login`，不能代表工作区白屏（需带 token 或先登录）。
2. `ui-artifact-preview-check` 仍走旧成果卡片探针，**尚未覆盖新版 `deliverable-summary-table`**；需在完成回合的实机对话中补测。
3. 历史会话四线 audit 原始对齐率 65.2%，主因 `missing_on_disk`（磁盘文件已删/迁移），可执行对齐率 **92.1%**。

---

## ① 五入口统一（多任务 / 多角度 / 多场景）

**五入口定义**：正文可点链接 · 交付汇总表 · 成果弹窗/overlay · 右栏 SuperPreview · 前往任务文件夹（+ 服务端 `file/resolve` 为统一 resolve 中枢）。

### 自动化门禁

| ID | 场景 | 命令 | 结果 |
|----|------|------|------|
| A-01 | 引擎 verified vs UI display 对齐 | `test:display-engine-alignment` | ✅ |
| A-02 | 吴裕泰 Campaign 6 文件 × 5 探针 resolve 一致 | `test:four-line-e2e` | ✅ 6×5 |
| A-03 | 路径碰撞 / reconcile / pickPrimary | `test:deliverable-paths` | ✅ |
| A-04 | 103 会话 / 161 turn 四线 audit | `test:four-line-audit` | ✅ G-4L2：actionable **92.1%** |

### 多用户实机（HTTP + Playwright）

| ID | 角色 | 场景 | 结果 |
|----|------|------|------|
| A-U1 | admin | 登录 + 项目列表 | ✅ 6 项目 |
| A-U2 | 普通用户 `dgval_*` | 注册/登录 + 独立租户 | ✅ |
| A-U3/U4 | admin | `deliverables/validate`（吴裕泰 audit-checklist） | ✅ verified |
| A-U3/U4 | 普通用户 | 同上 API | ✅ verified |
| A-PW | admin + 成员 | Playwright：`isolation` / `process-ux-live` / `chat-experience` / `deep-uat` | ✅ 4 specs |

### Playwright 实机 UI 脚本（补跑）

| 脚本 | 结果 | 说明 |
|------|------|------|
| `ui-regression-check.mjs` | ✅ | 欢迎 chip、能力中心、Key 提示 |
| `ui-artifact-preview-check.mjs` | ✅（非 strict） | 文件写入可见；**成果面板/汇总表探针未命中**（无完成回合上下文） |
| `check-white-screen.mjs` | ⚠️ | 未登录跳转 login，非白屏 |

---

## ② 对话过程与进程稳定性

| ID | 项 | 结果 |
|----|----|------|
| B-00 | dev:saas 健康检查 | ✅ |
| B-01 | `test:process-ux`（22 项） | ✅ |
| B-02 | `test:dialogue-stability:adversarial` | ✅ 坏 HTML 门控 / 分镜缺件 / raw 遮蔽 / 续跑 owner / 实机 Playwright |
| B-PW1 | 无「正在换方案重试」等恐慌文案 | ✅ |
| B-PW2 | 过程 dock ≤1，无重复 ProcessClueStrip | ✅ |
| B-PW3 | Composer 可输入 | ✅ |
| B-PW4 | 全屏 process-timeline ≤1 | ✅ |
| B-PW5 | 无 tool_recovery 原文泄漏 | ✅ |

---

## ③ 任务交付验证（重点：意图清单 ↔ 汇总表）

### 术语对齐

| 概念 | 含义 |
|------|------|
| **意图清单** | 用户发起任务后，系统从目标解析出的应交付文件集合（引擎 `TaskGoalContract.requiredFiles` + pd-geo 标准文件名 + 助手正文表格） |
| **交付汇总表** | 回合结束 UI 组件 `DeliverableSummaryTable`：列 **交付物名称**（文档标题）/ **文件名** / **文件链接** |

### 吴裕泰 GEO fixture 验收（本轮修复重点）

用户目标：`帮【吴裕泰】做品牌 GEO 全案… pd-geo …`

| ID | 断言 | 结果 | 证据 |
|----|------|------|------|
| C-01 | 汇总表收集 **5** 个交付物 | ✅ | audit-checklist / keywords / optimized / schema.jsonld / score-estimate |
| C-02 | 交付物名称 **非**泛称「文档」 | ✅ | 审计清单、关键词与验证问句、优化主稿、结构化数据、评分评估 |
| C-03 | 引擎识别 GEO profile | ✅ | `profile=geo`，契约 requiredFiles=7（全案标准包） |
| C-04 | **意图清单文件名 ↔ 汇总表逐一对应** | ✅ | 5/5 basename 完全匹配 |
| C-05 | 名称列均为中文文档标题 | ✅ | |
| C-VIT | 交付链 Vitest（collect / policy / labels / session-list） | ✅ | |

### 意图清单与汇总表对应示例

| 交付物名称（文档标题） | 文件名 | 意图来源 |
|------------------------|--------|----------|
| 审计清单 | audit-checklist.md | pd-geo 标准 + KNOWN 映射 |
| 关键词与验证问句 | keywords.md | pd-geo 标准 |
| 优化主稿 | optimized.md | pd-geo 标准 |
| 结构化数据 | schema.jsonld | pd-geo 标准 |
| 评分评估 | score-estimate.md | pd-geo 标准 |

### 已知口径差异（观察，非本轮回归失败）

- 引擎 **GEO 全案契约**（`taskGoalContract`）列出 **7** 项（含 `geo-aeo-audit-checklist.md`、`visibility-report.html` 等 Gateway 验收名）。
- **pd-geo 技能** 吴裕泰目录实际落盘为 **5** 项标准名（上表）。
- UI 汇总表按 **turn 目录展开 + pd-geo 标题映射** 与后者对齐；全案 7 项与 5 项的统一展示仍建议在引擎 `verifiedPaths` 写入层做一次性对齐（后续专项）。

---

## 建议下一轮补测

1. 新增 Playwright：`data-testid="deliverable-summary-table"` 在完成 GEO 回合后断言三列与 5 文件。
2. `check-white-screen` 改为先 `ensurePlaywrightWorkspace` 再探针。
3. 可选：`FOUR_LINE_LIVE=1` 跑 `four-line-alignment-acceptance.mjs` 管理员 + 3 普通用户 Gateway 新建对话。

---

报告脚本：`node --import tsx scripts/deliverable-governance-deep-validation.mjs`
