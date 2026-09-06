# Quality Gates

交付前 Agent 与用户（可选）对照本清单。

---

## Blockers（必须全部通过）

### 1. Pipeline 完整性

- [ ] 存在 Phase B `query-expansion` 产物
- [ ] 存在 Phase C `raw_pages` 或等价发现记录
- [ ] 经过 Phase D 分类（或有 documented 跳过原因）
- [ ] 每条交付线索来自 Phase E 抽取 JSON，**非** Agent 臆造
- [ ] **未**跳过分类直接从搜索标题编造联系方式

### 2. 需求方意图

- [ ] 交付线索为**采购/求购/发包方**需求，非供应广告
- [ ] `intent_label=noise_irrelevant` 的线索已剔除
- [ ] `content_evidence` 或 `description` 能支撑需求方意图

### 3. 来源可追溯

- [ ] 每条线索有 `source_url`
- [ ] 使用搜索摘要时 `field_provenance` 含 `bocha_snippet` / `search_snippet`
- [ ] 未向用户声称「官方政采库已清洗字段」

### 4. 联系方式

- [ ] 高优（High）线索至少有电话、邮箱或明确联系人段落之一
- [ ] `contact_candidates` 非空时主 `contact_info` 与之不矛盾
- [ ] 400/95 客服号已降权标注（若为主号码）

### 5. 关键词相关

- [ ] `match_score` 或人工 spot-check：与 `keyword` 主题相关
- [ ] 英文/混合正文不因无「招标」字面被误删（trust `intent_label`）

### 6. Manifest 一致

- [ ] `manifest.leads_count` = 交付数组长度
- [ ] `keyword` / `data_sources` 与 Phase A 一致
- [ ] 无重复 `source_url` / 无同一项目复制 10+ 次

### 7. 用户可见交付（PilotDeck）

- [ ] 存在 `artifacts/acquisition-{run_slug}/leads-report.md`
- [ ] 报告内为 **Markdown 表格**，无 JSON/HTML 代码块
- [ ] 对话中**未**粘贴 manifest JSON 或网页 HTML 残片
- [ ] 对话摘要含表格 + 报告路径；详情在 MD 文件内

---

## Warnings（建议修复）

- [ ] `intent_summary` / `track_reason` 非空话
- [ ] 重复 URL 或重复单位已 dedupe
- [ ] 已定标成交页已排除（除非有联系且用户要历史库）
- [ ] 社媒线索标 `audience_type` / `social_signal`

---

## Regression scenarios（来自单测语义）

| 场景 | 期望 |
|---|---|
| LLM 标 `procurement_tender` 但标题英文 | 保留，不因无「招标」字面剔除 |
| 正文含用户关键词「户外广告」 | 保留 |
| `noise_irrelevant` | 剔除 |
| 仅 bocha snippet | confidence ≤0.65 |
| 分类 index 0-based vs 1-based | 映射正确，无错位丢页 |

---

## Sample-first gate（推荐）

- [ ] 批量抽取前先对 3–5 页跑 E→F，用户或 Agent 确认 JSON 形状与噪音率

---

## Acceptance themes

见 [acceptance/README.md](acceptance/README.md)：

1. **北京地区户外广告 招标采购**
2. **人工智能软件开发 外包**

每主题 ≥5 条有效线索 + 完整 manifest 即视为 Skill 验收通过。
