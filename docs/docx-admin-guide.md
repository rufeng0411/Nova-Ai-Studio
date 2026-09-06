# Word 文档（anth-docx）— 管理员指南

Anthropic 官方 [anthropics/skills](https://github.com/anthropics/skills) 的 **docx** 子技能，本仓 vendored 为 **`anth-docx`**（L2）。

用户提问例句：[`docx-prompt-examples.md`](docx-prompt-examples.md)

---

## 路径一览

| 路径 | 用途 |
|------|------|
| `skills/vendor/anthropics-skills/anth-docx/` | Vendored 技能（含 `SKILL.md`、`scripts/office/*`） |
| `scripts/vendor-anthropics-docx.mjs` | 从 GitHub raw 拉取/更新 docx 技能 |
| `scripts/data/anthropics-docx-tree.json` | 文件清单（无 git clone 时用） |
| `scripts/render-docx-brief.mjs` | 维护者 brief 模板生成 |
| `scripts/integration-docx-smoke.mjs` | 冒烟：技能存在 + `docx` npm 可写文件 |
| `skills/vendor/anthropics-skills/anth-docx/references/pilotdeck-setup.md` | Agent 侧接入说明 |

---

## 一次性准备

```bash
npm install
node scripts/vendor-anthropics-docx.mjs   # 首次或升级上游时
node scripts/integration-docx-smoke.mjs
node scripts/bootstrap-pilotdeck-config.mjs
```

冒烟产物：`artifacts/docx-smoke/sample-brief.docx`

同步 catalog / i18n（改 override 或新增技能后）：

```bash
node scripts/generate-capabilities-catalog.mjs
node scripts/generate-capabilities-i18n.mjs
```

---

## 依赖

| 依赖 | 用途 |
|------|------|
| npm 包 `docx`（仓库根 `package.json`） | **新建** Word 文档（Agent 写 Node 脚本） |
| Python 3（可选） | 编辑已有 docx、校验 `scripts/office/validate.py` |
| pandoc / LibreOffice（可选） | 上游技能文档中的高级编辑与 PDF 转换 |

---

## 能力中心

- `config/capabilities.overrides.json` → `anth-docx`：阶段 **创意内容**，L2，`examples` 供「试一下」注入
- `scripts/bootstrap-pilotdeck-config.mjs` → `REFRESH_SKILL_SLUGS` 含 `anth-docx`（升级 vendor 后覆盖 `~/.pilotdeck/skills/anth-docx`）

---

## Agent 约定

1. `read_skill anth-docx`
2. 新建：用 `require('docx')` 或 ESM `import`，输出到项目目录（如 `artifacts/brief/…docx`）
3. 编辑已有：按 SKILL.md 走 unpack/edit/pack 或 python 脚本
4. 完成后回报**完整文件路径**
5. HTML 视觉交付 → `od-*`，不要混用

---

## 故障排查

| 现象 | 处理 |
|------|------|
| `Cannot find module 'docx'` | 仓库根 `npm install` |
| smoke 失败 | 看 stderr；确认 `skills/vendor/.../anth-docx/SKILL.md` 存在 |
| `skill_list` 无 anth-docx | `node scripts/bootstrap-pilotdeck-config.mjs` |
| 与 vendor 内 `od-*` 重复 slug | 无；docx 单独 slug `anth-docx` |

---

## Fork 改动登记

| 能力 | 路径 | 类型 | 覆盖上游 | 说明 | 日期 |
|------|------|------|----------|------|------|
| anth-docx L2 | `skills/vendor/anthropics-skills/anth-docx/`、`scripts/vendor-anthropics-docx.mjs` | 新增 | 否 | Word docx 技能 vendor + PilotDeck 段落 | 2026-06-01 |
| 能力中心 | `config/capabilities.overrides.json` | 配置 | 否 | anth-docx → 创意内容 L2 | 2026-06-01 |
| 文档 | `docs/docx-*.md` | 文档 | 否 | 管理员/用户手册 | 2026-06-01 |

许可：见 `skills/vendor/anthropics-skills/anth-docx/LICENSE.txt` 与 `ATTRIBUTION.md`（Anthropic Proprietary，再分发前请法务确认）。
