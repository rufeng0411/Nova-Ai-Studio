# 算力稳态 Train-0 — 代码还原点

> Train-0A~2 算力提速稳态：Turn 队列泵、Synthetic Budget、引擎 passed 硬短路、P0-4 成果校验信任与 GEO LLM 覆盖门禁。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-compute-steady-state-train0-20260714082139` |
| **提交** | `7d682eeb` |
| **时间** | 2026-07-14 08:21:39 +0800 |
| **说明** | Turn Queue、Synthetic Budget、P0-4 validate、GEO LLM coverage |

```bash
git show restore-point/post-compute-steady-state-train0-20260714082139 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **Train-0A/B**：`AgentLoop` passed 硬短路；`turnAcceptanceMeta` meta 持久化；`JsonlTranscriptWriter` 瘦身
- **Train-0D**：`turnQueuePump` / `turnAcceptanceService` Turn 队列泵加固
- **Train-1**：`historyMessageSanitize` 扩展；`pack.mjs` / `apply-cloud-perf-env.sh` 云端 perf flag
- **Train-2**：`sessionSyntheticTurnBudget` 合成续跑预算收紧
- **P0-4 UI**：`useValidatedDeliverables` 引擎信任 passed；`DeliverableValidationSessionContext` dedupe
- **GEO**：`geo-llm-coverage-required-models.json`、`smoke:geo-llm-coverage-required`；visibility-probe 覆盖矩阵
- **验收**：[`compute-steady-state-verification-20260714.zh-CN.md`](./compute-steady-state-verification-20260714.zh-CN.md)

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-compute-steady-state-train0-20260714082139
```

### 从还原点开实验分支

```bash
git checkout -b experiment/compute-train0 restore-point/post-compute-steady-state-train0-20260714082139
```

### 只还原某个文件

```bash
git checkout restore-point/post-compute-steady-state-train0-20260714082139 -- path/to/file
```

## 关联文档

- [`compute-steady-state-verification-20260714.zh-CN.md`](./compute-steady-state-verification-20260714.zh-CN.md)
- [`recovery-stability-report-2026-07-13.md`](./recovery-stability-report-2026-07-13.md)
- [`geo-report-design-system-restore-point-20260713234629.md`](./geo-report-design-system-restore-point-20260713234629.md)（上一还原点）
