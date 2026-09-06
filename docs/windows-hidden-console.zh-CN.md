# Windows 隐藏 CMD 弹窗 — 深度分析与治理

## 现象

在 Nova 启动器 / SaaS 全栈 / 对话 Agent 工具链运行时，Windows 仍会间歇弹出黑色 **CMD** 窗口，即使用户已要求全部后台隐藏。

## 根因（分层）

| 层级 | 原因 | 典型触发 |
|------|------|----------|
| **L1 shell 模式** | `child_process.spawn(..., { shell: true })` 会拉起 `cmd.exe` 作为宿主；`windowsHide` 在部分 Node/Windows 组合下仍闪窗 | Agent `bash` 工具、TaskMaster、Hooks |
| **L2 detached** | `detached: true` 在 Windows 上可能分配新控制台 | 后台 bash 任务、旧版 commandRunner |
| **L3 npm 链** | `npm.cmd` / `npx.cmd` 本质是批处理，经 cmd 解析 | 插件 build、旧 `npm run start` |
| **L4 同步阻塞** | `spawnSync(powershell…)` 不闪窗但会卡 UI；与弹窗无关 | 杀端口、PG 检测 |
| **L5 入口未 patch** | 子进程若未 `import patchHiddenConsole` 则不受全局保护 | 独立脚本、vendor skills |
| **L6 named import** | ESM `import { spawn } from 'node:child_process'` 绑定原始函数，不走 patch | 几乎所有直接 import 的业务模块 |
| **L7 快捷方式宿主** | 快捷方式指向 `wscript.exe` 时系统可能显示灰色/宿主图标；已改为 `NovaDevConsole.exe` | 桌面启动 |

## 治理策略（已落地）

### 1. 全局补丁 `scripts/lib/patchHiddenConsole.mjs`

在以下入口**最先**加载：

- Gateway：`src/cli/pilotdeck.ts`
- Bridge：`ui/server/index.js`
- 启动器 Electron main：`tools/nova-launcher/src/main/index.ts`
- 开发脚本：`scripts/dev-saas.mjs`、`scripts/dev-launcher.mjs`
- Agent 工具侧：`src/util/withHiddenConsole.ts`

补丁行为（仅 `win32`）：

1. 所有 `spawn/spawnSync/exec/execFile/fork` 强制 `windowsHide: true`
2. **`shell: true` → `cmd.exe /d /s /c …` + `shell: false`**（隐藏宿主）
3. **`npm.cmd` / `npx.cmd` → `node npm-cli.js`**（绕过 cmd 批处理）
4. 可选审计：设 `NOVA_LOG_HIDDEN_SPAWNS=1`，日志写入 `%LOCALAPPDATA%\NovaAiStudio\hidden-spawn.log`

### 3. 显式修复高频路径

- `src/tool/builtin/bash/commandRunner.ts` — `resolveHiddenShellSpawn`，Windows 禁用 `detached`
- `src/task/runtime/BackgroundTaskRuntime.ts` — 同上
- `src/extension/hooks/execution/CommandHookExecutor.ts` — 同上
- `ui/server/utils/plugin-loader.js` — `withHiddenConsole` + `shell: false`
- 全栈拉起：`scripts/lib/devConcurrentHeadless.mjs` 直启 `node`，不经 `npm.cmd`

### 4. 包装模块（绕过 ESM named import）

Node ESM 的 `import { spawn } from 'node:child_process'` **不会**走 default export 上的 patch。须统一从：

| 区域 | 模块 |
|------|------|
| 引擎 `src/**` | `src/util/childProcess.ts` |
| Bridge `ui/server/**` | `ui/server/utils/childProcess.js` |
| 脚本 `scripts/**` | `scripts/lib/childProcessShim.mjs` |
| 启动器 main | `tools/nova-launcher/src/main/childProcess.ts` |

`ui/server` 路由与服务层已全部改从 `childProcess.js` 引入；`src` 工具/bash/git/ripgrep 等已改从 `childProcess.ts` 引入。

### 5. 子进程入口注入

`devConcurrentHeadless.mjs` 为 gateway / bridge 子进程追加 `--import <patchHiddenConsole.mjs>`，确保子树内 spawn 同样受 patch 保护。

### 6. 启动器与桌面

- `NovaDevConsole.exe`（`csc /win32icon`）内嵌 N2 图标，`CreateNoWindow` 启动 VBS
- 日志/状态只在启动器 UI 与 `.launcher-start.log` 展示，**禁止**系统 Error 弹窗（`suppressErrorDialogs`）

## 验证

```bash
# 补丁冒烟（Windows）
node scripts/smoke-hidden-console.mjs

# 启动器
npm run test:launcher:quick
```

手动：打开启动器 → 启动全栈 → 对话中执行 `bash`/`git` → 观察是否仍有 CMD 闪窗。

## 未纳入范围（刻意不 patch）

- 用户主动打开的终端（`npm run dev:saas` 在当前控制台）
- 验收/发版脚本（`stdio: inherit` 需要可见输出）
- 第三方 GUI（浏览器、Office）— 非 cmd.exe

## 若仍有个别弹窗

1. 设 `NOVA_LOG_HIDDEN_SPAWNS=1` 重启 Gateway，复现后查看 `hidden-spawn.log`
2. 把日志最后 20 行与操作步骤反馈，定位未 patch 的入口或 vendor 脚本
