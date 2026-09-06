# 社媒矩阵创作 — 管理员指南

技能路径：`skills/social-creative-matrix`（slug：`social-creative-matrix`）。

## 依赖

| 能力 | 配置项 | 说明 |
|------|--------|------|
| AI 配图 | `tools.image`（如通义 DashScope） | 阶段 4 调用 `generate_image` 四次 |
| 国内发布（可选） | `tools.yixiaoer.apiKey` 或 `YIXIAOER_API_KEY` | 仅阶段 7 发布交接 |
| 账号绑定 | 蚁小二网页 | 对话内不能新绑号，见 `docs/yixiaoer-admin-guide.md` |

## 同步到全局技能目录

```bash
node scripts/bootstrap-pilotdeck-config.mjs
```

## 冒烟（无需 API Key）

```bash
node scripts/integration-social-matrix-smoke.mjs
```

检查项：SKILL.md、references、assets 模板、`pack-social-matrix-yixiaoer.mjs`  mock 输出结构。

## 打包脚本（发布 payload 骨架）

```bash
node scripts/pack-social-matrix-yixiaoer.mjs \
  --manifest artifacts/social-matrix/<slug>/manifest.json \
  --upload-map artifacts/social-matrix/<slug>/yixiaoer/upload-map.json \
  --draft platform
```

- `--draft platform`：默认 `pubType: 0`（平台草稿倾向）
- `--draft yixiaoer`：根级 `isDraft: true`
- `--accounts`：可选 JSON，`{ "小红书": "<platformAccountId>", ... }`

Agent 仍应优先 `yixiaoer_api` 手填 `contentPublishForm`（见各平台 `skills/yixiaoer/docs/publish/image-text/*.md`）。

## 人工 E2E 清单

1. 配置 `tools.image` +（可选）蚁小二 Key，运行 bootstrap。
2. 对话示例：

   ```
   read_skill social-creative-matrix，主题「春季新品」，平台全选，四套图+文案矩阵，先不要发布
   ```

3. 确认 `artifacts/social-matrix/<slug>/` 含：
   - `brief.md`、`copy-matrix.md`、`manifest.json`
   - `visuals/image-9x16.png`、`image-1x1.png`、`image-16x9.png`、`image-3x4.png`
4. 若要发布：再明确要求「存平台草稿」，核对 `yixiaoer/upload-map.json` 与 `publish-draft.json`。

## 目录与 catalog

- 用户例句：`docs/social-matrix-prompt-examples.md`
- 设计目录行：运行 `node scripts/generate-open-design-catalog.mjs`
- 能力中心：运行 `node scripts/generate-capabilities-catalog.mjs`（`config/capabilities.overrides.json` 已含 `social-creative-matrix`）

## 故障排查

| 现象 | 处理 |
|------|------|
| 不出图 | 检查能力中心图片 provider 与 API Key |
| 发布 JSON 校验失败 | 先读 `image-text/index.md`，再读对应平台子文档 |
| 平台名报错 | `platforms` 必须用中文，见 `skills/yixiaoer/docs/platform.md` |
| 外链图失败 | 禁止 URL，必须本地 `upload`，见 `references/anti-patterns.md` |
