<p align="center">
  <img src="assets/banner.png" alt="Nova Ai-Studio" width="680"/>
</p>

<p align="center">
  Nova Ai-Studio 2.0 · 企业级智能体平台 — 面向营销创意与复杂任务的生产力工作台。
</p>

<p align="center">
  <a href="https://www.novapage.online"><img src="https://img.shields.io/badge/官网-www.novapage.online-6366F1?style=flat-square&logo=googlechrome&logoColor=white" alt="官方网站"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL_3.0-blue.svg?style=flat-square" alt="License"/></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-Native-6366F1?style=flat-square" alt="MCP Native"/></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <b>简体中文</b>
  <br/>
  <a href="https://www.novapage.online">官网</a> · <a href="about/README.md">产品与品牌资料</a> · <a href="#-安装与快速开始">快速开始</a>
</p>

---

## 关于 Nova Ai-Studio

Nova Ai-Studio 是面向企业与创作者的多智能体协作平台：能力中心、流程模板、Agent Harness、成果预览与 SaaS 多租户运维一体化。详细卖点与销售资料见 [`about/`](about/README.md)。

> **说明**：引擎 CLI、配置目录与环境变量仍使用 `pilotdeck` / `~/.pilotdeck` 等内部标识（与上游兼容），用户可见品牌统一为 Nova Ai-Studio。

---

## 安装与快速开始

### 方式一：本地一键安装（macOS / Linux）

需先设置交付方提供的 Git 仓库地址：

```bash
export NOVA_REPO_URL=https://your-host/your-org/nova-ai-studio.git
bash install.sh
```

安装完成后：

```bash
pilotdeck            # 启动 Web UI（默认 http://localhost:3001）
pilotdeck status     # 查看运行状态
```

### 方式二：源码开发

```bash
git clone <your-nova-repo-url>
cd nova-ai-studio

npm install
cd ui && npm install && cd ..

cd ui && npm run dev     # 开发模式 http://localhost:5173
# 或
npm run dev:saas         # SaaS 本地开发（含后台 admin/admin123）
```

模型与工具配置：`~/.pilotdeck/pilotdeck.yaml`（也可在 Web UI 设置页可视化配置）。

### 方式三：阿里云 Docker 私有化

见 `scripts/release/remote-install.sh` 与 `docs/saas-pg-phase1-runbook.md`。线上安装根目录默认 `/opt/nova-ai-studio`，数据目录 `/var/lib/nova`。

### 方式四：Docker Compose（单机）

```bash
docker compose up -d
```

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [`about/`](about/README.md) | 市场、品牌、销售权威资料 |
| [`docs/nova-brand-guard.md`](docs/nova-brand-guard.md) | Nova 品牌守卫与校验 |
| [`docs/open-design-user-agent-manual.md`](docs/open-design-user-agent-manual.md) | 非技术用户手册 |
| [`docs/open-design-admin-guide.md`](docs/open-design-admin-guide.md) | 管理员与迁移指南 |

---

## 许可证

本项目基于 [GNU Affero General Public License v3.0](LICENSE) 开源。
