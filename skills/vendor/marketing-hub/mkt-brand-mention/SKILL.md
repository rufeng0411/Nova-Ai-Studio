---
name: mkt-brand-mention
description: 监测品牌在 AI 对话、搜索与社媒中的提及与情感倾向。
---

# 品牌提及监测

汇总品牌在公开渠道与 AI 可见度场景中的提及，输出情感倾向与代表性引文。

## 步骤

1. 明确品牌名、别名与竞品列表
2. 联网检索近期提及（新闻、社媒、问答社区）
3. 按正面 / 中性 / 负面分类，附原文摘录
4. 给出 3 条可执行的舆情或内容建议

## 产出

- `mention-report.md`：提及清单与情感摘要

## 与 GEO 监测栈分工

- 本 skill：**公开渠道**提及与情感，不产出逐大模型收录矩阵
- 主流大模型收录详情：使用 `geo-visibility-probe` → `geo-monitor-hub` → `geo-monitor-report`（`llm_coverage`）
