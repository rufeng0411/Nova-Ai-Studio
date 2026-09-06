# 0709-Test-2 UDC 六案实机深度分析

**生成时间**：2026-07-09T12:45:32.867Z  
**数据源**：`artifacts/0709-Test-2/logs/*.json` + JSONL  
**Playwright**：workers=2 并行  

## 1. 总览

| 维度 | 数量 |
|------|------|
| 通过 | 0 |
| 部分 | 6 |
| 失败 | 0 |
| 合计 | 6 |

## 2. 共性问题模式

- **P0**：Dock 无可见行：UDC-C4-dc7a63d3, UDC-C7-1d1bf62f
- **P1**：有 Dock 行但 SDM slots=0（消息 metadata 未写回）：UDC-C5-d7890d1d, UDC-C8-e75fe21d, UDC-C1-eca4cc5d, UDC-C6-d45a0ed0
- **P0**：未收敛即结束（still_thinking/timeout）：UDC-C4-dc7a63d3, UDC-C5-d7890d1d, UDC-C8-e75fe21d, UDC-C6-d45a0ed0, UDC-C7-1d1bf62f
- **P0**：slot_1 审计清单未在 Dock 可见：UDC-C4-dc7a63d3

## 3. 分案详情

### C4 UDC-C4-dc7a63d3

- **历史基线**：dc7a63d3：导出 17 行假绿、SDM 槽未绑、strict GT 未收敛
- **本次 status / outcome**：partial / still_thinking
- **耗时**：1206s
- **sessionId**：`web-s_2d9f38c4-457a-4abb-ac30-4a2c16faa2a7`
- **URL**：http://127.0.0.1:8081/session/web-s_2d9f38c4-457a-4abb-ac30-4a2c16faa2a7
- **Dock**：行 0，已交付 0，进度 0/10
- **SDM slots / profile**：0 / -
- **contractHash**：`-`
- **folderSnapshot 文件数**：未拉取
- **repair / task-resume 泄漏**：无 / 无
- **UDC 自动检查**：0/3
  - sdmSlotCountMatch: ❌
  - profileIsGeo: ❌
  - bindBasenameVisible: ❌

<details><summary>Dock 行摘要</summary>

- （无）

</details>

### C5 UDC-C5-d7890d1d

- **历史基线**：d7890d1d：01-aeo-audit-checklist.md 未绑 slot_1（截图 P0）
- **本次 status / outcome**：partial / still_thinking
- **耗时**：1206s
- **sessionId**：`web-s_55cc8d8d-849f-4a7e-82bd-5f8a0c7c0ef4`
- **URL**：http://127.0.0.1:8081/session/web-s_55cc8d8d-849f-4a7e-82bd-5f8a0c7c0ef4
- **Dock**：行 7，已交付 3，进度 0/9
- **SDM slots / profile**：0 / -
- **contractHash**：`-`
- **folderSnapshot 文件数**：0
- **repair / task-resume 泄漏**：无 / 无
- **UDC 自动检查**：1/3
  - sdmSlotCountMatch: ❌
  - profileIsGeo: ❌
  - bindBasenameVisible: ✅

<details><summary>Dock 行摘要</summary>

- geo-aeo-audit 审计清单
	Markdown	未完成	—
- 关键词调研
	Markdown	未完成	—
- 平台成稿
	Markdown	已完成	t4-citation-optimized.md
- 引用优化
	JSON	已完成	t5-schema.json
- schema.jsonld
	Markdown	已完成	t6-citability-score.md
- citability 评分
	HTML	未完成	—
- visibility-report.html 可见度报告
	HTML	未完成	—

</details>

### C8 UDC-C8-e75fe21d

- **历史基线**：e75fe21d：profile 误绑 geo；导出空表/行数漂移
- **本次 status / outcome**：partial / still_thinking
- **耗时**：1203s
- **sessionId**：`web-s_a20b2ecc-56aa-4b7d-b865-a1325c4bbdc7`
- **URL**：http://127.0.0.1:8081/session/web-s_a20b2ecc-56aa-4b7d-b865-a1325c4bbdc7
- **Dock**：行 8，已交付 0，进度 0/8
- **SDM slots / profile**：0 / -
- **contractHash**：`-`
- **folderSnapshot 文件数**：未拉取
- **repair / task-resume 泄漏**：无 / 无
- **UDC 自动检查**：2/3
  - sdmSlotCountMatch: ❌
  - profileNotGeo: ✅
  - minDockRows: ✅

<details><summary>Dock 行摘要</summary>

- 市场洞察
	Markdown	未完成	—
- 用户画像
	Markdown	未完成	—
- 渠道策略
	Markdown	未完成	—
- 内容矩阵
	Markdown	未完成	—
- 投放计划
	Markdown	未完成	—
- 邮件培育
	Markdown	未完成	—
- 程序化 SEO
	Markdown	未完成	—
- 复盘报告
	Markdown	未完成	—

</details>

### C1 UDC-C1-eca4cc5d

- **历史基线**：eca4cc5d：battlecard 三步首回合停、Dock 空
- **本次 status / outcome**：partial / converged
- **耗时**：188s
- **sessionId**：`web-s_253ac526-48f5-4bae-b3ce-99c48d34f61b`
- **URL**：http://127.0.0.1:8081/session/web-s_253ac526-48f5-4bae-b3ce-99c48d34f61b
- **Dock**：行 3，已交付 3，进度 -
- **SDM slots / profile**：0 / -
- **contractHash**：`-`
- **folderSnapshot 文件数**：未拉取
- **repair / task-resume 泄漏**：无 / 无
- **UDC 自动检查**：1/2
  - sdmSlotCountMatch: ❌
  - minDockRows: ✅

<details><summary>Dock 行摘要</summary>

- intel
	Markdown	已完成	intel.md
- battlecard
	Markdown	已完成	battlecard.md
- talk track
	Markdown	已完成	talk-track.md

</details>

### C6 UDC-C6-d45a0ed0

- **历史基线**：d45a0ed0：跨目录 verified、scopeDir 与文件夹不一致
- **本次 status / outcome**：partial / still_thinking
- **耗时**：903s
- **sessionId**：`web-s_084312ca-a6ce-4152-bfdd-5c1384807d50`
- **URL**：http://127.0.0.1:8081/session/web-s_084312ca-a6ce-4152-bfdd-5c1384807d50
- **Dock**：行 3，已交付 0，进度 0/3
- **SDM slots / profile**：0 / -
- **contractHash**：`-`
- **folderSnapshot 文件数**：未拉取
- **repair / task-resume 泄漏**：无 / 无
- **UDC 自动检查**：2/3
  - sdmSlotCountMatch: ❌
  - minDockRows: ✅
  - pathHintsPresent: ✅

<details><summary>Dock 行摘要</summary>

- geo-rank-track.csv 排名追踪
	Markdown	未完成	—
- brand-mention-report.md 提及报告
	Markdown	未完成	—
- monitor-report.html 监测页
	HTML	未完成	—

</details>

### C7 UDC-C7-1d1bf62f

- **历史基线**：1d1bf62f：视频 API/env；无真 mp4 交付
- **本次 status / outcome**：partial / still_thinking
- **耗时**：1204s
- **sessionId**：`web-s_9d3525db-8b80-4948-b4c4-31b18f12e9d9`
- **URL**：http://127.0.0.1:8081/session/web-s_9d3525db-8b80-4948-b4c4-31b18f12e9d9
- **Dock**：行 0，已交付 0，进度 1/2
- **SDM slots / profile**：0 / -
- **contractHash**：`-`
- **folderSnapshot 文件数**：未拉取
- **repair / task-resume 泄漏**：无 / 无
- **UDC 自动检查**：0/2
  - sdmSlotCountMatch: ❌
  - pathHintsPresent: ❌

<details><summary>Dock 行摘要</summary>

- （无）

</details>

## 4. 与 UDC R11 验收标准对照

| 案例 | 期望 | 实机结论 |
|------|------|----------|
| UDC-C4-dc7a63d3 | 7 槽 | partial；Dock 0 行；outcome still_thinking |
| UDC-C5-d7890d1d | 7 槽 | partial；Dock 7 行；outcome still_thinking |
| UDC-C8-e75fe21d | 8 槽 | partial；Dock 8 行；outcome still_thinking |
| UDC-C1-eca4cc5d | 3 槽 | partial；Dock 3 行；outcome converged |
| UDC-C6-d45a0ed0 | 3 槽 | partial；Dock 3 行；outcome still_thinking |
| UDC-C7-1d1bf62f | 1 槽 | partial；Dock 0 行；outcome still_thinking |

## 5. 优化建议（按优先级）

1. **P0 — 拉长实机等待 + 引擎 auto-continue**
   Playwright 已改为等「交付进度 N/M」或 Dock 已交付稳定 45s；若仍 timeout，须查 AgentLoop `shouldAutoContinueAfterIncompleteDeliverableStop` 是否在 GEO/增长长任务触发，以及 stale-turn watchdog 是否误停。
2. **P0 — UDC 单内核与 SDM 写盘对齐**
   对照 `buildUnifiedDeliverableView` + `deriveDeliverablesDockState`：turn 末须写 sessionDeliverableManifest；DeliverableSummaryTable 找不到「已交付」的 acceptance 失败需一并修（阻塞 test:sdm:acceptance）。
3. **P0 — C4/C5 slot_1 绑定 + strict GT**
   验证 `shouldApplyBaselineStrictGt()` 自动开启；`01-aeo-audit-checklist.md` 须经 pathHints/slotBindings 绑 slot_0；导出 contract 行数 ≤7 非 17 行假绿。
4. **P1 — C7 视频交付链**
   检查 Seedance/DashScope Key、generate_video 首轮日志、media_video slot profile；无 mp4 时 UserActionRequired 应温和提示而非假绿。
5. **P1 — 三分取证纳入 CI**
   每案保留 contractHash + task-folder-snapshot + slotBindings；将 0709-Test-2 sessionId 写入 `analyze:task-completion --gate` KPI。
6. **P2 — DeliverableSummaryTable acceptance**
   修 vitest 找不到「已交付」的 5 用例， unblock test:sdm:acceptance 与 prelaunch:quick。

## 6. 保留与复查

- 项目 **0709-Test-2** 及六条会话、成果文件、截图均未删除。
- 侧栏逐条打开 session URL 可人工复核 Dock / 文件夹 / 导出 HTML。
- 明细 JSONL：`artifacts/0709-Test-2/logs/0709-udc-live.jsonl`

