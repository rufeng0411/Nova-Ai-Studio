# PilotDeck / Nova Ai-Studio 执行说明

## 工作目录

**主交付必须写入系统分配的 STDA 任务目录**（会话注入的 `<task-artifact-dir>` / `artifacts/task-{YYYYMMDD}-{id8}/`）。  
过程缓存可放同目录下的 `acquisition-work/` 子目录；**禁止**只写到 `artifacts/acquisition-{run_slug}/` 却不写 STDA（否则成果清单无法对齐）。

| 文件 | 用途 | 是否给用户看 |
|------|------|--------------|
| `{taskArtifactDir}/leads-report.md` | **主交付**：精美表格报告 | ✅ 对话摘要 + 可点击打开 |
| `{taskArtifactDir}/acquisition-manifest.json` | 机器可读全量数据 | ❌ 勿在对话贴 JSON |
| `query-expansion.json` 等 | 检索规划 / 过程 | ❌ 内部，不进成果清单 |
| `raw-pages-index.json` | 可选，发现页索引 | ❌ 内部 |

**禁止**把抓取的 `.html` 网页缓存当作成果展示给用户（可内部参考，不出现在「本回合成果」）。

## 对话中展示规则（Hard）

1. **禁止**在气泡中输出：
   - JSON 数组/对象（含 `acquisition-manifest`、`index.json`、lead 抽取结果）
   - 代码块（\`\`\`json / \`\`\`html）
   - 网页正文乱码片段、招标 HTML 残片
2. **允许**在气泡中输出：
   - 2–4 句执行摘要
   - **一张 Markdown 表格**（高优 Top 5–10，列：单位、需求、联系方式、匹配度、来源链接）
   - 报告文件路径：`{taskArtifactDir}/leads-report.md`（须与真实落盘一致）
3. 用户要详情 → 引导打开 **`leads-report.md`**，不要在对话里展开全文。

## Phase E 去重（写入前必做）

- 按 `source_url` 去重；同 URL 只保留 `extraction_confidence` 最高的一条。
- 按 `company_name` + `title` 去重，避免同一项目重复 10+ 次。
- `id` 字段若存在须 1..N 连续唯一。

## Phase G 步骤

1. 校验 manifest 与 `leads[]`（去重后）。
2. `write_file` → `{taskArtifactDir}/leads-report.md`（严格按 [report-template.md](report-template.md)）。
3. `write_file` → `{taskArtifactDir}/acquisition-manifest.json`。
4. 对话回复：摘要 + Top 表格 + **报告路径**（须为 STDA 任务目录下真实路径）。

## 常见失败对照

| 症状 | 修复 |
|------|------|
| 对话里刷 JSON / `</parameter>` 残片 | 禁止；只写文件，对话仅表格摘要 |
| 重复同一招标 10 次 | Phase E 后去重再写 manifest |
| 成果是 `.html` 文件 | 不作为交付物；线索写入 report.md |
| 只有 index.json 无 report | 补写 `leads-report.md` 再结束 |
