# 成果栏常驻批次 · 大问题（2026-08-19）

> 阶段账本 / GEO SDM **停止扩 scope**。禁止改核心仲裁、证书 enforce。  
> 本批裁决是 **GO(shadow)**，不是 GEO 0/8 或阶段 enforce 的修复声明。

---

## 1. 知乎选题长文附带「PPT 里没有展示」误绑（已收窄）

| 项 | 内容 |
|---|---|
| 首跑证据 | L2 `STICKY-ZHIHU`：`profileId=ppt`，墙钟 132671ms。会话 `s_115103f5-152b-42d2-9799-8287406e5efa`。 |
| 修订 | `stripNegatedDeliverableMentions` 增加缺席投诉句；**未改** `resolveContinuationAction`。真 PPT 目标单测仍绑 `ppt`。 |
| 复测 | 2026-08-19 晚：`profileId=default`，墙钟 127594ms，硬门禁 PASS。会话 `s_dd3f1d78-5558-4148-84ba-5b09e0e60c7e`。KPI：`artifacts/sticky-stage-budget-20260819/retest/`。 |
| 回滚 | 还原 `PPT_ABSENCE_COMPLAINT_SPAN`。 |

---

## 2. GEO 全案清单 0/8（未改 SDM）

| 项 | 内容 |
|---|---|
| 证据 | 08-15 三案 live **1/3** 清单 0/8。本批两轮 GEO 实机均为 `slotTotal=8`（340797ms / 284734ms），**未复现 0/8**。 |
| 是否本批引入 | 否。 |
| 推荐 | 08-15 的 0/8 仍作历史风险；三案 live gate 不以转绿为本批 GO 条件。 |

---

## 3. 为常驻重新全量扫 transcript

| 项 | 内容 |
|---|---|
| 证据 | 制作中 `messagesForDeliverables` 仍为 `[]`。 |
| 推荐 | 保持 C3。 |

---

## 4. 阶段账本误接到仲裁

| 项 | 内容 |
|---|---|
| 证据 | `observeTaskStage` 只写 JSONL。L2 `stageOverrunEvents=n/a`。 |
| 推荐 | 禁止 enforce / abort `write_file`。`PILOTDECK_TASK_STAGE_BUDGET=off` 可关观测。 |

---

## 建议

1. GEO 历史 0/8 另批 SDM/GT。  
2. Playwright 真点栏不作为本批硬门禁（Gateway 代理不得写成 UI 实锤）。  
3. 三案 `test:three-case-speed-rca:live:gate` 只作辐射对照。
