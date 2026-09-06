# Nova 对话过程反馈 — Copy Voice 规范

**版本**：2026-06-15  
**适用范围**：用户可见层（气泡、live 过程条、toast、耗尽卡片、Bridge status）

## 原则

1. **进行中**：只描述「正在做什么」，不出现失败/重试语义  
2. **后台恢复**：用户无需知道技术原因；系统自动换路径  
3. **耗尽**：温和说明 + 一个主操作；次数与堆栈仅进「查看详情」

## 禁用词（主文案）

重试、重新进行、多次尝试、失败、错误、卡住、危机、Failed tools、Several tools failed

## 推荐用语

| 场景 | zh-CN | en |
|------|-------|-----|
| 默认进行中 | 仍在处理中 | Still working on it |
| 换路径 | 正在换一条路继续… | Trying another approach… |
| 网络瞬态 | 联网不太稳定，正在恢复连接 | Connection is unstable — reconnecting |
| 开发栈断连 | 开发服务短暂中断，正在自动接上 | Dev service interrupted — reconnecting |
| 遇阻自动续 | 遇到一点阻碍，正在自动调整 | Hit a snag — adjusting automatically |
| 耗尽标题 | 这一步还需要一点时间 | This step needs a bit more time |
| 过程 Pill（recovery） | 调整中 | Adjusting |
| 过程 Pill（续跑） | 继续推进 | Continuing |
| 按钮 | 继续这一步 / 换个方式继续 | Continue this step / Try another way |

## 计数展示

- `{{attempt}}/{{max}}` **禁止**出现在主 live 行与用户气泡  
- 可写入 telemetry、`查看详情` 折叠区、管理员日志

## 实现权威

- 引擎：`src/agent/errors/userFacingErrors.ts`
- i18n：`ui/src/i18n/locales/{zh-CN,en}/chat.json`
- 过程 UI：`ProcessClueStrip.tsx`、`MessagesPaneV2.tsx`、`RecoveryGuidanceCard.tsx`
- Bridge：`ui/server/pilotdeck-bridge.js`（禁止硬编码中文 hints）

## 基线

优化前 recovery 快照：`docs/recovery-baseline-pre-copy-2026-06-14.json`（引用 `recovery-baseline-2026-06-15.json` 全量）
