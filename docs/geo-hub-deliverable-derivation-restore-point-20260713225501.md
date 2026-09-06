# GEO Hub + 成果派生 — 代码还原点

> 能力中心 GEO 独立 Tab、监测双交付 skills、成果派生策略、会话切换加速与生命周期加固。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-geo-hub-deliverable-derivation-20260713225501` |
| **提交** | `c4d5daba` |
| **时间** | 2026-07-13 22:55:01 +0800 |
| **说明** | GEO Tab、deliverable derivation、stale pause、Turn 队列 |

```bash
git show restore-point/post-geo-hub-deliverable-derivation-20260713225501 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **GEO Hub**：七 Tab 新增 GEO/AI 搜索；`geo-monitor-hub`、`geo-dual-report`、`geo-cn-crawlers` 等 skills；`smoke:geo-hub` / `verify:geo-saas`
- **成果派生**：`deliverable-derivation.manifest.json`、`deliverableDerivationPolicy`、canonical/derived 成果 smoke
- **会话生命周期**：`staleSessionAutoPause`、`sessionAutoContinueGate`、goal mutation 检测加固
- **STDA/SDM**：`resolvePrimaryTaskArtifactDir`、bootstrap 单测、多轮 GEO 成果规格
- **前置提交**（含于本标签树）：`05e5df4a` 会话切换加速/Turn 队列/登录限流；`3d9c4f18` pack 目录同步
- **验收文档**：对话稳定性全链路、四线对齐、recovery 报告（2026-07-13）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-geo-hub-deliverable-derivation-20260713225501
```

### 从还原点开实验分支

```bash
git checkout -b experiment/geo-hub restore-point/post-geo-hub-deliverable-derivation-20260713225501
```

### 只还原某个文件

```bash
git checkout restore-point/post-geo-hub-deliverable-derivation-20260713225501 -- path/to/file
```

## 关联文档

- [`geo-hub-integration-report-2026-06-10.zh-CN.md`](./geo-hub-integration-report-2026-06-10.zh-CN.md)
- [`geo-hub-admin-guide.zh-CN.md`](./geo-hub-admin-guide.zh-CN.md)
- [`dialogue-stability-full-chain-acceptance-2026-07-13.md`](./dialogue-stability-full-chain-acceptance-2026-07-13.md)
- [`sdm-baseline-pipeline-gate-restore-point-20260712123526.md`](./sdm-baseline-pipeline-gate-restore-point-20260712123526.md)（上一还原点）
