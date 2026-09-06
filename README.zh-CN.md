# Nova Ai-Studio

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md)

<p align="center">
  <img src="assets/community/official/home-hero.png" width="920" alt="Nova Ai-Studio：用对话，交付整个项目">
</p>

**AGPL 社区版：在自己电脑上跑 Agent 工作台。** 用平常说话提需求，交出能打开的文件，而不是一屏聊完就散的文字。

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/rufeng0411/Nova-Ai-Studio)](https://github.com/rufeng0411/Nova-Ai-Studio/releases)

---

## 社区版是什么

克隆、装依赖、登录，你就有一套本机工作台：能力中心、流程模板、成果清单、多格式预览。模型 Key 自己贴，数据在仓库旁的 SQLite，不交给别人的云。

主标语还是那句人话：**用对话，交付整个项目。**

系统按 Goal-Loop 跑：听需求 → 做分析 → 定目标 → 搞生产 → 严验收。收尾对照清单，报告、PPT、网页、视频写进项目。不是「模型说做完了就算完」。

品牌叫 **Nova Ai-Studio**。和 Amazon Nova / Nova Act 不是一家。办公、调研、营销、GEO、创作、媒体、开发、教育都能做，不要把它理解成「只做投放文案的 AI」。

---

## 社区版好在哪

- **文件当交付，聊天当过程。** 同事要的是打得开的稿，不是对话框截图。
- **钥匙和数据在你机器上。** 一个 `admin`，本地 SQLite（`.saas-dev-data/`，不进 git）。没有把对话送到别人 SaaS 的默认路径。
- **开箱是工作台，不是 Prompt 玩具。** 登录就能逛 Hub；配上 Key 就能按模板开跑。
- **数字跟产品白皮书同一套口径**（引用时不要改成保证）：

| | 怎么写 | 说明 |
| --- | --- | --- |
| 能力 | **400+** | Hub 里按业务域排，不是一张扁平技能表 |
| 模板 | **35** 条 | 不知道第一句怎么说时，点模板开跑 |
| Token | 相对全程旗舰直打，**最高约 70%**；部分硬核约 **1/6** | 场景依赖，见 [claims](https://www.novapage.online/claims/) |
| 预览 | **40+** 种格式 | SuperPreview，对照清单看真文件 |
| 业务域 | **八类** | 办公、调研、营销飞轮、GEO、创作、媒体、开发、教育 |

亮点展开：[能力亮点](docs/zh-CN/capabilities.md) · [白皮书摘要](docs/zh-CN/whitepaper.md)

---

## 和别的用法怎么选

不是贬谁，是避免装错工具。完整企业向对照也可看官网 [FAQ · 选型](https://www.novapage.online/faq/#q-compare)。

| 你更常遇到的 | 它擅长 | 本仓社区版更适合 |
| --- | --- | --- |
| ChatGPT / 各类网页聊天 | 把话说顺、即问即答 | 要把一轮对话收成可打开的项目文件，并且清单能对上 |
| 套一层 Prompt 的开源壳 | 演示「能调模型」 | 要 Hub、模板、预览、验收，而不是一个输入框 |
| Dify / FastGPT | 自建工作流、知识库问答 | 要的是「听懂需求 → 写好成果 → 对照文件验收」，不是先画节点 |
| Coze（扣子）等 Bot 搭建器 | 对话 Bot、渠道分发 | 要落盘的报告 / PPT / 页面，而不是上线一个客服机器人 |
| 把 Key 交给托管聊天 | 免安装 | Key 和成果必须留在本机时 |

社区版自己的形状：单人自托管、pnpm 启动、AGPL 可审计。要团队账号或托管服务，文末有官网和合作方式。

---

## 本机安装

完整步骤只认 **[安装手册](docs/zh-CN/install.md)**。摘要：

```bash
git clone https://github.com/rufeng0411/Nova-Ai-Studio.git
cd Nova-Ai-Studio
cp .env.example .env          # Windows: Copy-Item .env.example .env
# 填写 SAAS_ADMIN_PASSWORD（不要用历史默认弱口令）
corepack enable
pnpm install
pnpm run dev
```

打开终端打印的 **Vite 地址**（占用会换端口）→ `/login` → 用户名 `admin` → 进入工作台。没有 Key 也能先逛 Hub；跑任务再在后台填模型。

健康检查：`GET /api/saas/health` 与 `GET /api/saas/health/ready`（Bridge 端口以启动器打印为准）。

不要裸 `npm install`（锁的是 pnpm）。不要把 `dev:standalone` 当这条路径。

本仓按单人使用裁过：没有注册页、没有多用户运营台、没有工作台 N2 Bot。源码里若还有控制面骨架，运行时不会当作功能承诺。

---

## 文档

- [安装](docs/zh-CN/install.md)
- [使用手册](docs/zh-CN/user-guide.md)
- [产品总览](docs/zh-CN/product.md)
- [白皮书摘要](docs/zh-CN/whitepaper.md)
- [能力亮点](docs/zh-CN/capabilities.md)
- [信任与数据](docs/zh-CN/trust.md)
- [配置](docs/zh-CN/configure.md)
- [二次开发（配置级）](docs/zh-CN/develop.md)
- [FAQ](docs/zh-CN/faq.md)

---

## 官网与合作

产品介绍、演示案例、团队 / 托管方案见官网 [novapage.online](https://www.novapage.online/)。商务或交流可走 [联系我们](https://www.novapage.online/contact/)，或加微信 **山君**：

<p align="center">
  <img src="assets/community/wechat-contact.png" width="280" alt="微信：山君">
</p>

## License

GNU Affero General Public License v3.0。见 [LICENSE](LICENSE)。通过网络提供基于本仓的服务时，需要开放对应源码。
