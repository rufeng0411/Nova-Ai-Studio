# 单机版与 SaaS 版对照

> Executive Summary (EN): Nova ships two tracks—local single-user with full file CRUD, and multi-tenant SaaS with cloud-only storage, admin console, and platform-managed models. Same conversation engine; different deployment and file semantics.

---

## 双轨战略

Nova 采用 **同一对话引擎、两种交付形态**：

- **单机版**：个人 / 开发者本地高自由度
- **SaaS 版**：企业多租户、全云端、运营可管

避免「为了 SaaS 砍单机」或「单机架构硬套多租户」。

---

## 对照表

| 维度 | 单机版 | SaaS 版 |
|------|--------|---------|
| **典型用户** | 个人开发者、本地高敏场景 | 企业团队、托管服务 |
| **启动方式** | `npm run dev` / 本地安装 | `npm run dev:saas` / 云端部署 |
| **认证** | 本地可选 | JWT 登录、注册验证码 |
| **项目文件** | 本地任意目录，完整 CRUD | 仅云端 `cloud-storage` 枢纽 |
| **新建项目** | 可选本地路径 / 向导 | **仅名称**，服务端建云枢纽 |
| **文件 Tab** | 完整编辑、上传、重命名 | 只读 + 下载（管理员可编辑） |
| **模型 / MCP** | 用户自配 | 平台统一配置，租户即用 |
| **能力 / 模板** | 读本机技能目录 + 仓库内置技能 | 平台技能库 + 租户项目隔离 |
| **后台** | 设置页（租户向） | Sketch 风 Admin：用户/订阅/用量 |
| **数据根** | 本机用户配置目录 | `DATA_ROOT/tenants/*/...` |
| **数据库** | 本地 SQLite 等 | PostgreSQL 控制面（推荐） |

---

## 文件存储故事（SaaS Phase 2）

```
用户登录
  → ensureSaasWorkspacesProvisioned（cloud-only：不扫本地、不随机 UUID）
  → 项目文件根：cloud-storage/users/{userId}/workspaces/{uuid}/
  → 对话 transcript：tenantPilotHome/projects/{legacyId}/chats/
  → 侧栏仅展示用户自建 workspaces-* 项目
```

**用户感知**：「我的项目都在云端，换电脑登录还在；不像网盘要自己同步。」

---

## 销售时如何选轨

| 客户问 | 建议 |
|--------|------|
| 「我们数据不能上公网」 | 私有部署 SaaS 或单机版 + 内网 |
| 「员工各自电脑本地试」 | 单机版试点 → 满意后迁 SaaS |
| 「要账号体系和用量账单」 | SaaS |
| 「要完整改代码、跑命令」 | 单机版 FilesV2；SaaS 文件 Tab 只读 |

---

## 技术参考

- `docs/cloud-file-storage-design.md`
- `docs/cloud-only-cutover-report-2026-06-11.md`
- `docs/saas-v2.1-completion.md`

---

## 对外一句话

**个人要自由度选单机版；团队要隔离、省心、可运营选 SaaS 版——内核是同一个 Nova 创作引擎。**
