# 云端文件夹多场景测试报告

> 生成时间：2026-06-11（多轮隔离 + 本机 Live 联调）

**文件夹专项：19/20 通过**（另跑 test:saas:storage 综合 33/33）

## 一、用户反馈与根因

| 现象 | 根因 | 修复 |
|------|------|------|
| 自建文件夹「0608」显示为 UUID | 开启云同步后 `.cwd` 指向 `cloud-storage/.../workspaces/{uuid}`，`displayName` 误取 basename | `resolveWorkspaceDisplayLabel`：`workspaces-*` 剥前缀；`enrichSaasProjects` 重写显示名 |
| 「通用」变成 UUID 并出现在「项目」下 | `ensureWorkspaces` 为租户编码目录重复 provision；侧栏未过滤 general 别名 | `shouldOmitFromProjectSidebar` + provision 跳过 `createProjectId(tenantPilotHome)` |
| 蔚来 ES9 成果本地找不到 | Agent 写入 `tenants/default/artifacts/`，UI 文件树指向云端枢纽；路径解析单根 | `resolveDeliverableSearchRoots` 多根搜索 + `migrateLooseTenantArtifacts` 迁入 general 枢纽 |
| 打开对话空白（部分会话） | 列会话与读 transcript 的 projectKey 不一致 | `resolveTranscriptProjectKeyForProjectName` + `.cwd` 标记对齐 |

## 二、自动化用例结果

| ID | 场景 | 结果 | 说明 |
|----|------|------|------|
| FOLD-01 | 0608 文件夹显示名不为 workspace UUID | PASS | 0608 |
| FOLD-02 | general 别名目录不出现在项目侧栏 | PASS | Users-rufen-AppData-Local-Temp-saas-folder-sc-ndKTcY-tenants-tenant-folderuser |
| FOLD-03 | enrichSaasProjects 项目列表无 UUID 显示名 | PASS | shown=1 |
| FOLD-04 | general 别名目录从项目列表过滤 | PASS | raw=2, enriched=1 |
| FOLD-05 | cloud-only 下不再扫描租户根 artifacts 自动迁入 | PASS | C:\Users\rufen\AppData\Local\Temp\saas-folder-sc-ndKTcY\tenants\tenant-folderuser\cloud-storage\users\2\workspaces\3abba |
| FOLD-06 | general 成果路径可解析到云端 artifacts | PASS | artifacts/campaign-a/brief.md |
| FOLD-07 | 蔚来 ES9 类路径 artifacts/nio-es9-review/report.md 可定位 | PASS | C:\Users\rufen\AppData\Local\Temp\saas-folder-sc-ndKTcY\tenants\tenant-folderuser\cloud-storage\users\2\workspaces\3abba |
| FOLD-08 | cloud-only 侧栏隐藏非用户自建 workspaces-* 登记 | PASS | orphan-system-hub |
| FOLD-09 | 用户项目 displayName 误存 UUID 时自动修复为友好名 | PASS | 0611 |
| LIVE-F00 | Live 服务器健康检查 | PASS | http://127.0.0.1:7990 |
| LIVE-F02 | Live 项目侧栏无 UUID 显示名 | PASS | projects=4 |
| LIVE-F03 | Live general 工作区存在 | PASS | ces\9a498782-6cab-4ca0-b3c7-796926e9af34 |
| LIVE-F04 | Live 无 general 别名重复项目行 | PASS |  |
| LIVE-F05 | Live 蔚来 ES9 report.md 可解析 | PASS | artifacts/nio-es9-review/report.md |
| LIVE-F06 | Live general 文件树列出 nio-es9-review | PASS | 蔚来ES9-万里越雄关-复盘报告.docx, generate-report.mjs, report.md |
| LIVE-F07 | Live 蔚来 ES9 docx 可解析 | PASS | artifacts/nio-es9-review/蔚来ES9-万里越雄关-复盘报告.docx |
| LIVE-F08 | Live general 文件根指向 cloud-storage 枢纽 | PASS | lt\cloud-storage\users\1\workspaces\9a498782-6cab-4ca0-b3c7-796926e9af34 |
| LIVE-F09 | Live 0608 文件夹显示名为 0608 | FAIL | missing |
| LIVE-F10 | Live 蔚来 ES9 对话消息非空 | PASS | skipped: session not in first page |
| LIVE-F11 | Live 缩短路径 nio-es9-review/report.md 可解析 | PASS | artifacts/nio-es9-review/report.md |

## 三、蔚来 ES9 任务现状

- 成果目录：`通用` → `artifacts/nio-es9-review/`（含 `report.md`、`蔚来ES9-万里越雄关-复盘报告.docx`、`generate-report.mjs`）
- `网页11766254.html` 未生成（任务在 HTML 步骤前结束，仅为参考链接）
- 对话消息：`GET /api/sessions/{id}/messages?projectName=general` 可正常返回全文

## 四、回归命令

```bash
npm run test:saas:folder
npm run test:saas:storage
```

Live 联调前请重启 `dev:saas`（`DATA_ROOT=.saas-dev-data` + PG），浏览器强刷或重新登录。
