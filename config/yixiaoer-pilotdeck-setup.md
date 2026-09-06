# PilotDeck × 蚁小二 集成说明

本文档为 PilotDeck 追加，不修改官方 DTO 规则。Agent 在 PilotDeck 中执行蚁小二任务时**必须**阅读本节。

## 1. 凭据

- **推荐**：PilotDeck 设置 → 能力接入中心 → 社媒发布（蚁小二），写入 `tools.yixiaoer.apiKey`
- 或环境变量 `YIXIAOER_API_KEY`（必填）
- 可选 `YIXIAOER_API_URL` / `tools.yixiaoer.apiUrl`（默认 `https://www.yixiaoer.cn/api`）
- **禁止**将 API Key 写入仓库、日志或 artifacts
- **无需**安装蚁小二桌面客户端（默认云发布；仅 `publishChannel: local` 时需要客户端）

## 2. 推荐调用方式（禁止乱搜脚本）

**优先**：调用 PilotDeck 内置工具 **`yixiaoer_api`**（无需 bash、不会在 Documents 里搜索 api.ts）。

查正常抖音/小红书账号示例：

```json
{
  "action": "accounts",
  "platforms": ["抖音", "小红书"],
  "loginStatus": 1,
  "page": 1,
  "size": 100
}
```

**禁止**在 `Documents/yixiaoer-docs`、用户下载目录或全局 `find`/`dir /s` 里找 `api.ts`。

```bash
node "%PILOTDECK_YIXIAOER_API%" --payload-file path/to/payload.json
```

若 `PILOTDECK_YIXIAOER_API` 未设置，可 fallback 到 PilotDeck 安装目录：

```bash
node scripts/yixiaoer-api.mjs --payload-file path/to/payload.json
```

（仅在当前项目就是 PilotDeck 源码仓时使用相对路径。）

技能目录（读 DTO 文档用）：`%PILOTDECK_YIXIAOER_SKILL_DIR%`，或 `skills/yixiaoer/` / `~/.pilotdeck/skills/yixiaoer/`。

## 3. 查账号（accounts）速查

用户问「有哪些抖音/小红书号、只要状态正常的」时：

1. 可选：`read_file` → `{PILOTDECK_YIXIAOER_SKILL_DIR}/docs/query-accounts.md`
2. 写入 payload 文件（示例）：

```json
{
  "action": "accounts",
  "platforms": ["抖音", "小红书"],
  "loginStatus": 1,
  "page": 1,
  "size": 100
}
```

3. 执行：

```bash
node "%PILOTDECK_YIXIAOER_API%" --payload-file 上述文件.json
```

4. 从返回 JSON 的 `data.data[]` 提取 `platformName`、`platformAccountName`、`status`（`1`=正常）。

## 4. read_skill 与 read_file 分工

- `read_skill yixiaoer` 返回 `SKILL.md`（含 PilotDeck 速查）
- **发布前**必须用 `read_file` 读取：
  1. `docs/publish/{article|image-text|video}/index.md`
  2. 对应平台页，如 `docs/publish/image-text/xiaohongshu.md`
- 遇错先读 `docs/troubleshooting-guide.md`

## 5. 发布安全（PilotDeck 默认策略）

1. 用户**未明确**说「发布 / 上线 / 公开」→ 默认 **平台草稿**（`publish` + `pubType: 0`）或 **蚁小二草稿**（`save-draft`）
2. 执行 `publish` 前必须 `accounts` 校验，并向用户确认目标账号昵称；仅 `status=1` 的账号可发
3. 成功后回报 `task_set_id`，可用 `records` / `details` 查状态
4. 资源必须先 `upload` 获得 `key`，禁止在 Payload 中直接使用外部 URL

## 6. autoOrchestrate 说明

PilotDeck 编排模式下，主 Agent 可能无 `bash` 权限。发布类任务应：

- 委派子 Agent 执行 `yixiaoer-api.mjs`，或
- 使用 `reasoning` / 非编排路径直接执行 shell

## 7. 云发布

默认 `publishChannel: cloud`。若报错「客户端不在线」，勿改用 `local` 除非用户已打开蚁小二客户端。

## 8. 与 Open Design 串联

创意产出（HTML/图片/视频）→ `upload` → 按平台 DTO `publish` 到草稿箱；默认不直接公开。
