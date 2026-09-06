# 提示词 v2 + 成果清单权威 — 代码还原点

> Hub/流程模板提示词 v2 全量升级、标准成果清单权威、会话墓碑防僵尸复活、0710-T2 十案实机验收基线。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-prompt-v2-checklist-tombstone-20260712003107` |
| **提交** | `6c0d8b62` |
| **时间** | 2026-07-12 00:31:07 +0800 |
| **说明** | 提示词 v2、checklist authority、session tombstone、0710-T2 |

```bash
git show restore-point/post-prompt-v2-checklist-tombstone-20260712003107 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **提示词 v2**：`upgrade-all-prompts` / `promptTemplateStrategy`；Hub 353 条 + 流程模板 35 条升级（STDA 目录 + 标准成果清单）
- **成果清单权威**：`deliverable-checklist-authority.json`、`deliverableChecklistAuthority`；Campaign 完整性、`sdmSlotMatching` 加固
- **会话墓碑**：`session_tombstones` PG/SQLite 迁移、`sessionTombstoneStore`；`audit:zombie-sessions` / `audit:session-lifecycle`
- **续跑/稳定性**：`staleTurnFallbackPolicy`、`sessionSyntheticTurnBudget`、`visualMediaDegradePolicy`
- **预览**：SuperPreview 代码只读预览适配器；幻灯片 `slideDeliverableProfile`
- **验收**：`test:0710:T2-live`、0710-T2 Playwright、四线/用量/算力浪费审计报告

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-prompt-v2-checklist-tombstone-20260712003107
```

### 从还原点开实验分支

```bash
git checkout -b experiment/prompt-v2 restore-point/post-prompt-v2-checklist-tombstone-20260712003107
```

### 只还原某个文件

```bash
git checkout restore-point/post-prompt-v2-checklist-tombstone-20260712003107 -- path/to/file
```

## 关联文档

- [`prompt-template-upgrade-report-20260711.zh-CN.md`](./prompt-template-upgrade-report-20260711.zh-CN.md)
- [`0710-T2-live-report-20260711.zh-CN.md`](./0710-T2-live-report-20260711.zh-CN.md)
- [`session-task-directory-stda-restore-point-20260711083021.md`](./session-task-directory-stda-restore-point-20260711083021.md)（上一还原点）
