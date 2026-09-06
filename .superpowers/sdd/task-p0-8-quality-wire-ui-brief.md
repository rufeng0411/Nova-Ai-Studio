# P0-8：贯通 JSONL/history/UI/归档质量状态

## 必须实现

- TranscriptEntry turn_acceptance_meta v2 fields + finality=final
- readSessionMessages.ts, messages.js, turnAcceptanceMeta.ts, sessionHistoryDeliverableEnvelope.ts, sessionDeliverablePipeline.ts whitelist
- buildUnifiedDeliverableView, deriveDeliverablesDockState, DeliverableSummaryTable, exportSnapshotEnvelope, exportSessionHtml 同源展示：
  - complete / accepted_partial (official_media_degraded vs user_acknowledged) / incomplete / blocked
- Bridge runtime flag PILOTDECK_UI_DELIVERABLE_QUALITY=0|1 in runtimeFeatureFlags.js/ts
- i18n 中英文全覆盖

## 测试

- turnAcceptanceMeta tests
- buildUnifiedDeliverableView tests for quality states
- export four-line parity
- runtimeFeatureFlags tests

报告：`F:\Ai-pilotdeck\.superpowers\sdd\task-p0-8-quality-wire-ui-report.md`
