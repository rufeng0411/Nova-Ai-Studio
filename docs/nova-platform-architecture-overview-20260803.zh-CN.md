# Nova Ai-Studio 中台与底层架构说明

> 版本：2026-08-03 · 面向产品/运营/二开的认知地图  
> 目标：把「对话 + 能力中心 + 全案模板」背后的中台与底层一次讲清楚。  
> 配套可视化：[`artifacts/nova-architecture/nova-platform-architecture-20260803.html`](../artifacts/nova-architecture/nova-platform-architecture-20260803.html)

---

## 1. 一句话总览

用户在浏览器里聊、点能力卡、点全案模板；真正「会干活」的是 **Gateway 里的 Agent**。  
中间有一层 **Bridge（中台适配）** 负责登录、项目、文件、能力目录、会话列表；底层是 **Skills / MCP / 模型 API / 数据库 / 记忆 / 文件盘**。

可以把系统想成三层：

| 层 | 人话 | 主要组件 |
|----|------|----------|
| **前台** | 你看得见、点得着的界面 | React UI（对话 / 发现·能力 / 全案模板 / 设置 / 预览） |
| **中台** | 把请求接住、鉴权、查目录、管租户 | Bridge（`ui/server`）+ 控制库 + Redis + 会话目录 |
| **底层引擎** | 真正调模型、调工具、写成果 | Gateway + AgentLoop + Skills/MCP + 模型池 + 租户文件盘 |

---

## 2. 进程拓扑（开发与生产同构）

开发默认 SaaS（`npm run launcher` / `npm run dev`）起 **三个进程**：

```
浏览器
  │  HTTP / WebSocket
  ▼
Vite UI（界面，常见 8081）
  │  API / WS 代理到 Bridge
  ▼
Bridge（中台，常见 7990）──本地处理：登录、项目、文件、能力 API、成果校验
  │  WebSocket（PILOTDECK_GATEWAY_URL = ws://…/ws）
  ▼
Gateway（引擎，常见 18789）──AgentLoop：模型 + 工具 + Skills/MCP + 写 JSONL
```

| 进程 | 入口 | 干什么 | 不干什么 |
|------|------|--------|----------|
| **Vite UI** | `ui/` React | 渲染对话、Hub、预览 | 不直接调大模型 |
| **Bridge** | `ui/server/index.js` | 鉴权、租户、文件、能力目录、消息历史读盘、转发 turn | 不跑 Agent 主循环 |
| **Gateway** | `src/cli/pilotdeck.ts` → `GatewayServer` | 唯一 Agent 运行时 | 不做 SaaS 登录页 |

要点：

- Bridge **不内嵌** Gateway，只通过 WS 连它（`ui/server/pilotdeck-bridge.js`）。
- 对话 turn 的权威执行在 Gateway；成果文件写在租户工作区 `artifacts/`。
- 生产：Nginx → 容器内 Bridge + Gateway；静态 UI 由 Nginx/`ui/dist` 提供。

---

## 3. 三条用户主路径如何落到引擎

### 3.1 普通对话

1. 用户在 Composer 发送  
2. Bridge 鉴权 +（可选）Turn Queue 入队  
3. Bridge `submit_turn` → Gateway WS  
4. Gateway：`AgentLoop` 组 prompt（含系统策略、记忆、绑定）→ 调模型 → 可能调工具 → 写 JSONL  
5. 流式帧经 Bridge 推回 UI（思考过程 / 工具步 / 正文 / 成果条）

### 3.2 能力中心「试一下」

1. Hub 卡片点「试一下」→ 事件 `pilotdeck:capability-prompt`  
2. Composer 预填 **try-prompt**（例句）  
3. 用户发送后，Gateway 注入 `<capability-binding>`（`src/saas/capabilityBindingPrompt.ts`）  
4. **脑爆 Tab**：默认「快速回复、零工具」；其它 Tab：通常先 `read_skill` 再按技能执行  
5. 若是交付类：SDM（会话成果清单）锁槽位 → `write_file` 到 `artifacts/task-*`

### 3.3 全案模板「试一下」

1. 源数据：`config/process-templates.json`（`npm run templates:gen` → UI bundle）  
2. 卡片预填多步 prompt（含标准成果清单）  
3. Gateway 侧可再注入 `processTemplateExecutionPrompt`（按模板类型约束阶段写盘）  
4. 与 SDM / 成果四线同一套验收逻辑

---

## 4. 能力中心（发现 + Composer「能力」）

### 4.1 生成管线（改技能后必跑）

```
skills/**/SKILL.md
  → npm run capabilities:gen
     ├─ generate-capabilities-catalog.mjs   → config/capabilities.catalog.json
     ├─ generate-capability-try-prompts.mjs → try-prompt / capabilityTryPrompts
     └─ generate-capabilities-i18n.mjs      → 中英文展示名与例句
```

分类权威：`scripts/lib/capabilityHubTaxonomy.mjs`  
前台可见性：`config/hub-visibility.json` + 后台「Hub 可见性」页  

### 4.2 十个一级 Tab（用户称呼）

| 内部 id | 用户看见 | 典型内容 |
|---------|----------|----------|
| marketing | 营销飞轮 | 调研→策划→创意→触达→发布→监测 |
| media | 媒体 | 户外 / 数字投放相关能力 |
| geo | GEO·AI搜索 | 可见度、可引用内容、监测 |
| finance | 金融 | 估值、模型、投研等 |
| enterprise_compliance | **企业** | 合规清单类 `comp-*`（内部 id 仍叫 enterprise_compliance） |
| office | 办公 | 文档、会议、导出 |
| creation | 创作 | 设计、视频、文案 |
| development | 开发 | 默认后台隐藏 |
| brainstorming | 脑爆 | 名人思维 / 方法论 / **企业咨询**；默认后台隐藏 |
| education | 教育学习 | 学段能力 |

**双入口同一套组件**：主菜单「发现」与输入框「能力」弹层都用 `TemplatesHubPanel`（三 Tab：能力中心 / 全案模板 / 我的收藏）。

### 4.3 聊天优先 vs 执行型

| 类型 | 条件 | 行为 |
|------|------|------|
| **Chat-first** | `major_category = brainstorming` | 快速口语；默认禁止工具；可短思考 |
| **企业咨询** | `consult-*` | 同上 + 免责；正式清单引导「企业」Tab |
| **Execute** | 其它 Tab 或用户明确要落盘 | binding 要求 `read_skill` / `write_file` 链 |

---

## 5. 全案模板（原「流程模板」）

| 项 | 说明 |
|----|------|
| 源文件 | `config/process-templates.json` |
| 生成 | `npm run templates:gen` → `ui/src/generated/process-templates.json` |
| L2 导航 | **类别**：营销 / 企业 / GEO / 办公 / 创作（**没有**脑爆、教育） |
| 徽章 | `complexity`：轻量 / 标准 / 全案（只展示，不当导航） |
| 与能力卡分工 | 全案 = **多步落盘**；脑爆企业咨询 = **口语答疑** |

---

## 6. Skills：可见、隐形、Vendor

```
skills/
  ├─ 顶层 bundled（open-design、pd-geo、content-flywheel…）  → Hub 常可见
  ├─ vendor/（seo-geo、cn-compliance、hyperframes、hermes-edu…）
  └─ （虚拟能力）catalog 里 source=virtual: / mcp: / builtin:  → 无真实 SKILL.md
```

| 概念 | 人话 |
|------|------|
| **Hub 可见卡** | 用户点得到的技能/包 |
| **隐形 / 原子 skill** | 如 `zh-contract-review`、`tax-*`：可被 `read_skill` 调用，不一定单独成卡 |
| **Hub 包装卡** | 如 `comp-*`：前台一张卡，背后绑定若干原子 |
| **Overlay** | vendor 升级后用 `skillVendorOverlays` 保住 Nova 本地补丁 |
| **调用方式** | 交付类任务用工具 `read_skill`；禁止用 `read_file skills/` 偷读 |

Agent 工作区成果：`artifacts/task-{日期}-{id}/`（STDA），不是仓库根目录乱写。

---

## 7. MCP（外部工具协议）

| 环节 | 位置 |
|------|------|
| 用户配置 | `~/.pilotdeck/pilotdeck.yaml` + 设置页「能力接入」 |
| Bridge 管理 API | `ui/server/routes/mcp.js` |
| Gateway 运行时 | `src/mcp/runtime/McpRuntime.ts`（每会话连接） |
| 工具名 | `mcp__<服务器id>__<工具名>` 进入 ToolRuntime |

- Hub 可挂 **虚拟 MCP 卡**（如 Playwright、政策检索），真正是否可用取决于后台是否配好 MCP/Key。  
- MCP 失败时：交付类任务走恢复策略；脑爆默认不应依赖 MCP。

---

## 8. 大模型与能力 API（模型池）

配置权威：`~/.pilotdeck/pilotdeck.yaml`（Bridge 读写，Gateway 运行时读 env/配置）。

| 能力面 | 配置键（示意） | 用途 |
|--------|----------------|------|
| 对话主模型 | 智能体 / 路由模板 | AgentLoop 主推理 |
| 备用与路由 | RouterRuntime、fallback 链 | 失败换模型 |
| 联网搜索 | `tools.webSearch`（如博查） | `web_search` |
| 生图 | `tools.image` | `generate_image` |
| 生视频 | `tools.video` | `generate_video` |
| 文档 OCR/导出 | `tools.documentOcr` 等 | MinerU / export_document |
| 技能服务 Key | `tools.skillServices` | 第三方 skill 凭据 |

补充清单：`ui/server/data/listModelsSupplements.js`（通义 / 火山 / Google 等远程列表不全时补齐）。  
用量统计：`~/.pilotdeck/router/stats.jsonl` + SaaS 归因到用户。

---

## 9. 数据与存储（四条轨）

不要把「对话、文件、账号、缓存」混成一个库：

```
① 控制面（账号/租户/会话索引）
   SQLite: {DATA_ROOT}/control.db
   或 PostgreSQL: SAAS_DATABASE_URL
   → users / tenants / conversation_catalog / preferences

② 对话正文（权威）
   {DATA_ROOT}/tenants/{tenant}/projects/.../chats/*.jsonl
   → 每条消息、工具结果、验收 meta

③ 用户成果文件（SaaS）
   .../cloud-storage/users/{userId}/workspaces/{uuid}/artifacts/...
   → 唯一文件枢纽；侧栏项目名是 displayName

④ 平台本地配置（跨租户）
   ~/.pilotdeck/pilotdeck.yaml + skills/MCP 配置
   → Legacy：SaaS 用户数据在 DATA_ROOT，技能池仍常读 ~/.pilotdeck

⑤ 缓存（可选）
   Redis（REDIS_URL）→ 能力 Hub / 项目列表等 TTL 缓存
```

开发默认 `DATA_ROOT = 仓库/.saas-dev-data`。  
生产常见：`DATA_ROOT=/var/lib/nova`（宿主机）映射容器 `/data/saas`。

**单机版差异**：无多租户 JWT 时，项目仍可落在 `~/.pilotdeck/projects`；文件 Tab 完整 CRUD。SaaS 禁止本机 browse-filesystem，只下云端工作区。

---

## 10. 知识库 / 项目记忆

| 组件 | 作用 |
|------|------|
| EdgeClaw memory 核心 | `src/context/memory/edgeclaw-memory-core/` |
| Bridge API | `ui/server/routes/memory.js`、`memoryService.js` |
| 回合注入 | `memory_retrieve`（DefaultContextRuntime） |
| 用户开关 | 设置「项目连续记忆」（默认开） |
| Dream 调度 | 后台整理记忆；开发默认 `PILOTDECK_SKIP_MEMORY_DREAM=1` 跳过 |

人话：同项目历史可被召回，但须锚定**当前会话目标**，避免「继续」串到别的任务记忆。

---

## 11. 中台横切能力（支撑三条主路径）

| 能力 | 人话 | 关键位置 |
|------|------|----------|
| **SDM 成果清单** | 任务一开始就锁定要交哪些文件 | `sessionDeliverableManifest` / Dock / sticky 清单 |
| **Turn Queue** | 同账号并行对话排队（侧栏「排队中」） | `PILOTDECK_TURN_QUEUE` |
| **Recovery** | 工具/网络抖动自动续跑，不吓用户 | `src/saas/resilience/` |
| **成果四线** | 正文 / footer / 文件夹 / 导出 HTML 同源 | certificate + `buildUnifiedDeliverableView` |
| **Feature flags** | 分钟级回滚 | pack.mjs + apply-cloud-perf-env + Bridge `runtimeFeatureFlags` |
| **平台功能** | Preflight / Bento 编辑等 | `config/platform-features.json` |

---

## 12. 目录地图（二开时往哪放）

| 目录 | 放什么 |
|------|--------|
| `ui/src/` | 前台 React |
| `ui/server/`、`ui/server/saas/` | Bridge / 租户 / DB / 文件 API |
| `src/` | 上游引擎（改动须 PD-SAAS-FORK + fork manifest） |
| `src/saas/` | Nova 业务：binding、SDM、媒体、导出、韧性 |
| `skills/`、`skills/vendor/` | 技能本体 |
| `config/` | catalog、模板、可见性、平台开关 |
| `scripts/` | gen / smoke / pack / 验收 |
| `docs/` | 规格与说明（本文） |

---

## 13. 关键环境变量（认知用，非完整清单）

| 变量 | 含义 |
|------|------|
| `PILOTDECK_SAAS_MODE=1` | SaaS 鉴权与租户模式 |
| `DATA_ROOT` | 租户与控制库根 |
| `SAAS_DATABASE_URL` | 有则用 PG，无则 SQLite |
| `REDIS_URL` | 缓存 |
| `PILOTDECK_GATEWAY_URL` | Bridge→Gateway，须 `ws://…/ws` |
| `PILOTDECK_SESSION_DELIVERABLE_MANIFEST` | SDM 开关 |
| `PILOTDECK_TURN_QUEUE` | 并行 turn 排队 |
| `VITE_*` | 前端构建时注入（生产靠 pack） |

---

## 14. 日常命令

| 命令 | 用途 |
|------|------|
| `npm run launcher` | 一键起开发栈（推荐） |
| `npm run capabilities:gen` | 技能/分类/例句变更后必跑 |
| `npm run templates:gen` | 全案模板变更后必跑 |
| `npm run smoke:capability-hub` | Hub 分类与可见性门禁 |
| `npm run smoke:templates` | 全案模板冒烟 |

---

## 15. 认知检查清单

读完本文，你应能回答：

1. 用户点「试一下」后，谁预填句子、谁注入 binding、谁真正执行？  
2. 脑爆顾问为什么几乎不调工具，而「企业」Tab 的合规卡会写 md？  
3. 对话内容在哪（jsonl），账号在哪（control/PG），PPT/报告文件在哪（cloud-storage artifacts）？  
4. Skills 和 MCP 差在哪：一个是方法论说明书 + 工具链约定，一个是外部进程工具协议。  
5. 改一张 Hub 卡要动哪些文件：SKILL.md → capabilities:gen →（可选）hub-visibility。

更细的规格可继续下钻：`docs/session-deliverable-manifest-spec.zh-CN.md`、`docs/conversation-resilience-spec.md`、`docs/cloud-file-storage-design.md`。
