# PilotDeck — Word 文档（anth-docx）接入说明

## 技能标识

- **slug**：`anth-docx`（对话里 `read_skill anth-docx`）
- **来源**：Anthropic 官方 [anthropics/skills](https://github.com/anthropics/skills) · `docx` 子技能
- **级别**：L2（需本机 `docx` npm 包；编辑已有 docx 时建议 Python 3 + 可选 pandoc）

## 一次性准备

在 PilotDeck 仓库根目录：

```bash
npm install
node scripts/integration-docx-smoke.mjs
```

通过后会生成 `artifacts/docx-smoke/sample-brief.docx`。

同步到用户技能目录（若尚未同步）：

```bash
node scripts/bootstrap-pilotdeck-config.mjs
```

## Agent 如何生成 .docx

1. `read_skill anth-docx`
2. **新建文档**：用 Node `docx` 包写脚本（见 SKILL.md「Creating New Documents」），保存到项目目录，例如 `artifacts/brief/campaign-brief.docx`
3. **可选校验**（在技能目录下执行）：

   ```bash
   python scripts/office/validate.py path/to/output.docx
   ```

4. 完成后告诉用户**完整文件路径**

## 快捷模板（维护者 smoke 用）

```bash
node scripts/render-docx-brief.mjs --out artifacts/brief/my-brief.docx --title "618 活动传播 brief"
```

## 与 Open Design 分工

| 需求 | 用 |
|------|-----|
| 浏览器打开的 HTML 页面/海报/汇报 | `od-*` |
| 给客户/媒体的 Word 通稿、正式 brief | `anth-docx` |

## 故障排查

| 现象 | 处理 |
|------|------|
| `Cannot find module 'docx'` | 在仓库根目录运行 `npm install` |
| validate.py 失败 | 先确认 Python 3 可用；新建文档可跳过 validate，用 Word/WPS 打开检查 |
| skill_list 无 anth-docx | 运行 `node scripts/bootstrap-pilotdeck-config.mjs` |
