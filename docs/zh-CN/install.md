# 安装

黄金路径只有这一条。开发启动器、`dev:standalone`、营销站、注册页都不是社区版入口。

## 你将得到什么

- 本机 Vite 地址上的工作台（启动器会打印 URL）
- 唯一管理员 `admin`（口令来自 `.env` 的 `SAAS_ADMIN_PASSWORD`）
- 控制面 SQLite（`DEV_SAAS_SQLITE=1`），数据在 `.saas-dev-data/`
- 健康检查：`GET /api/saas/health` 与 `GET /api/saas/health/ready`（Bridge，常见 **3001**，占用会 +1）

没有模型 Key 也能登录进 `/app` 和能力中心；真正跑任务再在后台配 Key。

## 前置

- Node.js **20+**（自带 corepack；本仓库用 pnpm，见 `packageManager`）
- Git
- 不必装 Docker / PostgreSQL（社区黄金路径用 SQLite）

## 推荐步骤

### 1. 取得源码

```bash
git clone https://github.com/rufeng0411/Nova-Ai-Studio.git
cd Nova-Ai-Studio
```

私有阶段：`gh repo clone rufeng0411/Nova-Ai-Studio`。

### 2. 环境文件

**PowerShell**

```powershell
Copy-Item .env.example .env
```

**bash**

```bash
cp .env.example .env
```

打开 `.env`，填写：

| 变量 | 要求 |
| --- | --- |
| `SAAS_ADMIN_PASSWORD` | 必填。文档示例 `ChangeMe_Admin1!` 仅供本机；禁止历史默认弱口令 |
| `PILOTDECK_COMMUNITY_PERSONAL` | `1` |
| `DEV_SAAS_SQLITE` | `1` |
| `PILOTDECK_MARKETING_SITE` | `0` |

未设置 `SAAS_ADMIN_PASSWORD` 时进程拒绝启动。

### 3. 安装并启动

```bash
corepack enable
pnpm install
pnpm run dev
```

在终端找到 Vite URL（常见 `http://127.0.0.1:5173`，占用会换端口）。浏览器打开后应落到 **`/login`**，不是营销站。

### 4. 登录

用户名 `admin`，口令为 `.env` 里的值。成功后进入 **`/app`**。

### 5. 配模型（可选）

打开 `/admin/platform/service/models`，填入你自己的 Key。

## 不要做

- `npm run dev:standalone`
- 把 Nova Dev Console / Launcher 当主安装路径
- 在文档或 `.env` 里写历史默认弱口令
- 期待注册页、邀请码、用户管理
- 用 uvicorn `8000` / `GET /healthz`（那是另一个产品）

## 若出现 X 则做 Y

| 现象 | 处理 |
| --- | --- |
| 启动报 `SAAS_ADMIN_PASSWORD is required` | 确认已复制 `.env` 且该行有值 |
| `health/ready` 连不上 3001 | 看启动器打印的 **server** 端口，可能是 3002 |
| `/` 仍像营销站 | 确认 `.env` 里 `PILOTDECK_MARKETING_SITE=0` 后重启 |
| 对话 402 积分不足 | 社区 overlay 应跳过配额；确认 `PILOTDECK_COMMUNITY_PERSONAL=1` |
| `pnpm --dir ui run build` 失败 | Node 20+，`corepack enable` 后删 `node_modules` 再 `pnpm install` |
