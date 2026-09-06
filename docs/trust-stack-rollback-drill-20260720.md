# 鸣镝 G700 信任栈联合 Rollback Drill（2026-07-20）

## 演练目标

验证波次 **D** 开启后，G700 + VAP 三键可在分钟级联合回滚，且离线 replay 仍绿。

## 演练前状态（波次 D 模拟）

| 键 | 值 |
|---|---|
| `PILOTDECK_CAPABILITY_SCOPE_V2` | enforce |
| `PILOTDECK_GOAL_QUALITY_CONTRACT` | enforce |
| `PILOTDECK_OFFICIAL_MEDIA_V2` | enforce |
| `PILOTDECK_UI_DELIVERABLE_QUALITY` | 1 |
| `PILOTDECK_VISUAL_ASSET_PLATFORM` | shadow |
| `PILOTDECK_VISUAL_BINDING_AUDIT` | enforce |
| `PILOTDECK_VAP_BIND_BEFORE_WRITE` | 1 |

## 回滚动作

```bash
# G700 flags → off
PILOTDECK_CAPABILITY_SCOPE_V2=0
PILOTDECK_GOAL_QUALITY_CONTRACT=off
PILOTDECK_OFFICIAL_MEDIA_V2=off
PILOTDECK_UI_DELIVERABLE_QUALITY=0
PILOTDECK_CONTENT_QUALITY_V2=off

# VAP 三键 → off
PILOTDECK_VISUAL_ASSET_PLATFORM=off
PILOTDECK_VISUAL_BINDING_AUDIT=off
PILOTDECK_VAP_BIND_BEFORE_WRITE=0
```

生产：`docker compose … up -d --force-recreate nova`（见 `apply-cloud-perf-env.sh` 波次 A）。

## 回滚后离线验收（本机执行）

| 命令 | 结果 |
|---|---|
| `npm run test:mingdi-g700:replay` | 11/11 PASS |
| `npm run test:trust-stack:replay` | 15/15 PASS |
| `npm run test:visual-asset-binding:acceptance -- --gate` | PASS |
| `npm run test:visual-binding:eight-cases` | 8/8 PASS |

## 结论

- 联合回滚键与离线 replay 链兼容；UI 三态组件未因 flag off 崩溃（单测 `deliverableContextInvariants` / `buildTurnDeliverableView` 绿）。
- Live 7/7 + 8/8 须在 `dev:saas` 就绪后单独跑：`npm run test:mingdi-g700:live -- --gate --tier p0` 与 `npm run test:visual-binding:live -- --gate --live`。

## 记录

- 执行人：自动化门禁 + 本地脚本
- 日期：2026-07-20
- 关联：`scripts/release/apply-cloud-perf-env.sh` 波次 B–E 矩阵
