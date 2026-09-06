# 使用手册

## 登录

未登录访问工作台会到 `/login`。没有「注册」、没有邀请码。账号只有 `admin`。

登录成功固定进入 `/app`。

## 工作台

`/app` 是对话与成果所在。侧栏会话、中间对话、能力与文件按界面实际布局使用。

## 能力中心

Hub 展示 **400+** 能力卡片。先读说明；有模型 Key 再点「试一下」。没有 Key 时卡片仍在，任务会失败或提示缺配置，这是预期。

## 后台（这一个 Admin）

可去：

- `/admin/platform/service/models` 模型
- `/admin/platform/mcp` MCP
- `/admin/platform/skills` 技能
- `/admin/platform/hub-visibility` 能力可见

不要找用户管理、邀请码、线索、Showcase。地址栏硬打开 `/admin/users` 会回到仪表盘，不是多用户台。

## 数据在哪

SaaS `DATA_ROOT` 默认是仓库下 `.saas-dev-data/`。技能引擎仍可能读本机 `~/.pilotdeck`（首次启动会生成占位配置）。不要把这两处提交进 git。
