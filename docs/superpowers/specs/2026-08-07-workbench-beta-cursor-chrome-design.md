# Workbench 1.1 Beta · Cursor Chrome 配色设计

**状态**：已批准执行（用户 2026-08-07）  
**范围**：仅 `/app-1.1-beta`（`[data-workbench-beta='1']`）  
**焦点色**：① 克制电蓝  
**保留**：绿色成果动效 / 对勾 / `deliverable-badge-pulse` / `--success` 语义  

## 目标

把 Beta 工作台从「淡紫主轴 + 单色灰铺平」拉到 Cursor 语法：**色阶分层、极少电蓝锚点、统一 icon 透明度叙事**；成果完成叙事继续用绿。

## 非目标

- 不改 `/app`、营销站、全局 `index.css` `:root`
- 不改信息架构 / SDM / AgentLoop
- 不做 P-cutover
- 不把 success 绿改成蓝

## Token 纪律

| 角色 | Token | 暗色建议 | 用途 |
|------|-------|----------|------|
| bg | `--background` | ~`240 4% 6%` | 主区最深底 |
| surface | `--sidebar` | ~`240 3% 8%` | 侧栏/顶栏 |
| elevated | `--card` / `--popover` | ~`240 3% 10%` | Composer/卡片 |
| border | `--border` | ~`240 3% 16%` | 弱分割，少硬描边 |
| text | `--foreground` | ~`240 5% 92%` | off-white |
| text-2 | `--muted-foreground` | ~`240 4% 58%` | 中灰说明 |
| focus | `--primary` / `--wb-beta-accent` | `217 100% 65%` | CTA/选中/进度/ring |
| success | **不覆盖** | 继承全局绿 | 成果完成与动效 |

彩色纪律：电蓝仅 Chrome 焦点；绿仅完成；红仅错误/停止。

## 控件四级

Primary 实心电蓝 · Secondary 描边 · Ghost 文字 · Icon-only（idle 透明度，hover 提亮，active 电蓝或绿）

## 验收

1. Beta 无明显紫主轴；灰阶可辨  
2. 发送/选中=电蓝；成果完成仍绿且有动效  
3. `/app` 无泄漏  
4. 单元门禁 `test:workbench-beta-11:unit` 绿  

## 回滚

关 `VITE_WORKBENCH_BETA_11` / 不进 `/app-1.1-beta`；或还原 `workbenchBetaTokens.css`。
