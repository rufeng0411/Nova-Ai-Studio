# ROG 批测深度分析（2026-07-05）

> 样本：9 条 ROG 营销批测会话 HTML 导出（`web-s_*-2026-07-05.html`）  
> 对照基线：[`goal-loop-phase4-kpi-baseline.json`](./goal-loop-phase4-kpi-baseline.json)

## 1. 汇总 KPI

| 指标 | Phase 4 批测 | 目标（Phase 4+） | 度量 |
|------|-------------|-----------------|------|
| 用户零干预完成率 | **4/9（44%）** | ≥7/9（78%） | 导出 HTML `role-user` 计数 |
| 单会话用户发言中位数 | **2** | **1** | 同上 |
| Campaign 类 assistant 消息 | **数百条** | **<80** | 导出 message 估算 |
| phantom missing 进入 repair | **有** | **0** | fixture + `analyze-rog-batch-exports.mjs` |
| `analyze:task-completion` 干预率 | 见基线 JSON | **≤20%** | `npm run analyze:task-completion --gate` |

基线文件记录 Phase 4 合并前 `zeroUserContinueRate: 0.35`、`falseCompleteRate: 0.05`；本批实机 **44%** 零干预，高于基线目标 35%，但仍低于 Phase 4+ 目标 78%。

## 2. 会话矩阵

| # | 任务 | Session 前缀 | 用户发言 | 消息量 | 验收态（末段） | 判定 |
|---|------|-------------|---------|--------|---------------|------|
| 1 | 正式调研报告 | `ab42c821` | 1 | 34 | `passed` | **一次成功** |
| 2 | 内容 IP 全案 | `b269ebd2` | 1 | 64 | 全程 `needs_repair`（10 文件已落盘） | **一次成功*** |
| 3 | 销售 Battlecard | `e56b3a8c` | 3 | 44 | 最终 `passed` | **需干预** |
| 4 | 品牌广告分镜包 | `7e5b46b4` | 1 | 87 | `passed` | **一次成功** |
| 5 | Campaign 全案 | `e67172cc` | ≥3 | 极大 | repair + phantom 缺口 | **严重失败** |
| 6 | AI 搜索可见度审计 | `32722b6a` | 1 | 42 | `passed` | **一次成功** |
| 7 | Programmatic SEO | `fb81e334` | 2 | 36 | 无 SDM 元数据 | **需干预** |
| 8 | 获客套件 | `57dfa750` | 3 | 371 | 长 repair / 预览失败 | **严重失败** |
| 9 | HTML 演示 ROG2026 | `78a3a26e` | 3 | 28 | 产出 HTML，stale 2.5h | **需干预** |

\* 内容 IP：用户无续跑，但 SDM/验收假阴性导致全程 `needs_repair`。

## 3. 根因链（按优先级）

### P0

1. **Phantom repair（Campaign）** — `PATH_PATTERN` 抽取裸 `*.md` → repair 死循环。**M2**
2. **SDM 未完成即停（Battlecard / pSEO）** — prematureStop 缺 manifest。**M1/M4**
3. **澄清 vs 直接开始做（HTML）** — ask_user 页数。**M3**

### P1

Repair streak、Win mkdir、PNG 降级、Bridge legacy、UI 双续跑 — **M5–M8, M13–M15**

### P2

SDM 假阴性、预览四线、导出汇总表、批测脚本 — **M9–M12**

## 4. 验收命令

见 [`rog-batch-modification-log-20260705.zh-CN.md`](./rog-batch-modification-log-20260705.zh-CN.md) §6.1。
