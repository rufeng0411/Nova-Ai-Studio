# Nova Ai-Studio 品牌与安全审计报告

> 审计日期：2026-06-05  
> 范围：只读代码与配置探查；**本次品牌升级未改动安全逻辑**，本文档供后续加固决策参考。

---

## 一、执行摘要

| 维度 | 结论 | 严重度 |
|------|------|--------|
| 硬编码真实密钥 / 后门 | 未发现 | — |
| 远程 license 激活 | 未发现 | — |
| 品牌遥测回传 | **Nova Fork 已永久禁用**（`createTelemetryCollector` 为 no-op） | — |
| 公网默认鉴权 | 默认**关闭本地登录** + `0.0.0.0` 监听 | 高（公网暴露时） |
| OpenBMB / PilotDeck 外链 | 登录页、README、install.sh **已清理**（2026-06-11） | — |
| License 合规 | 主仓 AGPL-3.0；`package.json` 无 `license` 字段 | 中（合规缺口） |

**总体判断**：无恶意后门特征；主要风险来自**面向本地开箱的默认宽松配置**，公网部署前须主动加固。Nova Fork 已移除对 `tele.pilotdeck.cn` 的远程遥测回传。

---

## 二、品牌回传（遥测）

### 2.1 Nova Fork 处置（2026-06-11）

| 位置 | 状态 |
|------|------|
| `src/telemetry/collector.ts` | `createTelemetryCollector` 永久 no-op，不创建 `TelemetrySender`，不读取 `ANALYTICS_*` |
| `src/telemetry/sender.ts` | 保留源码但 Fork 运行时不会被实例化 |
| `src/telemetry/stabilityEvents.ts` 等 | **本地** jsonl 诊断，非 `tele.pilotdeck.cn` |

历史上游默认端点曾为 `http://tele.pilotdeck.cn`；本 Fork 已彻底关闭外联上报。

### 2.2 原发现（上游参考）

| 位置 | 内容 |
|------|------|
| `src/telemetry/collector.ts:31` | 默认端点 `http://tele.pilotdeck.cn` |
| `src/telemetry/collector.ts:139` | `ANALYTICS_ENABLED` 默认 **false** |
| `src/telemetry/sender.ts:110` | `POST {baseUrl}/collect` 批量上报 |
| `src/telemetry/context.ts:41-66` | 用 gateway token 或 `platform:arch:HOME` 生成 `installationId` / `instanceId` |
| `src/cli/pilotdeck.ts` | CLI 启动时创建 collector，shutdown 时 flush |
| `docs/telemetry/receiver-contract.md` | 契约文档，声明不上报 message/stack，剥离路径字段 |

### 2.2 上报字段（启用时）

`installationId`、`instanceId`、`deploymentMode`、`commitHash`、`appVersion`、`platform`、哈希后 `sessionId`、功能/错误分类等。

### 2.3 建议

Nova Fork：**无需额外操作**（远程遥测已禁用）。若合并上游后恢复 collector 实现，须重新执行禁用或改自有端点。

### 2.4 原建议（上游参考）

---

## 三、OpenBMB / PilotDeck 外链清单

> **2026-06-11 更新**：P1 已落地 — 登录页 GitHub 链已移除；`install.sh` / README 已换 Nova；GitHub 版本/Star 钩子已改为 no-op。

### 3.1 UI 内用户可见（已处置）

| 文件 | 状态 |
|------|------|
| `ui/src/components/auth/view/AuthScreenLayout.tsx` | 已移除 OpenBMB GitHub 外链 |
| `ui/src/hooks/useVersionCheck.ts` | 已禁用上游 Releases 检查 |
| `ui/src/hooks/useGitHubStars.ts` | 已禁用上游 Star 拉取 |

### 3.2 安装与文档（已处置）

| 文件 | 状态 |
|------|------|
| `install.sh` | 默认不再指向 OpenBMB；须设 `NOVA_REPO_URL` |
| `README.md` / `README.zh.md` | 已重写为 Nova Ai-Studio + `www.novapage.online` |
| `docs/ad-pr-creative-skills-mcp-catalog.md` | 第三方选型链接（非上游品牌，保留） |

### 3.3 社区入口

- 新 README 已移除上游社区 QR / Discord / Issue 链。
- 侧栏 i18n 仍有 `joinCommunity` 等键，**当前无 UI 绑定**。

### 3.4 内部标识（刻意保留）

- CLI / 配置目录 / `PILOTDECK_*` 环境变量名不变，避免破坏运行与上游合并基线。

---

## 四、鉴权与默认开放点（公网部署必读）

### 4.1 高风险默认配置

| 位置 | 行为 | 严重度 |
|------|------|--------|
| `ui/server/constants/config.js:15-17` | `DISABLE_LOCAL_AUTH` 默认 **true**（除非 `PILOTDECK_DISABLE_LOCAL_AUTH=0`） | 高 |
| `ui/server/middleware/auth.js:45-56` | 本地模式 REST/WS **不验 JWT** | 高 |
| `ui/server/index.js:3050` | 默认监听 `0.0.0.0` | 高 |
| `ui/server/index.js:506` | 宽松 CORS | 高（与上组合） |
| `ui/server/routes/update.js:103-106` | 可触发 `bash scripts/update.sh`（鉴权绕过时危险） | 高 |

### 4.2 中等风险

| 位置 | 行为 |
|------|------|
| `src/gateway/server/GatewayServer.ts:83-86` | `GET /auth/local-token` 本机无鉴权返回 gateway token |
| `ui/server/services/permissionSettings.js` | 无 `permissions.json` 时默认 `skipPermissions: true` |
| `ui/server/routes/agent.js` | `IS_PLATFORM=true` 时信任外部代理、无 API key |
| `ui/server/middleware/auth.js:22-40` | `/memory-dashboard` 可从 Referer 取 JWT |

### 4.3 公网部署加固清单（建议，本次未改代码）

```bash
# 1. 强制登录
export PILOTDECK_DISABLE_LOCAL_AUTH=0

# 2. 仅本机或经反向代理暴露
export HOST=127.0.0.1

# 3. 可选第二道门
export API_KEY=your-strong-random-key

# 4. 保持遥测关闭
# 不设置 ANALYTICS_ENABLED，或 export ANALYTICS_ENABLED=false
```

首次部署后完成注册向导，修改默认密码；勿将实例直接暴露到公网/LAN 而不改上述项。

---

## 五、凭据 / 后门核查

### 5.1 硬编码密钥

- **未发现**真实 `sk-`、`AKIA`、私钥或明文生产密码。
- `AGENTS.md` 规划 SaaS seed `admin / admin123`：**代码未实现**（`src/saas/` 不存在）。
- `ui/server/index.js` 本地模式用户 `local` 密码为 `crypto.randomBytes(32)` 哈希，非固定弱口令。

### 5.2 动态执行 / 后门路由

- `src/` 内**未发现** `eval(`、`new Function(`。
- 无隐藏 debug 路由、无 magic header 全局绕过鉴权、无硬编码公网 IP 后门。

### 5.3 运行时外联（正常功能，非品牌回传）

| 类型 | 示例 |
|------|------|
| 模型供应商 | OpenAI、通义、火山等（用户自配 apiKey） |
| 搜索 | Tavily、Bocha、GLM 等 |
| GitHub API | 版本检查 / star（未接入 UI） |
| 蚁小二 | `https://www.yixiaoer.cn/api` 默认端点 |

### 5.4 未实现的安全规划

- `AGENTS.md`：开放注册须 Redis 图形验证码 — **代码未实现**。
- SaaS 多租户 / 订阅 — **规划中**。

---

## 六、License 与版权合规

### 6.1 主工程

| 项 | 状态 |
|----|------|
| 根目录 `LICENSE` | GNU **AGPL v3** 全文 |
| `package.json`（根 / `ui/`） | **无** `license` 字段 |
| 源文件统一 HEADER | **无** OpenBMB / Nova 版权声明 |
| `LICENSE` 末尾 | 仍为 FSF 模板占位，无项目方 copyright 行 |

**AGPL 提示**：作为网络服务（SaaS）对外提供修改版，须向用户提供对应源代码。详见 `docs/saas-feasibility-report.md`。

### 6.2 Vendor / Skills

| 路径 | 许可 |
|------|------|
| `skills/vendor/pm-skills` 等 | MIT / Apache-2.0 |
| `skills/vendor/anthropics-skills/anth-docx` | **Anthropic 专有条款**（非 OSI 开源） |
| `skills/yixiaoer` | **无 LICENSE 文件**（须遵循蚁小二服务条款） |
| `skills/open-design` | Apache-2.0（见 ATTRIBUTION.md） |

### 6.3 不一致项

- `src/tool/builtin/web/urlFetcher.ts:28`：User-Agent 指向 `github.com/pilotdeck`，与上游 `OpenBMB/PilotDeck` 命名不一致（非安全风险，品牌遗留）。

### 6.4 合规建议（仅建议，未实施）

1. 根 `package.json` 增加 `"license": "AGPL-3.0-or-later"`。
2. 新增 `THIRD_PARTY_NOTICES.md` 汇总 vendor 许可。
3. 在 `LICENSE` 或 `NOTICE` 中补充 Nova Ai-Studio 版权行，并保留 AGPL 条款说明。
4. 对外 SaaS 前咨询法务：AGPL 网络条款与商业授权路径。

---

## 七、本次品牌升级未改动项（保证兼容）

以下标识符**故意保留**，确保会话、配置、CLI 与上游技能路径不受影响：

- Provider slug：`pilotdeck`
- 数据目录：`~/.pilotdeck/`、`.pilotdeck/`
- CLI 命令：`pilotdeck`
- 环境变量：`PILOTDECK_*`
- 深链协议：`pilotdeck://open/...`
- 事件名 / localStorage 键：`pilotdeck:*`
- 用量限制匹配正则：`PilotDeck usage limit reached|…`（上游固定格式）
- 鉴权、遥测、GitHub 外链 URL（仅审计，未改代码）

---

## 八、后续行动优先级

| 优先级 | 行动 | 负责 |
|--------|------|------|
| P0 | 公网部署前执行第四节加固清单 | 运维 |
| P1 | ~~决定是否替换登录页 GitHub / README 上游链接~~ **已完成（2026-06-11）** | 产品 |
| P1 | ~~确认 `ANALYTICS_ENABLED`~~ **Fork 已永久禁用远程遥测** | 运维 |
| P2 | 补齐 `package.json` license 与 THIRD_PARTY_NOTICES | 法务/工程 |
| P2 | ~~评估移除 `tele.pilotdeck.cn` 遥测~~ **已完成（collector no-op）** | 工程 |
| P3 | SaaS 落地前实现 Redis 验证码与强密码 seed | 工程 |

---

*本报告由 Nova Ai-Studio 品牌升级任务生成，随代码库版本迭代请重新审计。*
