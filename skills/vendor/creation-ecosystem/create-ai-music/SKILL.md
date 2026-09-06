---
name: create-ai-music
description: Generate AI music and background tracks via Wonda CLI (Suno and other models). Use when the user asks for BGM, soundtrack, jingles, or AI-composed music — not for voice narration (use generate_speech or Wonda TTS).
---

# AI 音乐生成（Wonda）

PilotDeck 默认通过 **Wonda** 生成音乐，不使用单独的「音乐 API Key」占位项。

## 前置条件

1. 设置 → **能力接入中心** → 填写 **Wonda API Key**（`https://api.wondercat.ai/api/v1`）
2. 安装 CLI（若 PATH 无 `wonda`）：

```bash
npm i -g @degausai/wonda
```

3. 验证：`wonda auth check` 或确保环境变量 `WONDA_API_KEY` / `PILOTDECK_SKILL_WONDA_API_KEY` 已注入

## 工作流

### 1. 理解需求

- 风格/情绪（轻快、史诗、Lo-Fi 等）
- 时长（如 30 秒 BGM、完整歌曲）
- 是否纯音乐（instrumental）或带歌词

### 2. 生成音乐

```bash
wonda generate music --model suno-music --prompt "轻快 Vlog 背景音乐，30 秒，无歌词" --output artifacts/media/bgm.mp3
```

常用参数（以 `wonda generate music -h` 为准）：

- `--model`：`suno-music` 等
- `--prompt`：风格与用途描述
- `--duration`：秒数（若 CLI 支持）
- `--output`：写入 workspace 相对路径

### 3. 交付

- 在对话中给出 **mp3 相对路径**（如 `artifacts/media/bgm.mp3`）
- 若 Key 未配置：说明需在能力接入中心填写 Wonda Key，勿假装已生成

## 与旁白/播客的区别

| 需求 | 使用 |
|------|------|
| AI 作曲 / BGM | 本技能 → `wonda generate music` |
| 文字转旁白 | `generate_speech` 或 `wonda generate tts` |
| 双人播客 | `df-podcast-generation` 或 Wonda 对话音频 |

## 故障排查

- `command not found: wonda` → 先 `npm i -g @degausai/wonda`
- 401 / 未授权 → 检查 Wonda Key 是否保存并重启 `dev:saas`
- 不要用 `PILOTDECK_SKILL_MUSIC_API_KEY`（历史占位，无内置消费方）
