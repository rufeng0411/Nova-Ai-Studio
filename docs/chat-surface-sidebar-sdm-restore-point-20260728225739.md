# 对话 Surface 分层、侧栏注意力与 SDM 槽位匹配 — 代码还原点

> 对话正文/过程/成果 Surface 分层 token、侧栏会话注意力与执行态、SDM 槽位匹配与 checklist authority 加固；continual-learning AGENTS.md 同步。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-chat-surface-sidebar-sdm-20260728225739` |
| **提交** | `38cfb380` |
| **时间** | 2026-07-28 22:57:39 +0800 |
| **说明** | 对话 Surface 分层、侧栏注意力与 SDM 槽位匹配加固 |

```bash
git show restore-point/post-chat-surface-sidebar-sdm-20260728225739 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

### 对话 Surface 分层

- `conversationSurfaceTokens.ts` / `.test.ts` — 正文、过程、成果 Surface token 分层
- `ChatInterfaceV2.tsx`、`MessageRowV2.tsx`、`ProcessTimeline.tsx` 接入分层样式
- `SessionDeliverableSummaryBar.tsx`、`DeliverableSummaryTable.tsx` 成果区视觉收敛
- `index.css` 全局 token 微调

### 侧栏注意力与执行态

- `sessionSidebarAttention.ts` / `.test.ts` — 侧栏会话注意力（排队/进行中高亮）
- `AppShellV2.tsx`、`SidebarV2.tsx` 接入注意力态
- `sidebarSessionExecutionStatus.ts` 执行态语义扩展
- `chatPermissions.ts` — Composer 发送/暂停权限门控
- i18n：`sidebar.json`、`chat.json` 侧栏/对话文案

### SDM / 槽位匹配

- `sdmSlotMatching.ts` / `.test.ts` — pathHint 匹配与槽位 satisfied 加固
- `deliverableChecklistAuthority.ts` — checklist 权威与编号清单解析
- `deliverableFilenamePolicy.ts` — 中文成果 basename 策略
- `detectGoalMutation.ts`、`sessionDeliverableManifest.ts` 目标追加/ manifest 编译
- `config/deliverable-checklist-authority.json`

### AGENTS.md

- continual-learning：Star 还原点 SOP、Composer 成果入口收敛、团队协作三 Tab、Hub 可见性后台

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`

## 如何还原

```bash
git reset --hard restore-point/post-chat-surface-sidebar-sdm-20260728225739
```

## 前置里程碑

- ★ 智谱演示稳定版：`restore-point/post-zhipu-demo-stable-20260728210731` / `star/zhipu-demo-stable`
