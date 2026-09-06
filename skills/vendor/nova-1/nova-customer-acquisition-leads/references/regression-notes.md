# Regression Notes（2026-06-08）

## 用户反馈（北京地区 AI 外包获客）

| 现象 | 根因 | 修复 |
|------|------|------|
| 对话输出大段 JSON / `</parameter>` 残片 | 把内部抽取结果直接贴气泡 | pilotdeck-execution：禁止 JSON in chat |
| 同一招标重复十余次 | Phase E 未去重 | playbook 去重规则 + quality-gates |
| 成果是 `.html` 网页文件 | 把抓取缓存当交付物 | 禁止 html 作用户成果；写入 report.md |
| 无整齐可读报告 | 只有 index.json | 强制 `leads-report.md` + report-template |
| 表格未用、像代码块 | 无展示规范 | 对话仅允许 Markdown 表格；报告用表格排版 |

## 验收

```bash
python skills/vendor/nova-1/nova-customer-acquisition-leads/acceptance/validate_manifest.py
```

## 复测提示词

```
按【北京地区的人工智能外包项目】智能获客：检索、抽取线索并输出评分清单。
产物必须是 artifacts/acquisition-beijing-ai-outsourcing/leads-report.md（表格排版），对话里只给摘要和 Top 表格，不要贴 JSON。
```
