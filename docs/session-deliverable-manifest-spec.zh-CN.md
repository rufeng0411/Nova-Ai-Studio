# Session Deliverable Manifest（SDM）规格

> Goal Loop Phase 3 · 权威实现：`src/saas/taskState/sessionDeliverableManifest.ts`

## 1. 目标

会话级交付清单（SDM）在首条实质性交付目标确立后生成，作为**整段对话**交付物的唯一权威源。后续 Loop、验收、UI 汇总表与续跑均围绕 SDM slots 补齐；用户可在上下文中增删改槽位。

## 2. 数据模型

```typescript
type SessionDeliverableSlot = {
  id: string;
  label: string;
  kind?: AcceptanceArtifactKind;
  required: boolean;
  count?: number;
  pathHint?: string;
  stageId?: string;
  stageOrder?: number;
  status?: 'pending' | 'active' | 'done' | 'removed';
  /** 派生槽位依赖的权威源 pathHint（如 keywords.md）；源未完成时派生槽不算 done */
  dependsOnPathHint?: string;
  slotRole?: 'canonical' | 'derived';
};

type SessionDeliverableManifest = {
  manifestVersion: number;
  goalVersion: number;
  sessionGoalAnchor: string;
  slots: SessionDeliverableSlot[];
  profileId?: string;
  capabilitySlug?: string;
  compiledAtTurnId?: string;
  currentStageId?: string;
  supersedes?: { manifestVersion: number; diff: 'pivot' | 'add' | 'remove' | 'replace' | 'initial' };
};
```

## 3. JSONL 持久化

- **类型**：`session_deliverable_manifest`
- **写入时机**：首条 user 接受后（v1）；pivot/mutation 后 append 新版本
- **权威**：仅引擎经 `JsonlTranscriptWriter.recordSessionDeliverableManifest` 写入；Bridge **禁止**写此行

### 3.1 turn_acceptance_meta 扩展

| 字段 | 说明 |
|------|------|
| `sessionManifestVersion` | 对应 SDM manifestVersion |
| `goalVersion` | TaskGoalContract 版本 |
| `sdmSnapshot` | 当 turn 结束时的 slots 快照（UI frozen 表） |
| `currentStageId` | Campaign 当前阶段 |

## 4. 三轨语义（§3.5）

| 概念 | 语义 |
|------|------|
| `sessionGoalAnchor` | 建立 SDM 的首条实质性目标；resume/memory 锚点 |
| `turnUserGoal` | 当前 turn 验收文本；pivot 后更新；「继续」不改 SDM |
| `currentSdm` | JSONL 最新 `session_deliverable_manifest` 行 |

续跑/repair **读 SDM slots + planLedger**，不靠重扫 goal 文本。

## 5. Campaign 8 阶段映射

| 用户阶段 | SDM slot id | 引擎规则 id |
|----------|-------------|-------------|
| 1 调研 | stage_research | research_or_plan |
| 2 策划 HTML | stage_plan_html | research_or_plan |
| 3 brief | stage_brief | brief_docx |
| 4 主视觉 | stage_main_visual | main_visual |
| 5 官网 | stage_website | website_index |
| 6 多平台 | stage_platform | platform_content |
| 7 发布草稿 | stage_draft | draft_manifest |
| 8 监测 | stage_monitoring | monitoring |

UI 进度分母 = 8；strict missing 仅 `stageOrder <= currentStage` 的 required slots。

## 6. 权威源与派生格式（canonical → derived）

全局策略见 `config/deliverable-derivation.manifest.json` 与系统 prompt `<core-strategy>`。

| 概念 | 说明 |
|------|------|
| 权威源 | 同一语义交付物的唯一真相，默认 `.md` |
| 派生格式 | `.html` / `.pdf` / `.docx` / `.pptx` 等，须 **读取** 权威源后生成 |
| 顺序 | `write_file` 源 → `read_file` 确认 → 派生 skill → `write_file` 派生 |
| 例外 | 原生即为该格式（`index.html`、`presentation.pptx`、图片/视频/json） |

SDM 槽位建议：

- 源文件：`slotRole: 'canonical'`，`pathHint: 'keywords.md'`
- 派生文件：`slotRole: 'derived'`，`dependsOnPathHint: 'keywords.md'`，`pathHint: 'keywords.html'`

**验收**：派生槽 `done` 时，依赖的 canonical 路径须已存在于任务目录（repair 可读 manifest 校验）。

GEO 领域绑定：`config/geo-dual-report.manifest.json` + skill `geo-dual-report` / `geo-monitor-report`。

## 7. Feature Flag

- `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=1` 开启 SDM 全链路
- 默认 **OFF**；dev:saas 注入 ON；flag OFF 时行为与现网一致

## 7. TAIL_READ 与 SDM

云端 `PILOTDECK_HISTORY_TAIL_READ=1` 时，jsonl 尾读可能截断头部 SDM 行。`readSessionMessages` 在 tail 模式下对 **前 64KB** 做 head scan，合并最新 `session_deliverable_manifest`（与 history-messages runbook P0 对齐）。

## 8. 证书与 baseline 冻结（2026-07-17）

- **任意非空初始 manifest 即 baselineLocked**；turn 末禁止 `verified_*` 扩必交槽，派生格式进 `optionalDerived`。
- 回合末 `turn_acceptance_meta.acceptanceCertificate` 与 `slotBindings`/`contractSnapshot` 同源写入。
- `completionState`：`complete` | `accepted_partial` | `incomplete` | `blocked`；仅 `complete` 表示全部必交槽已绑定磁盘证据。
