# 鸣镝 G700 内容与官方素材生产稳态加固 — 生产验收报告（2026-07-19）

## 1. 验收结论

| 维度 | 结论 | 说明 |
|------|------|------|
| **代码与自动化门禁** | **结构通过** | 单元、回放、官方素材链、四线导出、fork 登记、scope 审计均绿 |
| **历史 11 案问题复现** | **11/11 可稳定识别** | 脱敏 replay 能复现旧导出上的全部预期失败标签 |
| **dev:saas 7 场景实机** | **未执行（NO-GO）** | 未设置 `MINGDI_G700_LIVE_URL`，Gateway 未跑满 |
| **Bridge load soak** | **未执行（FAIL）** | Bridge 未启动，`fetch failed` |
| **云端 official-media** | **未执行（SKIP）** | 未设置 `PILOTDECK_CLOUD_OFFICIAL_MEDIA_URL` |
| **生产整包 GO** | **否** | 实机 KPI 与 soak 未闭环，不得宣称生产可用 |

**总判定：`STRUCTURAL_PASS_LIVE_PENDING`** — 加固代码与离线门禁已就绪；**实机验收待补跑**。

机器可读摘要：`artifacts/mingdi-g700-production-acceptance/verification-report.json`  
完整运行日志：`artifacts/mingdi-g700-production-acceptance/verification-run.log`

---

## 2. 自动化验收矩阵（2026-07-19 12:24 UTC+8）

| 序号 | 命令 | 结果 | 明细 |
|------|------|------|------|
| 1 | `npm run test:mingdi-g700:unit` | **PASS** | 14/14 |
| 2 | `npm run test:mingdi-g700:replay` | **PASS** | 11/11 脱敏回放 |
| 3 | `npm run test:official-media:acceptance` | **PASS** | 79 pass，2 skip（外网 live）；goalQualityContract 3/3 |
| 4 | `npm run test:mingdi-g700:live -- --gate` | **结构 PASS / 实机 SKIP** | 7 场景结构报告见 `live-structure-report.json` |
| 5 | `npm run test:cloud:official-media-smoke` | **SKIP** | 缺 staging URL |
| 6 | `npm run test:bridge-stability:unit` | **PASS** | vitest 11 + node 20 |
| 7 | `npm run test:export-four-line-parity` | **PASS** | 46/46 |
| 8 | `npm run check:saas-fork` | **PASS** | 645 条 fork manifest |
| 9 | `node scripts/audit-capability-scope.mjs` | **PASS** | 4/4 Hub slug；`brand-campaign-full` 流程模板例外 |
| 10 | `npm run test:bridge-stability:load` | **FAIL** | Bridge 未就绪 |

### 2.1 验收前小修（本轮验证中发现并修复）

1. **四线 export envelope `goalVersion` 丢失**  
   - 文件：`ui/src/shared/turnAcceptanceMeta.ts`  
   - 现象：`coSourceExportSessionHistory` 合并 history envelope 时 `goalVersion` 被 sanitize 剥离，导致 `test:export-four-line-parity` 45/46。  
   - 修复：在 `SanitizedTurnAcceptanceMeta` 与 `extractTurnAcceptanceMeta` / fallback 中保留 `goalVersion`。  
   - 重跑：**46/46 PASS**。

2. **P1 scope 审计 pass 逻辑**  
   - 文件：`scripts/audit-capability-scope.mjs`  
   - 现象：`brand-campaign-full` 为流程模板 ID，不在 `catalog.skills`，误报 audit fail。  
   - 修复：仅要求 4 个 Hub capability slug 命中 catalog。  
   - 重跑：**pass: true**（`artifacts/capability-scope-audit/report.json`）。

---

## 3. 历史 11 案问题案例与加固映射

> 数据来源：`artifacts/mingdi-g700-production-acceptance/baseline.json`（2026-07-18 原始导出脱敏审计）。  
> **重要**：replay 验证的是「审计器能稳定识别旧问题」，**不是**证明加固后新会话已绿。

### 3.1 指标汇总（旧导出）

| 失败标签 | 出现次数 |
|----------|---------:|
| `scope_expansion` | 22 |
| `forbidden_generate_image` | 25 |
| `snapshot_missing` | 11 |
| `official_media_violation` | 6 |
| `false_incomplete_loop` | 4 |
| `deliverable_contract_mismatch` | 4 |
| `slide_count_drift` | 4 |
| `cross_session_artifact` | 3 |
| `passed_with_pending` | 2 |
| `output_kind_mismatch` | 2 |
| `content_assertion_failed` | 2 |
| `entity_misclassification` | 1 |
| `unreachable_hotlink` | 1 |
| `unlabeled_degrade` | 1 |

### 3.2 逐案问题与对应加固

| 案例 ID | 历史核心问题 | 预期失败标签（节选） | 对应加固 |
|---------|--------------|----------------------|----------|
| **strategy** | 纯咨询却生成 SDM/假完成、跨会话成果 | scope_expansion、passed_with_pending、false_incomplete_loop | P0-1 咨询/报告双模式；P0-2 goalQualityContract |
| **geo-plan** | GEO 全案用 `generate_image` 替代官方素材 | official_media_violation、forbidden_generate_image | P0-3～P0-6 官方素材链 + FSM |
| **geo-keywords** | 缺四线 snapshot envelope | snapshot_missing | P0-8 质量状态贯通 |
| **last30days** | 01/02/03 越界、跨会话、缺唯一 HTML 成果 | scope_expansion、cross_session_artifact、deliverable_contract_mismatch | P0-1 单成果 scope guard |
| **nova-slides** | 6 页变 10 页、大量生图、无官方证据 | slide_count_drift、forbidden_generate_image、content_assertion_failed | P0-6/9 Nova 精确页数 + 禁生图 |
| **product-research** | 缺指定 HTML、MD/HTML 幽灵槽 | scope_expansion、output_kind_mismatch | P0-9 显式文件 + tier/来源 |
| **gsap** | 动画页 scope 扩张 | scope_expansion | P0-1 exact slug scope |
| **campaign** | 主体误判 + 生图违规 | entity_misclassification、forbidden_generate_image | P0-9 subjectGrounding + 官方素材 |
| **html-slides** | 半完成却 passed、内容断言失败 | passed_with_pending、content_assertion_failed | P0-7 终验收证书；P0-9 内容断言 |
| **remotion** | 视频输出类型错配 | output_kind_mismatch | P0-9 输出 kind 断言 |
| **website** | 热链不可达、降级未标注 | unreachable_hotlink、unlabeled_degrade | P0-3～P0-6 provenance + 降级披露 |

### 3.3 典型问题摘录（用户可见层）

- **last30days**：用户只要一份 `marketing-deliverable-*.html`，旧会话却产出 01/02/03 多文件并混入其它任务 `campaign-brief.docx` 等。  
- **strategy**：用户未要求交付文件，旧导出仍挂「校验中/待交付」合同并宣称完成。  
- **nova-slides**：合同从 6 页漂移到 10 页，`generate_image` 调用 14 次，无官方来源证据链。  
- **website**：页面仍引用不可达远程热链，占位降级未在成果区披露。  
- **全 11 案**：HTML 导出均缺可核验 snapshot envelope（四线对齐缺口）。

---

## 4. 待补跑项（阻塞生产 GO）

### 4.1 dev:saas 7 场景实机（P0-10）

结构门禁已生成场景清单（`live-structure-report.json`），实机未跑：

1. `brand-website-official-media` — 品牌官网官方素材本地化  
2. `nova-slides-6-official` — Nova 6 页官方幻灯  
3. `last30days-single-artifact` — last30days 单成果  
4. `strategy-consultation` — strategy 咨询模式  
5. `strategy-report` — strategy 报告模式  
6. `product-user-research` — 产品用研八章与来源  
7. `campaign-full-subject` — Campaign 完整主体  

**前置条件**：`npm run dev:saas` + `MINGDI_G700_LIVE_URL=http://127.0.0.1:<port>` + Gateway 就绪 + **workers=1 串行**。

**目标 KPI**（实机跑满后写入同目录 `live-p0-report.json`）：  
`false_complete=0`、`false_incomplete=0`、`passed_with_pending=0`、`scope_expansion=0`、`cross_session_artifact=0`、`forbidden_generate_image=0`、`slide_count_drift=0`。

### 4.2 Bridge load soak

```powershell
# dev:saas 就绪且 Bridge 端口可访问后
npm run test:bridge-stability:load
```

本轮失败原因：Bridge 未启动（`fetch failed`）。

### 4.3 云端 official-media smoke

```powershell
$env:PILOTDECK_CLOUD_OFFICIAL_MEDIA_URL = "https://<staging>/..."
npm run test:cloud:official-media-smoke
```

### 4.4 运维：official-source-roots

`check:official-source-roots` 报告 **`roots=0`**（registry 空，schema valid）。  
生产前须灌入品牌/联名方官方根域名 registry，否则官方素材候选绑定无运维权威来源。

---

## 5. Feature flags 与回滚

| Flag | 用途 |
|------|------|
| `PILOTDECK_CAPABILITY_SCOPE_V2` | P0-1 能力范围收口 |
| `PILOTDECK_GOAL_QUALITY_CONTRACT` | P0-2 SessionGoalQualityContract |
| `PILOTDECK_OFFICIAL_MEDIA_V2` | P0-3～P0-6 官方素材链 |
| `PILOTDECK_CONTENT_QUALITY_V2` | P0-9 内容与主体断言 |
| `PILOTDECK_UI_DELIVERABLE_QUALITY` | P0-8 UI 质量状态 |
| `PILOTDECK_QUALITY_CANARY_SLUGS` / `PILOTDECK_QUALITY_CANARY_TENANTS` | 灰度 |

回滚：经 `stabilityFlags.ts` / `pack.mjs` / Bridge `runtimeFeatureFlags` 三态切换，分钟级。

---

## 6. 相关文档与产物

| 路径 | 说明 |
|------|------|
| `docs/mingdi-g700-production-hardening-baseline-20260718.zh-CN.md` | 11 案脱敏基线 |
| `tests/fixtures/mingdi-g700-20260718-cases.ts` | 红测 fixture |
| `artifacts/mingdi-g700-production-acceptance/baseline.json` | 基线 JSON |
| `artifacts/mingdi-g700-production-acceptance/live-structure-report.json` | 7 场景结构门禁 |
| `artifacts/capability-scope-audit/report.json` | P1 scope 审计 |
| `docs/mingdi-g700-production-hardening-acceptance-20260718.zh-CN.md` | 门禁入口说明（简版） |

---

## 7. 签收说明

- 本报告覆盖计划 P0-0～P0-10 + P1 骨架的**离线/结构验收**与**历史问题案例组织**。  
- **不得**据此宣称「鸣镝 G700 生产稳态已 GO」；须待 §4 实机与 soak 全绿后再更新本报告 verdict。  
- **等待用户下一步命令**（启动 dev:saas 实机、Bridge soak、云端 smoke 或发版决策）。
