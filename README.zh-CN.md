# Nova Ai-Studio

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md)

<p align="center">
  <a href="https://www.novapage.online/"><img src="assets/community/official/home-hero.png" width="920" alt="Nova Ai-Studio 官网：用对话，交付整个项目"></a>
</p>

**产品主站（请先看这里）：[https://www.novapage.online/](https://www.novapage.online/)**

Nova Ai-Studio 2.0 是企业级 AI Agent 平台：听懂需求、编排工具、写好成果、Goal-Loop 严验收。SaaS 即用，亦可完全私有化。完整产品白皮书、演示案例、Token 口径与 FAQ 都以官网为准。

| | 链接 |
| --- | --- |
| 官网首页 | [novapage.online](https://www.novapage.online/) |
| 产品白皮书 | [novapage.online/docs](https://www.novapage.online/docs/) |
| 白皮书（EN） | [novapage.online/en/docs](https://www.novapage.online/en/docs/) |
| 演示案例 | [novapage.online/showcase](https://www.novapage.online/showcase/) |
| 常见问题 | [novapage.online/faq](https://www.novapage.online/faq/) |
| Token 节省方法论 | [novapage.online/claims](https://www.novapage.online/claims/) |
| 联系 / 合作 | [novapage.online/contact](https://www.novapage.online/contact/) |
| 机器可读摘要 | [novapage.online/llms.txt](https://www.novapage.online/llms.txt) |

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/rufeng0411/Nova-Ai-Studio)](https://github.com/rufeng0411/Nova-Ai-Studio/releases)

---

## 这个 GitHub 仓库是什么

本仓是同一产品内核的 **AGPL-3.0 社区版**：给你在自己的电脑上跑工作台。

社区版是**个人 SaaS**：一个 `admin`、本地 SQLite 控制面、登录后进工作台。没有官网那种营销首页、没有注册、没有邀请码、没有多租户运营台，也没有工作台 **N2 Bot** 入口。

团队协作、浏览器免安装的 SaaS、Docker 私有化、企业安全与商务，走官网：[novapage.online](https://www.novapage.online/)。

品牌主称 **Nova Ai-Studio**。与 Amazon Nova / Nova Act 无关。不要把产品窄化成「只做营销的 AI」。

---

## 产品能干什么（与官网同一套说法）

官网主标语：**用对话，交付整个项目。**

你用平常说话提需求。系统按 Goal-Loop 跑：听需求 → 做分析 → 定目标 → 搞生产 → 严验收。收尾对照成果清单，交出报告、PPT、网页、视频等文件，而不是一屏聊完就散的文字。

对外数字以官网白皮书为准（不要把内部目录精确数当卖点）：

| 口径 | 写法 | 出处 |
| --- | --- | --- |
| 能力规模 | **400+** | 官网 / [白皮书](https://www.novapage.online/docs/) |
| 流程模板 | **35** 条 | 官网白皮书第 2 章 |
| Token | 典型多步骤任务中，相对全程旗舰直打，**最高约 70%**；部分硬核编排约 **1/6** | 场景依赖，见 [claims](https://www.novapage.online/claims/) |
| 预览 | **40+** 种格式（SuperPreview） | 官网白皮书 |
| 业务域 | **八大**分类 | 官网：办公、调研、营销飞轮、GEO、创作、媒体、开发、教育 |

八个产品亮点（官网首页原文结构）：Agent Harness、一句话交付项目、营销飞轮六阶段、调研获客、400+ 能力、模型一池、流程模板、SuperPreview 验收。展开见 [能力亮点](docs/zh-CN/capabilities.md) 与 [开源版白皮书摘要](docs/zh-CN/whitepaper.md)。

---

## 官网 SaaS / 企业  vs  本仓社区版

| | [官网](https://www.novapage.online/) | 本仓库社区版 |
| --- | --- | --- |
| 给谁 | 企业与团队；SaaS 即用或私有化 | 一个人在自己机器上自托管 |
| 怎么进 | 浏览器打开官网，登录（注册需邀请码） | `pnpm run dev` → `/login` → `admin` |
| 账号 | 多用户、租户隔离 | 仅 `admin` |
| 数据 | 云端或客户私有化边界 | 仓库旁 `.saas-dev-data/`（不进 git） |
| 模型 Key | 平台可统一配置 | 你在后台自己填 |
| 完整白皮书 / 案例 | 官网 docs、showcase | 本仓只放开源摘要 + 安装手册 |
| N2 Bot | 以官网/企业配置为准 | 社区版关闭 |

---

## 本机安装（社区版黄金路径）

完整步骤只认仓内 **[安装](docs/zh-CN/install.md)**。摘要：

```bash
git clone https://github.com/rufeng0411/Nova-Ai-Studio.git
cd Nova-Ai-Studio
cp .env.example .env          # Windows: Copy-Item .env.example .env
# 填写 SAAS_ADMIN_PASSWORD（不要用历史默认弱口令）
corepack enable
pnpm install
pnpm run dev
```

打开启动器打印的 **Vite URL** → `/login` → `admin` + `.env` 口令 → 工作台。

健康检查（Bridge，常见 3001，占用会 +1）：`GET /api/saas/health` 与 `GET /api/saas/health/ready`。

不要用 `dev:standalone`。不要把开发启动器当黄金路径。不要用裸 `npm install`（本仓库锁的是 pnpm）。

---

## 社区版明确没有的

营销站首页、注册、邀请码、用户列表、用户组、线索、Showcase CMS、钱包积分 UI、工作台 **N2 Bot**。源码里可能仍有控制面骨架，运行时 403 / 无导航。

没有模型 Key 也能登录看 Hub；真要跑任务再在 `/admin/platform/service/models` 填你自己的 Key。

---

## 文档

- [安装](docs/zh-CN/install.md)
- [使用手册](docs/zh-CN/user-guide.md)
- [产品总览](docs/zh-CN/product.md)
- [开源版白皮书摘要](docs/zh-CN/whitepaper.md)（全文以 [官网白皮书](https://www.novapage.online/docs/) 为准）
- [能力亮点](docs/zh-CN/capabilities.md)
- [信任与数据](docs/zh-CN/trust.md)
- [配置](docs/zh-CN/configure.md)
- [二次开发（配置级）](docs/zh-CN/develop.md)
- [FAQ](docs/zh-CN/faq.md)

## 交流合作

企业试用、私有化、商务：官网 [联系我们](https://www.novapage.online/contact/)。

也可以加微信 **山君**：

<p align="center">
  <img src="assets/community/wechat-contact.png" width="280" alt="微信：山君">
</p>

## License

GNU Affero General Public License v3.0. 见 [LICENSE](LICENSE)。通过网络提供基于本仓的服务时，需要开放对应源码。
