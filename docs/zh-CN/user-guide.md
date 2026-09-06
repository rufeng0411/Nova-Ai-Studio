# 使用手册

产品长什么样、飞轮和 Hub 怎么用，官网白皮书第 3–5、7 章和 [关键界面](https://www.novapage.online/) 更完整。下面只写**本仓社区版**登录之后你会碰到的界面。

## 登录

未登录会到 `/login`。没有「注册」、没有邀请码。账号只有 `admin`，口令来自 `.env` 的 `SAAS_ADMIN_PASSWORD`。

登录成功进入工作台（地址可能是 `/app` 或 `/p/general`，都是工作台）。

官网 SaaS 的登录/邀请码流程与本仓无关：那是 [novapage.online/login](https://www.novapage.online/login)。

## 工作台

侧栏：项目 / 通用、会话列表、**新建对话**。社区版**没有** N2 Bot 芯片；直开 `/tools/n2-bot` 会回到工作台。

中间：对话。输入框可以附加文件、引用文件、打开能力。

能力中心：按场景浏览 **400+** 卡片（对外口径）。点卡片看说明；有模型 Key 再「试一下」（会预填提示词并开对话）。没有 Key 时卡片仍在，任务会失败或提示缺配置，这是预期。

流程模板：不知道怎么开始时用模板。官网白皮书写 35 条。

对话里的成果：以清单和预览为准（Markdown、Office、网页、音视频等）。这是官网 SuperPreview 叙事在本机工作台上的对应物。

## 后台（这一个 Admin）

- `/admin/platform/service/models` 模型 Key
- `/admin/platform/mcp` MCP
- `/admin/platform/skills` 技能
- `/admin/platform/hub-visibility` 能力可见

不要找用户管理、邀请码、线索、Showcase CMS。地址栏硬打开 `/admin/users` 会回到仪表盘。

## 数据在哪

SaaS `DATA_ROOT` 默认是仓库下 `.saas-dev-data/`。技能引擎仍可能读本机 `~/.pilotdeck`。不要把这两处提交进 git。

## 还想看完整产品

- 白皮书：[novapage.online/docs](https://www.novapage.online/docs/)
- 演示案例：[novapage.online/showcase](https://www.novapage.online/showcase/)
- 社区摘要：[whitepaper.md](whitepaper.md)
