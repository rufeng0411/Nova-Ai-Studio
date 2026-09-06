# 上游选择性合并评测报告 — `1a575e21`（不含 IM）

**日期**：2026-06-13  
**合并方式**：`integrate/pd-upstream-non-im` → `main` ff-only（4× cherry-pick `-x`）  
**还原标签**：`pre-pd-merge-non-im-1a575e21` @ `c77ac7e6`  
**上游 HEAD**：`origin/main` @ `1a575e21`（相对共同祖先 `3891db5` 落后 12 提交）  
**本地基线**：`c77ac7e6`（SaaS admin skills tree / provider hub / Nova launcher）

---

## 总判定：**通过（选择性合入）**

本次**未**全量 merge `origin/main`；**整块排除 IM**（#198 gateway/ChannelAdapter/飞书微信等）。  
合入 4 个非 IM 提交；冲突 3 文件已按 fork 优先手册解决；负向检查无 `gateway.js` / `GatewaySettingsTab` / `handleAdapterHotReload` 误入。

---

## 一、合入范围

| 顺序 | SHA | 说明 | 结果 |
|------|-----|------|------|
| 1 | `6bb71a07` | `meeting-recorder-assistant` 内置 skill | 无冲突 |
| 2 | `77f8c493` | 用户气泡 Markdown 列表 marker（`prose` className） | `MessageRowV2.tsx` 手工合并 |
| 3 | `f86e18db` | `ComposerV2` 渲染 `CommandMenu` + 斜杠检测 | `ComposerV2` + `useSlashCommands` 手工合并 |
| 4 | `b2a56469` | 斜杠菜单 skill 无参 autoExecute | `autoExecuteCommand` 走 `onExecuteCommand` |

**明确排除（6 提交）**：`99625973` `4b55ebc4` `15240a65` `943e3975` `679b0a4b` `bdedce39`（IM gateway / Settings / adapter 热重载）。

---

## 二、冲突解决摘要

| 文件 | 解法 |
|------|------|
| `MessageRowV2.tsx` | 保留 fork（ProcessTrace/GentleNotice/ReferenceMaterialCards）；仅用户 `Markdown` 加 `prose prose-sm … prose-ol/ul` |
| `ComposerV2.tsx` | 保留 ReferenceMaterialCards/流程模板/运行模式 UI；去掉 `_` 丢弃 CommandMenu props；插入 `CommandMenu` |
| `useSlashCommands.ts` | 合并 `shouldAutoExecute` + `handleCommandInputChange`；autoExecute 经 `onExecuteCommand` 并 `trackCommandUsage` |
| `useChatComposerState.ts` | 自动合并（`inputValueRef` / `handleSubmitRef` 透传） |

---

## 三、合并后闸门

| 项 | 结果 |
|----|------|
| `npm run build` | PASS |
| `npm test` | PASS 56/56 |
| `npm run check:saas-fork` | PASS 264/264 |
| `npm run brand:check` | PASS |
| `npm run capabilities:gen` | PASS（catalog 含 `meeting-recorder-assistant`） |
| `npm run smoke:capability-hub` | PASS |
| 负向 grep（IM 路径） | PASS（无 `GatewaySettingsTab` / `gatewaySetup` / `ui/server/routes/gateway.js`） |

### `test:pre-production`（精益套件）

合并前基线与合并后均存在**环境性** FAIL（非本次 diff 引入）：

- 套件内子进程 `EINVAL`（Windows 下 `run-pre-production-suite.mjs` 并发 spawn）
- 隔离 SaaS `syncalice register` 400（`test:saas:storage` / `test:saas:folder`）
- 需 live dev 的 `oss-regression` / `mobile-regression`（登录态/预览面板）

**合并专属核心闸门（build/test/fork/brand/hub smoke）全部 PASS**，允许 ff。

---

## 四、变更文件清单（相对 `c77ac7e6`）

- `skills/meeting-recorder-assistant/**`（新增）
- `ui/src/components/chat-v2/MessageRowV2.tsx`
- `ui/src/components/chat-v2/ComposerV2.tsx`
- `ui/src/components/chat/hooks/useSlashCommands.ts`
- `ui/src/components/chat/hooks/useChatComposerState.ts`
- `config/capabilities.*` + 生成物（meeting skill 入 catalog）

---

## 五、回滚

```powershell
git checkout main
git reset --hard pre-pd-merge-non-im-1a575e21
git branch -D integrate/pd-upstream-non-im
```

---

## 六、后续

- 日后若合入 IM，须单独方案（Nova SaaS 多租户 vs 单机 `~/.pilotdeck` 凭据）。
- 全量 merge `1a575e21` 时 cherry-pick 提交可能内容重复，以 manifest / 文件 diff 去重。
