---
name: nova-customer-acquisition-leads
description: Use when the user needs B2B/local lead discovery (procurement, outsourcing, tenders). Follow Phase B–G; deliver leads-report.md with markdown TABLES—not raw JSON/HTML in chat. Write acquisition-manifest.json to artifacts/acquisition-{slug}/ only via write_file.
---

# Nova 智能获客 Leads

## Overview

用户关键词 → 检索规划 → 页面发现 → 分类 → 线索抽取 → 评分 → **精美 Markdown 报告（表格）** + 后台 JSON manifest。

## Hard rules（违反即未按本 Skill 执行）

1. **先读** [playbook.md](playbook.md) 与 [references/pilotdeck-execution.md](references/pilotdeck-execution.md)。
2. **主交付物**：`artifacts/acquisition-{run_slug}/leads-report.md`（按 [references/report-template.md](references/report-template.md)）。
3. **对话中禁止**：JSON 代码块、HTML 残片、manifest 全文、重复粘贴抽取结果。
4. **对话中仅允许**：简短摘要 + **一张 Markdown 表格**（高优 Top 5–10）+ 报告文件路径。
5. Phase E 完成后 **去重**（`source_url`、`company_name`+`title`），再写入 manifest 与报告。
6. 抓取的 `.html` **不得**作为用户可见成果；线索信息写入报告表格。
7. 强制顺序 B → C → D → E → F → G；禁止跳过分类编造线索。

## When to Use / NOT to Use

（同前：B2B/政采/外包需求方线索；非调研长文、非 CRM 搭建。）

## Pipeline

| Phase | 输出 |
|---|---|
| A | `keyword`, `data_sources`, `run_slug` |
| B | `query-expansion.json` |
| C | `raw_pages[]`（内部） |
| D | 保留需求页 |
| E | `leads[]`（去重后） |
| F | 评分排序 |
| G | **`leads-report.md`** + `acquisition-manifest.json` |

## Agent checklist

- [ ] 已读 pilotdeck-execution + report-template
- [ ] leads 已去重，无同一项目重复多条
- [ ] `leads-report.md` 含完整表格排版
- [ ] 对话无 JSON/HTML 代码块，仅有表格摘要
- [ ] 用户可见路径指向真实 `leads-report.md`

## Related Skills

- `nova-research-*`：行业报告，非线索清单。
- `nova-ppt-aesthetic-slides`：可选，将高优线索做成汇报幻灯。
