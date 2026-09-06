# ROG Phase 8 验收报告（0707 吴裕泰批次）

**日期**：2026-07-07  
**还原点 tag**：`restore-point/pre-rog-phase8-0707`  
**基线归档**：`artifacts/0707吴裕泰批次/`（11 会话 HTML 导出 + P0 prompts + `kpi-baseline-0707.jsonl`）

## 1. 实施摘要

| PR | 内容 | 状态 |
|----|------|------|
| PR-C1 | `userDeliverableAcknowledgment` — 用户确认完成 → passed，停 repair/UI 续跑 | ✅ |
| PR-C2/C3 | `sanitizeMalformedRepairPaths` + `filterPptIntermediateBroken` + 5 个 WuYuTai fixture | ✅ |
| PR-V1 | `config/video-model-registry.json` + `generateVideo` 模型回退链 + `smoke:video:happyhorse` | ✅ |
| PR-V2 | `video-mp4` profile + `mediaStrategy` 禁止过早 HTML 降级 + anchor 视频纠错过滤 | ✅ |
| PR-T1 | `brand-campaign-full` / `social-matrix` 执行契约注入 | ✅ |
| PR-T2 | `campaignPhaseCompletePass` 进 reconcile 单管道 | ✅ |
| PR-T3 | 模板草稿发布 `publishMode:draft` 不拦截 auto-continue | ✅ |
| PR-G7 | `test:rog-phase8:*` + error-task-matrix + 本报告 | ✅ |
| L4-P0 | 静态 gate（prompts + registry）；Gateway `--live` 待 dev:saas + Key | ✅ 静态 |

## 2. 0707 基线 KPI（修复前）

来源：`artifacts/0707吴裕泰批次/kpi-baseline-0707.jsonl`（11 行）

| 指标 | 基线 |
|------|------|
| 会话数 | 11 |
| needs_repair 末态 | 7/12 错误簇（导出内 repair 风暴） |
| 视频类真 mp4 | 0/2 |
| 用户手打「继续」 | 极少（对照 b6b32ce8 passed） |

## 3. 错误簇静态矩阵（6/6）

| 簇 ID | 会话 | 修复锚点 |
|-------|------|----------|
| RC-LT-1 | f8795d13, 433ce25a | processTemplateExecutionPrompt |
| RC-LT-2 | f8795d13 | campaignPhaseCompletePass |
| RC-VID-1 | 3f1fe8e2, a53d03e1 | videoModelRegistry + video-mp4 |
| RC-DONE-1 | 706c4514 | userDeliverableAcknowledgment |
| RC-DONE-2 | 433ce25a, 4a9605af | sanitizeMalformed + ppt intermediate filter |
| RC-DONE-3 | 1dfeb5fd | fixture 文档化（质量 vs 路径分离，PR-C4 迭代 3） |

## 4. 门禁执行结果

```text
npm run test:rog-phase8:unit          → PASS（13 tests + smoke:video:happyhorse）
npm run test:rog-phase8:integration   → PASS
npm run test:rog-phase8:error-matrix  → PASS（6/6 簇 + kpi jsonl）
npm run test:rog-phase8:live-p0       → PASS（静态：3 P0 prompts + registry）
npm run test:rog-phase8:acceptance    → PASS（含 Phase 7/6 回归）
```

## 5. L4-P0 三线说明

| ID | 场景 | 静态 gate | Gateway 实机 |
|----|------|-----------|--------------|
| T0707-P0-01 | Campaign 全案 | prompt 就绪 | `npm run test:rog-phase8:live-p0 -- --live`（需 dev:saas + 模型 Key） |
| T0707-P0-02 | AI 视频 10s | registry 回退链 | 同上 |
| T0707-P0-03 | PPT 生成 | prompt 就绪 | 同上 |

实机三线需在本地 `dev:saas` 与 DashScope/视频 Key 就绪后执行；静态 gate 已纳入发版前置，实机为运维可选加深。

## 6. 关键文件

- 单管道：`src/saas/deliverables/reconcileDeliverableFacts.ts`
- 用户收口：`src/saas/deliverables/userDeliverableAcknowledgment.ts`
- 视频：`config/video-model-registry.json`、`src/tool/builtin/generateVideo.ts`
- 模板契约：`src/saas/processTemplateExecutionPrompt.ts`
- 验收脚本：`scripts/run-rog-phase8-acceptance.mjs`

## 7. 后续（非 Phase 8 阻塞）

- **PR-T4**：流程模板阶段 UI（`sessionTaskLifecycle` 阶段条）
- **PR-C4**：`deliverableQualityHints` 预览质量弱提示
- **L4 实机复测**：0707 批次 KPI 对比（目标 needs_repair ≤2/12，视频 ≥1/2 真 mp4）
