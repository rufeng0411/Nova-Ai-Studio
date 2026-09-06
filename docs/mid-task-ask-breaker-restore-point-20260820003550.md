# 任务中间主动提问+熔断 — 代码还原点

> 贵意图冲突「问一次」澄清门控 + 任务阶段预算熔断落地快照。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-mid-task-ask-breaker-20260820003550` |
| **提交** | `87710ea4` |
| **时间** | 2026-08-20 00:35:50 +0800 |
| **说明** | **任务中间主动提问+熔断** |

```bash
git show restore-point/post-mid-task-ask-breaker-20260820003550 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- `expensiveIntentConflict`：贵意图冲突主动澄清（问一次）
- `taskStageBudget`：阶段预算熔断
- Sticky 成果栏持久化、续跑/澄清门控与四线相关加固
- 验收：`docs/expensive-intent-clarify-acceptance-20260819.zh-CN.md`、sticky/speed 验收与 live 脚本

## 对照执行前

- `restore-point/pre-expensive-intent-clarify-20260819203348`
- `restore-point/pre-sticky-stage-budget-20260819173414`

## 回退

```bash
git reset --hard restore-point/post-mid-task-ask-breaker-20260820003550
```
