# 统一韧性修复汇总（2026-06-14）

## 问题清单与根因

| # | 现象 | 根因 | 修复 |
|---|------|------|------|
| 1 | Nova Launcher / `restart-ui-dev` 后任务中断 | 杀 Gateway/Bridge/Vite → WS `ECONNRESET`/`1006` | Launcher 与 restart 脚本增加「会中断进行中对话」警告 |
| 2 | `agent_model_error` 显示「联网有些问题」 | `fetch failed`/`198.18.x`（本地代理假 IP）被当用户网络问题 | `isInfrastructureDisconnectMessage` 归类为开发栈断连；Gateway `recoverable: false` 触发 UI 续跑 |
| 3 | memory-scheduler 每 60s 打栈 | 后台 dream 调 LLM API，代理 TLS 中断 | 开发环境默认跳过 dream；瞬态失败 3 次熔断 30min；日志缩短 |
| 4 | `[gateway] npm EOVERRIDE react` | 插件安装 `npm install` 继承 monorepo overrides | `plugin-loader` 改 pnpm 优先 + `npm_config_workspace=false` 隔离安装 |
| 5 | 纵横 G700 内容营销失败 | 旧模板无 write_file 分阶段约束；Launcher 重启掐断 | `content-flywheel` 模板 + `content-flywheel-execution` 注入 + 工具 recovery 专用文案 |
| 6 | 北京 AI 报告 Live 验收扫不到交付物 | 脚本未扫 `general/artifacts/` | `integration-recovery-beijing-ai-report-run.mjs` 补路径 |
| 7 | 阶段进度条几秒消失 | 原 ProcessPhaseRail 随消息滚动离开视口 | 底部 sticky `live-process-progress-dock` 任务进行中常驻 |

## Recovery 分层（已实现）

- **可恢复轨**（网络抖动、工具失败）：默认每 turn 最多 **12** 次（`recoverableMaxPerTurn`）
- **硬失败轨**（鉴权/欠费/区域）：连续 **3** 次确认后快停（auth/billing **1** 次即停）
- **基础设施断连**：不计入可恢复轨；用户文案为「开发服务连接中断，正在自动续跑」

权威：`src/saas/resilience/`、`docs/conversation-resilience-spec.md`

## 流程模板执行绑定

| 模板 | 检测 | 注入块 |
|------|------|--------|
| `research-report` | `detectResearchReportTurn` | `<research-report-execution>` |
| `content-flywheel` | `detectContentFlywheelTurn` | `<content-flywheel-execution>` |

实现：`src/saas/processTemplateExecutionPrompt.ts` → `AgentLoop` prompt 追加。

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `PILOTDECK_SKIP_MEMORY_DREAM` | dev 等同 `1` | `0` 强制开启后台 dream |
| `PILOTDECK_DEV_SKIP_MEMORY_DREAM` | — | `0` 覆盖 dev 跳过 |

## 验收命令

```bash
npx vitest run src/saas/processTemplateExecutionPrompt.test.ts src/saas/resilience/recoveryPolicy.test.ts
npx vitest run ui/src/components/chat-v2/MessagesPaneV2.render.test.tsx
npm run test:recovery-beijing-ai-report
npm run smoke:resilience
```

Live（需 dev:saas 已起）：

```bash
npm run test:recovery-beijing-ai-report:continue
```

## 操作注意

1. **长任务进行中勿点 Launcher「启动/重启」** 或 `npm run restart:ui-dev`
2. 北京报告若已有 `01`/`02`，在 UI 发续跑提示完成 `03` + `export_document`
3. 内容营销用能力中心「内容营销飞轮」试一下，产物应在 `artifacts/content-*`
