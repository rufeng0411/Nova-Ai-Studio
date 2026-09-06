# 0717 Cursor 八案四线验收报告

> 生成时间：2026-07-17  
> 权威基线：`artifacts/0717-four-line-acceptance/baseline.json`  
> 结构 fixture：`tests/fixtures/four-line-0717-cursor-cases.ts`

## 范围

本报告覆盖 **0717 实机稳态加固** 计划的 P0 交付：严格绑定内核、文件夹快照 v2、导出 envelope、Turn Queue 去重、运行时 UI flag，以及 shadow 灰度门禁。

## 五线取证说明

| 线 | 来源 | 说明 |
|---|---|---|
| 实时正文 | 对话气泡 + 成果链接 | 须与证书 `resolvedPath` 一致 |
| Dock / Composer | `buildUnifiedDeliverableView` | 证书 UI flag 开启后禁 provisional 乐观绿 |
| 文件夹 Tab | `task-folder-snapshot` v2 | 截断时仅 `inconclusive`，不得判 missing |
| 归档 HTML | `exportSessionHtml` user_archive | 脱敏路径/租户 ID |
| 诊断 HTML | `exportSessionHtml` diagnostic | GET-only，不反写 SDM |

## 结构门禁（15 案 fixture）

- 原 7 案：`tests/fixtures/four-line-0717-cases.ts`
- 新增 8 案：`tests/fixtures/four-line-0717-cursor-cases.ts`
- 不变量测试：`tests/fixtures/four-line-0717-cursor-invariants.test.ts`

## KPI 扩展

审计脚本新增：

- `slot_collision`
- `hash_mismatch`
- `literal_placeholder_path`
- `snapshot_truncated`
- `nonterminal_export_as_final`

## 灰度默认（生产 Hotfix）

| Flag | 默认 |
|---|---|
| `PILOTDECK_DELIVERABLE_CERTIFICATE_V2` | shadow |
| `PILOTDECK_CONTRACT_AUTHORITY_V2` | shadow（旧值 `1` 映射 shadow） |
| `PILOTDECK_UI_DELIVERABLE_CERTIFICATE` | 0（Bridge 运行时） |
| `PILOTDECK_UI_EXPORT_SNAPSHOT_V2` | 0 |
| `PILOTDECK_UI_EXPORT_USER_AUDIT_MODES` | 0 |
| `PILOTDECK_FACTUAL_PREMISE_GUARD` | off（P1 独立） |

回滚：仅改服务器 `.env` 后 recreate Nova 容器，无需重建 UI。

## 验收命令

```bash
npm run test:0717-four-line-live -- --tier p0 --workers=1 --gate
npx vitest run tests/fixtures/four-line-0717-cursor-invariants.test.ts src/saas/deliverables/deliverableContractBinding.test.ts
node --test tests/server/deliverableTaskFolder.test.mjs tests/server/turnQueueTranscript.test.mjs
npm run test:four-line-audit
npm run test:export-four-line-parity
```

## 结论

- **P0 结构门禁**：fixture + 绑定内核 + 快照 v2 + 队列去重 + 运行时 flag 已落地；`npm run test:0717-four-line-live -- --structure-only --gate` 通过结构层。
- **P1 补强**：`factualPremisePolicy` 已接入 `AgentLoop` 系统 append（`PILOTDECK_FACTUAL_PREMISE_GUARD=off|shadow|enforce`）；三步视频 2/3 槽 `deliverable_repair` 单测固化；`compositeSlotQuality` 已在 `validateDeliverablesEngine` turn 末输出 shadow 遥测（`compositeQualityShadow`），enforce 模式可 veto 假完成。
- **实机编排**：`scripts/run-0717-four-line-live.mjs` 支持 `--tier p0|sample|full`、`--structure-only`、`--gate`；Gateway 回放产物写入 `artifacts/0717-four-line-acceptance/cases/{caseId}/`（certificate/snapshot/双 HTML/KPI JSONL）。
- **生产 GO**：须在本机 `dev:saas` 跑通 `npm run test:0717-four-line-live -- --tier p0 --workers=1 --gate`（三步视频、10 页幻灯、Campaign 6 槽）与 Bridge 稳定性五项后再开 enforce。
