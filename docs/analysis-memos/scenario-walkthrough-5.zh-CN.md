# 五类标准场景走查表

**日期**：2026-06-21 | **方法**：dev JSONL 复盘 + 代码路径对照（非实时 Playwright）

---

## 场景 1：附件 docx → 可编辑 PPT

| 项 | 内容 |
|----|------|
| **代表会话** | `web-s_c7273358`（沧海 24 页） |
| **用户期望** | `.pptx` 24 页，商务科技极简 |
| **实际路径** | read_skill → bash 失败×N → tool_recovery(HTML 导向) → presentation.html → **success** |
| **validate** | 无 .pptx；HTML 可能 broken/非目标 |
| **干预** | 用户：「没按附件页数」 |
| **根因** | S1 假完成 + X4 recovery 文案 + Windows bash |
| **P0 修复** | incompleteDeliverable + slug recovery + python-pptx 无 bash 路径 |

---

## 场景 2：调研报告三合一

| 项 | 内容 |
|----|------|
| **代表会话** | `web-s_a4d3bbf3`（3 次干预）、北京 AI 报告复盘 doc |
| **期望** | 01/03.md + charts + docx |
| **实际** | read_file skills/ 链、recovery 耗尽 |
| **根因** | 模板 binding 部分生效；repeat guard 未覆盖换 skill 路径 |
| **P0** | research-report execution binding 全覆盖 + export_document |
| **验收** | `npm run test:recovery-beijing-ai-report` |

---

## 场景 3：脑爆 Tab → 中途要文件

| 项 | 内容 |
|----|------|
| **代码路径** | `chatFirstCapabilities` 禁工具；`userRequestsBrainstormDeliverable` **未接线** |
| **风险** | 用户说「生成报告」仍不升档 |
| **走查结论** | 缺运行时检测 → 误禁或误写 |
| **P1** | 接线 deliverable 检测到 binding/recovery |

---

## 场景 4：Hub 试一下 → 同会话第二轮修改

| 项 | 内容 |
|----|------|
| **机制** | `clearAllPendingCapability()` 首条 send 后清空 |
| **风险** | 第二轮无 `<capability-binding>` |
| **样本** | PPT 多轮干预会话（d3888017, 847ea291） |
| **P0** | 会话级 binding 写入 transcript/session metadata |

---

## 场景 5：联网调研 + soft_fetch 失败

| 项 | 内容 |
|----|------|
| **机制** | soft_fetch_recovery + auto_continue |
| **优点** | 不中断 turn |
| **风险** | X2：「拿不到信息」也续跑 → 不澄清 |
| **样本** | 雷蛇调研 acdcb4ae（联网成功但未写报告） |
| **P1** | 区分 soft_fail vs 需用户 Key；占位继续须写 md 阶段文件 |

---

## 走查汇总

| 场景 | 子任务成功率（样本） | 零干预 | 主杠杆 |
|------|---------------------|--------|--------|
| 1 PPT | ~6% | 低 | validate + recovery 分支 |
| 2 调研 | ~31% verified | 中 | 模板 binding |
| 3 脑爆 | 未量化 | — | 升档检测 |
| 4 多轮 Hub | 低 | 低 | 持久 binding |
| 5 soft_fetch | 中 | 中 | 澄清 vs 续跑裁决 |
