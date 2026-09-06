# 反模式清单（发布前必读）

## 绝对禁止

1. **外链图片**：蚁小二 `upload` 只接受本地上传后的 `key`，禁止把任意 HTTP URL 填入 `images`/`cover`。
2. **英文平台名**：`platforms` 必须用中文（如 `抖音`，不是 `Douyin`）。
3. **跳过 image-text Index**：发布前未读 `skills/yixiaoer/docs/publish/image-text/index.md` 就组装 payload。
4. **跳过平台子文档**：有话题/地点/分类/音乐需求时，未读对应 `image-text/<platform>.md`。
5. **混用 publishType**：本技能首版只做 `imageText`；不要在同一请求里混 `video`/`article`。
6. **未配置就生成图**：`tools.image` 未配置时仍调用 `generate_image`（应提示用户去能力接入中心）。
7. **默认公开上线**：用户未明确说「发布/上线/公开」时，不得 `pubType: 1` 或直接公开推送。

## 应避免

1. **直接提交 pack 骨架**：`pack-social-matrix-yixiaoer.mjs` 生成的 `publish-draft.json` 含 `REPLACE_<平台>_platformAccountId` 占位；发布前必须用 `accounts` 结果替换，并按平台文档补全 `contentPublishForm`。
2. **四套图 prompt 不一致**：四次 `generate_image` 修改了主体/风格，导致矩阵不统一。
3. **文案超字不标注**：标题超平台上限却未在 `notes` 说明裁剪策略。
4. **知乎超过 9 图**：知乎 imageText 文档限定 1–9 张。
5. **百家号无标题**：百家号标题 1–20 字必填。
6. **快手缺 visibleType**：快手图文 `visibleType` 必填。
7. **头条缺 pubType**：头条号 `pubType` 必填（0 草稿 / 1 发布）。

## 微信公众号

首版 **8 平台矩阵不含公众号**。文章类发布必须单独 `publishType: article` 且公众号**不能与其他平台同请求**（见 yixiaoer article index）。用户坚持要公众号时，另开任务并 `read_skill yixiaoer`。

## 检索禁止（PilotDeck）

- 禁止在仓库搜索 `api.ts` 或 `Documents/yixiaoer-docs` 代替文档。
- 发布/查账号优先 **`yixiaoer_api`** 工具（见 `skills/yixiaoer/SKILL.md` 速查块）。
