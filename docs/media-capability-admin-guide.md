# 媒体能力管理员指南

面向管理员：一次配置 Key，让对话里「做视频 / 配音 / 转写 / 音乐」直接出文件。

## 1. 通义 DashScope（主路径）

**覆盖**：对话、识图、生图、生视频、语音合成、语音识别。

1. 设置 → **模型池** → 添加 **通义千问 (qwen)**，填写 `DASHSCOPE_API_KEY`
2. 在模型池勾选需要的 **图片 / 视频 / 语音合成 / 语音识别** 模型 chip
3. 设置 → **能力接入中心**：
   - **图片能力**：provider 选 `qwen`，model 如 `qwen-image-plus`
   - **视频能力**：provider 选 `qwen`，model 如 `happyhorse-1.0-t2v` 或 `wanx2.1-t2v-turbo`
   - **语音合成**：provider 选 `qwen`，model 默认 `cosyvoice-v3-flash`
   - **语音识别**：provider 选 `qwen`，model 默认 `fun-asr`（文件）或 `fun-asr-realtime`（流式）
4. 点 **写入 tools.*** 继承模型池 Key → 右上角 **保存** → 重启 `npm --workspace ui run dev:concurrent`

### 推荐默认模型

| 能力 | 默认 model |
|------|------------|
| 配音/旁白 | `cosyvoice-v3-flash` |
| 文件转写 | `fun-asr` |
| 文生视频 | `happyhorse-1.0-t2v` 或 `wanx2.1-t2v-turbo` |

## 2. Wonda（音乐 + 快速音频）

**覆盖**：AI 音乐、可选 TTS/转写/对话音频（CLI）。

| 项目 | 值 |
|------|-----|
| 官网 | https://www.wonda.sh |
| API Base | `https://api.wondercat.ai/api/v1` |
| 配置 | 能力接入中心 → **Wonda** API Key |
| CLI | `npm i -g @degausai/wonda` |

音乐示例：

```bash
wonda generate music --model suno-music --prompt "轻快 Vlog BGM 30 秒"
```

## 3. 用户怎么说（复制即用）

| 场景 | 示例 |
|------|------|
| 产品短视频 | 「用通义生成 15 秒产品宣传 mp4，存 artifacts/」 |
| 配音 | 「把这段文案配中文旁白 mp3」 |
| 会议转写 | 「转写 uploads/meeting.mp3 并写纪要」 |
| BGM | 「生成 30 秒轻快背景音乐」 |
| 可编辑 Remotion | 「用 Remotion 做可编辑时间轴工程，不要直接 API 成片」 |

## 4. 视频路由说明

- 已配置 **视频 API** 且用户要 **成片 mp4** → Agent 应优先 `generate_video`
- 无视频 Key 或用户要 **HTML/Remotion 工程** → `render_html_video` / HyperFrames
- 环境变量 `PILOTDECK_MEDIA_STRATEGY_RESOLVER=1`（SaaS 默认开启）启用自动路由提示

## 5. 播客（火山 TTS 可选）

`df-podcast-generation` 使用火山 TTS，需在环境变量或自定义 env 配置：

- `VOLCENGINE_TTS_APPID`
- `VOLCENGINE_TTS_ACCESS_TOKEN`
- `VOLCENGINE_TTS_CLUSTER`

或改用 **Wonda** 生成对话音频。

## 6. 验收 smoke

```bash
npm run smoke:video-routing    # 视频路由单测
npm run smoke:media-audio      # 语音/识别工具注册与配置
node scripts/integration-media-smoke.mjs   # 需本地 gateway 运行
```

## 7. MCP（Firecrawl / Postiz / Figma）

见 [docs/media-mcp-integration-guide.md](./media-mcp-integration-guide.md)。
