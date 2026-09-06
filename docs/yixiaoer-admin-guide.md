# 蚁小二发布集成 — 管理员说明

面向维护者与管理员：技能同步、凭据、冒烟、排障与 fork 登记。

## 1. 整合结构

| 路径 | 说明 |
|------|------|
| `skills/yixiaoer/` | 上游 OpenClaw Skill + PilotDeck 追加 `references/` |
| `scripts/sync-yixiaoer-skill.mjs` | 从 GitHub 同步（git 失败时自动 zip 回退） |
| `scripts/yixiaoer-api.mjs` | 统一调用入口（tsx + Key 校验） |
| `scripts/integration-yixiaoer-smoke.mjs` | 只读冒烟（`accounts`） |
| `config/yixiaoer-sync.manifest.json` | 同步版本/commit 记录 |
| `config/capabilities.overrides.json` | 能力中心「发布分发」L2 元数据 |

用户提问例句：`docs/yixiaoer-prompt-examples.md`

## 2. 同步上游 Skill

```bash
node scripts/sync-yixiaoer-skill.mjs --force
```

- `--force`：覆盖已有 `skills/yixiaoer/`
- `--from-dir <path>`：从本地目录导入（离线）
- 成功后检查 `config/yixiaoer-sync.manifest.json` 中 `version`（当前 pin 1.6.4）

同步后复制到运行时目录（若尚未存在）：

```bash
node scripts/bootstrap-pilotdeck-config.mjs
```

> bootstrap **不会覆盖**已存在的 `~/.pilotdeck/skills/yixiaoer`，升级后需 `--force` 同步并手动删除旧目录或整目录覆盖。

## 3. API Key

推荐在 PilotDeck **设置 → 能力接入中心 → 社媒发布（蚁小二）** 填写 API Key，保存至 `~/.pilotdeck/pilotdeck.yaml` 的 `tools.yixiaoer.apiKey`，运行时自动注入 `YIXIAOER_API_KEY`。

也可用手动环境变量（与配置二选一或并存，配置文件优先）：

- 环境变量：`YIXIAOER_API_KEY`（必填）
- 可选：`YIXIAOER_API_URL` 或 `tools.yixiaoer.apiUrl`（默认 `https://www.yixiaoer.cn/api`）
- **禁止**写入仓库、日志、`artifacts/` 报告
- 与模型池凭据**独立**：在蚁小二网页绑定社媒账号，Key 仅用于 Open API

Windows 环境变量示例（可选）：

```powershell
setx YIXIAOER_API_KEY "your-key-here"
# 重启 gateway / 终端后生效
```

## 4. 冒烟

```bash
node scripts/generate-capabilities-catalog.mjs
node scripts/integration-capabilities-smoke.mjs
YIXIAOER_API_KEY=... node scripts/integration-yixiaoer-smoke.mjs
```

报告：`artifacts/yixiaoer-smoke/report.json`

首期 smoke **禁止**自动公开发帖；真机发帖 UAT 请用**平台草稿**，人工验收。

## 5. Agent 执行约定

详见 `skills/yixiaoer/references/pilotdeck-setup.md`：

- `read_skill yixiaoer` 仅得 SKILL.md；发布前须 `read_file` 读 `docs/publish/.../index.md` 与平台页
- 默认 **草稿优先**（平台草稿或蚁小二草稿）
- **autoOrchestrate** 主 Agent 无 `bash`：发布任务委派子 Agent 或使用 `yixiaoer-api.mjs`

## 6. 云发布 vs 本机发布

- 默认 `publishChannel: cloud`（无需本地客户端）
- 本机发布需蚁小二客户端在线 + `clientId`

## 7. 排障顺序

1. `docs/troubleshooting-guide.md`（技能内）
2. `docs/execution-standard.md`
3. 检查 Key、账号 `status=1`、upload 后再 publish、contentType 签名一致

## 8. 与 Postiz 分工

| 场景 | 端 |
|------|-----|
| 国内：小红书、抖音、公众号、B 站等 | **蚁小二** |
| 海外 / 排期：LinkedIn、X 等 | **Postiz**（P0 待接） |

## 9. Fork 改动登记

| 模块 | 文件路径 | 改动类型 | 哨兵注释 | 变更摘要 | 日期 |
|------|----------|----------|----------|----------|------|
| 蚁小二 L2 | `skills/yixiaoer/`、`scripts/sync-yixiaoer-skill.mjs`、`scripts/yixiaoer-api.mjs` | 新增 | 否 | 国内社媒发布 Skill 同步与 API 包装 | 2026-06-01 |
| 能力中心 | `config/capabilities.overrides.json` | 配置 | 否 | yixiaoer → 发布分发 L2 | 2026-06-01 |
| 文档 | `docs/yixiaoer-*.md` | 文档 | 否 | 管理员/用户手册 | 2026-06-01 |

## 10. 合规说明

上游 [yixiaoer-skill](https://github.com/yixiaoer888/yixiaoer-skill) 未附带 LICENSE；见 `skills/yixiaoer/references/ATTRIBUTION.md`。SaaS 商业化前请做法务确认。
