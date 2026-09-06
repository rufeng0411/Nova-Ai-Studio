# 产品视角 Memo：任务什么叫「完成」

**角色**：产品经理 | **日期**：2026-06-21

---

## 问题清单

1. **完成定义不一致**：用户要 `.pptx`，系统展示「已完成 N 步」或 HTML 成果。
2. **试一下承诺落差**：Hub 预填后用户预期「一次点击即交付」，实际 PPT 类 **94% 未完成 pptx**（基线 18 条中 17 incomplete）。
3. **干预不可见**：`autoRecoveryContinue` 默认开，用户不知道系统在静默续跑，失败时仍归咎于产品「不智能」。
4. **过程 vs 成果**：InformalProcessStack 步数被误读为进度条。
5. **多轮续做无 binding**：第二轮修改时约束丢失，偏离首条意图。

## 根因假设

- 产品未定义 **按能力类型的 Done 标准**（pptx / md+docx / PNG+manifest+导出）。
- 验收以 **链路 smoke** 为主，缺 **任务完成率** 门禁。
- 用户旅程在「turn 结束」与「verified 成果」之间缺少 **显式状态**。

## 任务完成定义表（建议）

| 能力/模板 | 用户 Done | 系统 Must NOT 算 Done |
|-----------|-----------|------------------------|
| PPT 幻灯 / anth-pptx | 可下载 `.pptx`，页数/附件对齐 | 仅 HTML、仅脚本、规划文案 |
| Nova 美学幻灯 | PNG 集 + manifest + 用户点「导出 PPT」得 pptx | 仅 slide-NN.png 无导出 |
| 调研报告模板 | `01-/03-.md` + export docx | 仅 read_skill 链 |
| HTML 演示 | 单文件 HTML 可预览 | 空壳 index |
| 脑爆 Tab | 对话结论（可选文件） | 未要求时 write_file |

## 改进杠杆

| 优先级 | 项 | 预期 |
|--------|-----|------|
| P0 | 成果 validate 后再宣布完成 | 降假完成 |
| P0 | 按能力展示「还差：导出 PPT」 | 降误解 |
| P1 | 续跑弱提示「正在从上次继续」 | 降「是不是坏了」 |
| P1 | 会话级 capability binding | 降多轮偏离 |
| P2 | 设置页说明自动续跑 | 降信任损耗 |

## 证据

- [`task-completion-analysis-baseline-2026-06-21.zh-CN.md`](../task-completion-analysis-baseline-2026-06-21.zh-CN.md)
- 沧海 transcript closure
