# PPT 导出默认策略（意图分流）设计

**日期**：2026-07-24  
**路由**：C — 商务/汇报 → 原生可编辑；美学/视觉 → Nova 美学  
**商务首选技能**：`anth-pptx`（`ppt-master` 同级备选）  
**Flag**：`PILOTDECK_PPT_EXPORT_DEFAULT_POLICY`（dev/SaaS 默认开；`0` 回滚）

## 意图

| Route | 信号 | 技能 | 成果 |
|---|---|---|---|
| `native_editable` | 做/导出 PPT、路演、汇报、可编辑、.pptx（未点名美学） | `anth-pptx` | 真 `.pptx` |
| `nova_aesthetic` | Nova 美学、AI 配图幻灯、杂志/海报风幻灯、`nova-ppt-*` | `nova-ppt-aesthetic-slides` | PNG+manifest → MinerU 可编辑 |
| `doc_export` | 「把 md/报告转成 PPT」且无视觉诉求 | `export_document` → pptx | 同目录 `.pptx` |

## 质量强制（各路径）

- 风格/版式：母版、配色、字体层级；默认 16:9  
- 图表：有数据/对比时必做；无可靠数据须标示意  
- 配图阶梯：官网/权威站 → 位图占位（须标注）→ 其他可用 AI 生图；禁 generate_image 冒充官图  

## 注入点

- `src/saas/pptExportDefaultPolicy.ts` — 检测 + prompt XML  
- `AgentLoop` appendSystemPrompt  
- `saasCoreStrategy` 短条款  
- `capabilityBindingPrompt` 强化 anth-pptx / ppt-master / nova / df-ppt  
- `AGENTS.md` Learned Preferences  
