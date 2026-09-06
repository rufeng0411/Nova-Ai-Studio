# Nova 开发启动器

黑白终端风格的 **SaaS 本地全栈** 一键启动器，替代每次手敲 `npm run dev:saas`。

## 快速开始

### Windows

**推荐**：双击桌面 **`Nova Dev Console`** 快捷方式，或仓库根目录 **`NovaLauncher.vbs`**（完全无 CMD 黑窗）。

也可双击 `NovaLauncher.bat`（会极短暂闪一下 CMD 后转发到 VBS）。排查问题时：

```bat
NovaLauncher.bat --debug
```

### Linux / macOS

```bash
chmod +x tools/nova-launcher/scripts/nova-launcher.sh
./tools/nova-launcher/scripts/nova-launcher.sh
```

### 开发模式（仓库根目录）

```bash
npm run launcher              # 启动
npm run launcher:shortcut     # Windows：在桌面创建「Nova Dev Console」快捷方式（N2 logo 图标）
```

首次会自动安装 `tools/nova-launcher` 依赖（已配置国内 Electron 镜像，见 `tools/nova-launcher/.npmrc`）。

## 一键操作

| 按钮 | 作用 |
|------|------|
| **启动 / 重启** | 自检 Redis、PostgreSQL(Docker)、端口 → 全栈拉起（Gateway + Bridge + Vite）；已有进程时先关后启 |
| **关闭** | 结束 Gateway / Bridge / Vite，并关闭 PG 开发容器（Redis 本机服务保持运行） |
| **浏览器** | 打开 Vite 开发地址 |

打开启动器后会自动扫描本机是否已有 dev 服务（含其他终端跑的 `npm run dev:saas`）；若检测到会**先全部关闭**再进入空闲态，与命令行重启语义一致。点「启动 / 重启」即可一键拉起全栈，无需区分前后端。

## 面板说明

- **服务状态**：六路 LED（Gateway / Bridge / Vite / Redis / PostgreSQL / Bridge↔Gateway）
- **健康折线图**：每 2 秒采样，保留 60 点（Gateway `/health`、Bridge `/api/saas/health`、WS `hello_ok`）
- **运行信息**：解析后的端口、局域网 URL、`DATA_ROOT`、控制库类型
- **日志**：分通道过滤；配色规则见下

## 日志配色

| 颜色 | 含义 |
|------|------|
| 白色 | 常规输出 |
| 蓝色 | 启动阶段、SaaS 信息 |
| 绿色 | ready / connected / PONG |
| 浅灰 | 非致命 warn、HMR 等 |
| 红色 | **仅**进程崩溃、DB ping 失败等意外错误 |

不使用橙色/黄色作警告色。

## 常见告警

| 告警 | 处理建议 |
|------|----------|
| 端口偏移 | 使用面板显示的 URL，勿假设 3001/5173 |
| Gateway URL 须 ws:// | 检查环境变量 `PILOTDECK_GATEWAY_URL` |
| Redis 内存回退 | Windows 运行 `npm run install:redis` 或启动 Memurai |
| PG 回退 SQLite | 启动 Docker Desktop 后重试一键启动 |
| ui/dist 旧构建 | 确保 Vite 已运行，或删除 `ui/dist` |

## 验收测试

```bash
# 全量（含全栈 smoke-boot，约 3–5 分钟）
npm run test:launcher

# 快速（跳过全栈拉起）
npm run test:launcher:quick
```

在 `tools/nova-launcher` 内也可直接 `npm run test:all` / `test:quick`。

覆盖项：构建产物、preload CJS、supervisor 初始化与清场、Electron 桥接、UI 壳加载、可选全栈启动。

## 打包为 exe / AppImage

```bash
npm run launcher:dist
```

产物在 `tools/nova-launcher/release/`。

设置环境变量 `NOVA_REPO_ROOT` 指向仓库根目录（便携 exe 从任意位置启动时需要）。

## Windows 无 CMD 黑窗

- 入口 **`NovaLauncher.vbs`**（推荐）经 WScript `Run …, 0` 启动，零 CMD；`.bat` 仅作转发。
- 启动链 **`node scripts/start-hidden.mjs` → electron.exe**，不再经 `npm.cmd` / `cross-env`（二者在 Windows 上会闪 CMD）。
- 命令行主动执行 `npm run launcher` / `npm run dev:saas` 仍会使用当前终端，属预期行为。

## 冷启动续跑与僵尸会话（dev）

- dev 默认 `PILOTDECK_COLD_RESUME=1`：仅当**末 turn 无 `turn_result`**（异常中断）时，打开历史会话可能自动续跑。
- 验收/压测产生的僵尸会话，跑完后请**侧栏删除**或临时设 `PILOTDECK_COLD_RESUME=0`；删除会写入 **tombstone**，即使 jsonl 残留也无法再读/续跑。
- 连续 synthetic/repair 无成果时，`PILOTDECK_SESSION_SYNTHETIC_BUDGET=1`（dev 默认）会在预算用尽后停自动「继续」。

## 默认账号

SaaS 开发模式：`admin` / `admin123`（首装后请在公网前修改）。
