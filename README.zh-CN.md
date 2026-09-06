# Nova Ai-Studio

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md)

**本机跑起来的对话式 Agent 工作台：登录后进 `/app`，用能力中心把一件事做完。**

社区版是**个人 SaaS**：只有一个管理员账号，没有营销站、没有注册、没有邀请码。底座仍是商用同款 SaaS 内核（成果清单、Hub、Skills），方便以后跟 `F:\Ai-pilotdeck` 同步。

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/rufeng0411/Nova-Ai-Studio)](https://github.com/rufeng0411/Nova-Ai-Studio/releases)
[![Docs](https://img.shields.io/badge/docs-GitHub_Pages-2ea44f)](https://rufeng0411.github.io/Nova-Ai-Studio/)

**[安装](docs/zh-CN/install.md)** · **[使用手册](docs/zh-CN/user-guide.md)** · **[能力亮点](docs/zh-CN/capabilities.md)** · **[配置](docs/zh-CN/configure.md)** · **[交流合作](#交流合作)**

```bash
git clone https://github.com/rufeng0411/Nova-Ai-Studio.git
cd Nova-Ai-Studio
cp .env.example .env          # Windows: Copy-Item .env.example .env
# 填写 SAAS_ADMIN_PASSWORD（不要用历史默认弱口令）
npm install
npm run dev
```

打开启动器打印的 **Vite URL**，进入 `/login`，用 `admin` + `.env` 口令登录，落到 **`/app`**。

健康检查（Bridge，常见 3001，占用会 +1）：`GET /api/saas/health` 与 `GET /api/saas/health/ready`。

不要用 `dev:standalone`，也不要把开发启动器当黄金路径。

---

## 产品介绍

### 是什么

**Nova Ai-Studio** 是可自托管的 Agent 工作台。你在对话里下任务，系统按目标循环调用技能与工具，把过程落到可打开的成果，而不是一段聊完就散的记录。

社区版面向**一个人在自己的机器上用**：一个 `admin`、本地 SQLite 控制面、数据在仓库旁的 `.saas-dev-data`（不进 git）。

### 能干什么

- **登录进工作台：** 浏览器打开 Vite 地址 → `/login` → `/app`。
- **能力中心（Hub）：** 浏览 **400+** 能力卡片（口径如此，不展示精确目录数），点开说明，有 Key 时可「试一下」。
- **配模型：** 后台 `/admin/platform/service/models` 填写你自己的模型 Key。
- **管技能与 MCP：** 后台保留平台设置、技能、MCP，给这一个 Admin 用。

### 有什么优势

| | 只聊天的 Agent 壳 | 本仓库社区版 |
| --- | --- | --- |
| 入口 | 免登录或一堆注册页 | **仅登录页**，一个 Admin |
| 成果 | 容易停在对话气泡 | SaaS 成果清单 / Hub 与商用同源 |
| 技能 | 几条演示 prompt | 仓库内 `skills/`（含 vendor） |
| 计费墙 | 试用积分用完 402 | 社区模式对话配额放行 |
| 以后升级 | 两套代码分叉 | 再跑 organize + overlay 即可跟商用同步 |

相对「再做一个免登录玩具」，这里选择**留下能跑成果的内核**，只把多租户运营面关掉。

---

## 明确没有的

营销站首页、注册 Tab、邀请码、用户列表、用户组、线索、Showcase CMS、钱包积分 UI。源码里仍保留控制面骨架，运行时 403 / 无导航。

---

## 文档

- [安装](docs/zh-CN/install.md)
- [使用手册](docs/zh-CN/user-guide.md)
- [配置](docs/zh-CN/configure.md)
- [能力亮点](docs/zh-CN/capabilities.md)
- [二次开发（配置级）](docs/zh-CN/develop.md)
- [FAQ](docs/zh-CN/faq.md)

## 交流合作

需要部署协助、二次开发或商务合作，可加微信 **山君**：

<p align="center">
  <img src="assets/community/wechat-contact.png" width="280" alt="微信：山君">
</p>

## License

GNU Affero General Public License v3.0. 见 [LICENSE](LICENSE)。
