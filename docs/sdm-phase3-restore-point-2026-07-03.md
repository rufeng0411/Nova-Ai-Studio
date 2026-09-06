# SDM Phase 3 — 代码还原点

> Session Deliverable Manifest（Goal Loop Phase 3）、媒体 TTS/ASR、交付汇总 UI 与验收 harness 落地完成后创建，用于后续大改失败时回退。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-sdm-phase3-2026-07-03` |
| **提交** | `40d44ac1` |
| **说明** | SDM 引擎编译/持久化、UI 汇总表、媒体 generateSpeech/transcribeAudio、还原点总表 |

```bash
git show restore-point/post-sdm-phase3-2026-07-03 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **SDM**：`sessionDeliverableManifest.ts` 编译 slots、jsonl hydrate、`detectGoalMutation`、续跑注入
- **UI**：`sessionDeliverableManifestStore`、`deliverableSummaryMountPolicy`、汇总表位置/turnKind
- **媒体**：`generateSpeech` / `transcribeAudio`、`mediaRuntimeProbe`、视频/音频 smoke
- **发版**：`pack.mjs` / `apply-cloud-perf-env.sh` 默认 `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=1`
- **验收**：`test:sdm:unit` / `test:sdm:replay` / `sdm-session-manifest.spec.ts`
- **文档**：`session-deliverable-manifest-spec.zh-CN.md`、`code-restore-points-registry.zh-CN.md`

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-sdm-phase3-2026-07-03
```

### 从还原点开实验分支

```bash
git checkout -b experiment/sdm-p3 restore-point/post-sdm-phase3-2026-07-03
```

### 只还原某个文件

```bash
git checkout restore-point/post-sdm-phase3-2026-07-03 -- path/to/file
```

## 生产回滚

`.env` 设 `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=0` 并 recreate nova 容器（行为降级为 Phase 2，不丢历史 jsonl）。
