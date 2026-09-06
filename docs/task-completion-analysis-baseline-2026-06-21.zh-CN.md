# 任务完成率基线报告（2026-06-21）

**数据来源**：`.saas-dev-data/tenants/default/projects/**/chats/*.jsonl`（106 会话）  
**扫描命令**：`npm run analyze:task-completion`  
**原始 JSON**：`artifacts/task-completion-scan.json`

---

## 1. KPI 基线（dev 环境样本）

| 指标 | 数值 | 说明 |
|------|------|------|
| 扫描会话数 | **106** | 含测试/验收/e2e 与真实任务混合 |
| 交付导向会话 | **51** | 首条消息匹配 PPT/调研/文档/HTML 等 |
| 总体用户干预率 | **16.0%** | 用户消息含「继续/不对/重来」等 |
| 交付类干预率 | **21.6%** | 交付导向子集 |
| PPT 完成率（工具路径含 .pptx） | **5.6%** | 18 条 PPT 类仅 1 条产出 .pptx |
| PPT 零干预完成率 | **5.6%** | 同上 1 条 |
| 平均用户干预次数/会话 | **0.21** | |
| 平均 synthetic auto_continue/会话 | **0.01** | JSONL 中 purpose=auto_continue 极少 |
| TTFT first_visible p95 | **37569 ms** | `telemetry/turn-timing.jsonl` |
| memory_retrieve p95 | **5015 ms** | 首 token 前阻塞 |

### 按完成状态分布

| 状态 | 数量 | 含义 |
|------|------|------|
| chat_ok | 49 | 非交付类且未干预 |
| incomplete_ppt | 17 | 要 PPT 但未检测到 .pptx |
| incomplete_research | 11 | 调研类未完成 md/docx |
| verified_html | 10 | HTML 交付且无干预 |
| chat_with_intervention | 6 | 非交付类但有干预 |
| verified_research | 5 | 调研交付且无干预 |
| partial_deliverable | 3 | 有部分文件但未达目标 |
| incomplete | 2 | 其他未完成 |
| incomplete_html | 2 | 要 HTML 但未完成 |
| verified_pptx | 1 | 唯一零干预 PPT 成功样本 |

### 按目标类型

| goalType | 会话数 |
|----------|--------|
| general | 49 |
| ppt | 18 |
| research | 16 |
| html_slides | 12 |
| document | 5 |
| canvas_edit | 4 |
| deliverable_other | 2 |

---

## 2. 二十条会话标注表

| # | sessionId | 场景 | 干预次数 | 最终状态 | 首次干预时机 | AGENTS 原则分(1-5) | 根因分类 |
|---|-----------|------|----------|----------|--------------|-------------------|----------|
| 1 | web-s_c7273358 | 附件→可编辑 PPT（沧海 24 页） | 1+ | incomplete_ppt | turn1 成功后用户纠偏 | 2 | 引擎 success≠交付；bash recovery 误导 HTML |
| 2 | web-s_d3888017 | Nova 美学幻灯 PPT | 2 | incomplete_ppt | 多轮「继续」 | 2 | 规划停/绑定丢失/无 pptx |
| 3 | web-s_847ea291 | 附件严格 24 页 PPT | 2 | incomplete_ppt | 中期 | 2 | 同 #2 |
| 4 | web-s_1344a3f1 | 美学幻灯 8 页 | 1 | incomplete_ppt | 收尾 | 3 | PNG 链未导出 pptx |
| 5 | web-s_a4d3bbf3 | 附件调研报告 | 3 | incomplete_research | 早期 | 1 | skill 链空转 |
| 6 | web-s_cda0c9f2 | 学术图表 PDF | 2 | incomplete | 中期 | 2 | 工具选型/Recovery 泛化 |
| 7 | web-s_a83c5ca9 | HTML 演示 8 页雷蛇 | 1 | incomplete_html | 收尾 | 3 | 交付 HTML 但用户追问红框 |
| 8 | web-s_50bc3d23 | GEO 五步法 | 1 | partial_deliverable | 中期 | 3 | 多步子任务部分完成 |
| 9 | web-s_287c7e14 | 吴裕泰营销 docx→PPT | 0 | incomplete_ppt | — | 3 | 装依赖后规划停（用户反馈） |
| 10 | web-s_41698525 | canvas-edit e2e | 0 | chat_ok | — | 4 | 测试：ENOENT 后说明 |
| 11 | web-s_9dd57592 | canvas-edit e2e | 0 | chat_ok | — | 4 | 测试会话 |
| 12 | web-s_bc44dae2 | 生图合影 | 1 | chat_with_intervention | 中期 | 3 | 附件 ENOENT |
| 13 | web-s_d180fef5 | 智能获客 | 1 | chat_with_intervention | 收尾 | 3 | 长任务未交付清单 |
| 14 | web-s_5fc1c830 | media-smoke HTML | 1 | incomplete_html | 早期 | 4 | smoke 测试 |
| 15 | web-s_219469c1 | nova-ppt 美学 | 0 | verified_html* | — | 4 | *PNG 链，非 pptx |
| 16 | web-s_13c41acb | 流程模板 | 0 | verified_research | — | 5 | 模板绑定有效样本 |
| 17 | web-s_acdcb4ae | 雷蛇调研 | 0 | incomplete_research | — | 3 | 联网成功但未写报告 |
| 18 | web-s_0614-50bc3d23 | GEO | 1 | partial | 中期 | 3 | 多步未全完成 |
| 19 | web-s_ebd2f9c7 | 0608 工作区 | 0 | chat_ok | — | 4 | 短对话 |
| 20 | web-s_9ee5a624 | 0614 长任务 | 0 | incomplete_ppt | — | 2 | TTFT 885s turn，易假卡住 |

**干预触发词统计**（20 条样本）：「继续」>「不对/没按附件」>「重来」

---

## 3. 扫描脚本 v0 能力边界

脚本 [`scripts/analyze-task-completion.mjs`](../scripts/analyze-task-completion.mjs) 当前：

- 解析 JSONL turn、工具路径、合成 recovery 消息
- 启发式判断 goalType / completionStatus（**非**磁盘 validate）
- 统计 intervention 关键词
- 合并 telemetry p95

**下一版**：对接 `POST .../deliverables/validate`、识别 `turn_progress`/`recovery_attempt` 事件行、按 capability slug 分桶。

---

## 4. 基线结论（供 Phase B/C 引用）

1. **PPT 类任务完成率是最大短板**（5.6%），与用户投诉高度一致。
2. **引擎 turn success 与 verified 交付严重脱节**——沧海案例 turn1 即 success 但仅 HTML。
3. **用户干预率 16–22%**，远高于产品目标（<5%）。
4. **auto_continue 在 JSONL 中几乎不可见**（0.01/会话），说明引擎/UI 续跑要么未写入 durable，要么样本前未部署 fix。
5. **TTFT p95 37s+** 放大「假卡住→用户发继续」行为。

---

## 5. 复现与更新

```bash
npm run analyze:task-completion
npm run analyze:task-completion -- --json > artifacts/task-completion-scan.json
```

报告版本：v0 | 2026-06-21
