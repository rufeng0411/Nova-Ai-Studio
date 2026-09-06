# 上游合并评测报告（`origin/main` @ `3c1ca3b`）

**分支**：`integrate/pd-upstream-3c1ca3b`  
**还原点**：`pre-pd-merge-33394d1`（`33394d1` / WIP `afcc362`）  
**合并提交**：`77c8fef` + 基线修复 `adf99c7` + fork 登记 `3db8f73`  
**日期**：2026-06-03  

## 第一节：三问摘要

| 问题 | 判定 | 说明 |
|------|------|------|
| **45 条上游更新是否有影响？** | **有条件通过** | 10 个交汇文件中 3 处人工合并、7 处自动合并；telemetry、OpenAI 空 tool name、max_output 续写、UI 端口 fallback、IM 降噪、bootstrap cron 已并入。IM 与 SaaS 无直连。 |
| **核心 PD 能否跑通？** | **有条件通过** | `npm run build`、`npm test`（30/30）、UT-R（19/19）、`check:saas-fork`（13/13）、smoke templates/docx/aigeo/social-matrix 均通过。 |
| **二开是否正常？** | **有条件通过** | 容错双轨（max_output×3 + recovery×5）保留；成果路径与 ask_user_question 双保留；Playwright **SKIP**（本机 3001/5173 占用，dev:concurrent 未能起全栈）。 |

**总判定**：**有条件通过** — 可并回 `main`；建议在空闲端口复跑 P1–P4 后升为「通过」。

## 第二节：上游 45 提交 × 二开（节选）

| 上游主题 | 关联二开 | 验证 | 结果 |
|----------|----------|------|------|
| telemetry v2 | Gateway 旁路 | build + 代码审阅 sender 不阻断 | PASS |
| max_output 续写 | docx/HTML 大成果 | AgentLoop 合并 + UT-F | PASS |
| 空 tool name | GEO/媒体 tool call | 上游 stream 自动合并 | PASS |
| 端口 fallback | 能力中心 API | index.js 自动合并 | PASS（未 E2E） |
| ask_user_question | toolConfigs/bridge/Renderer | 3 文件冲突双保留 | PASS |
| bootstrap cron | yixiaoer/docx/geo 刷新 | bootstrap 冲突双保留 | PASS |
| IM 渠道降噪 | 无 | 编译即可 | SKIP |

## 第三节：自动化证据

| 项 | 基线 (phase-00) | 合并后 |
|----|-----------------|--------|
| UT-0 build | 0（补丁前失败） | 0 |
| UT-F | 36/36 | 30/30（上游删 6 测） |
| UT-R | 19/19 | 19/19 |
| smoke:L3 | — | 4/4 OK |
| check:saas-fork | 缺失 | 13/13 |

## 第四节：Playwright（Phase 5）

| ID | 脚本 | 结果 | 备注 |
|----|------|------|------|
| P1 | check-white-screen | **SKIP** | 5174 连接被拒（dev 进程因 3001 占用退出） |
| P2 | ui-regression-check | **SKIP** | 依赖全栈 dev |
| P3 | ui-artifact-preview-check | **SKIP** | 需 LLM + 全栈 |
| P4 | ui-yixiaoer-regression | **SKIP** | 依赖 SERVER |

复跑示例（换端口）：

```powershell
$env:SERVER_PORT="3002"; $env:VITE_PORT="5175"
$env:PILOTDECK_GATEWAY_PORT="18790"
$env:PILOTDECK_GATEWAY_URL="http://127.0.0.1:18790"
npm --workspace ui run dev:concurrent
$env:VITE_URL="http://127.0.0.1:5175"; $env:SERVER_URL="http://127.0.0.1:3002"
node scripts/check-white-screen.mjs "$env:VITE_URL/p/general"
```

## 第五节：阶段总结索引

详见 `artifacts/merge-qa/phases/`（本地，已 gitignore）：

- `phase-00-baseline-summary.md`
- `phase-01-merge-summary.md`
- `phase-02b-ui-conflicts-summary.md`
- `phase-04-merge-gate-summary.md`

## 第六节：回滚

```powershell
git switch integrate/pd-upstream-3c1ca3b
git reset --hard pre-pd-merge-33394d1
```
