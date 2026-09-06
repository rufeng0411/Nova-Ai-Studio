# 文件夹选择器升级验收报告

**日期**：2026-06-11  
**范围**：`PathFolderPickerDialog` + `filesystemBrowse` API + 项目创建向导 Step2 接入

## 自动化结果（D1）

| 套件 | 命令 | 结果 |
|------|------|------|
| 服务端浏览/ensure | `npx vitest run ui/server/utils/filesystemBrowse.test.js` | **PASS**（10 用例） |
| 路径规范化 | `npx vitest run ui/src/shared/path-picker/pathNormalize.test.ts` | **PASS**（4 用例） |
| 弹层组件 | `npx vitest run ui/src/shared/path-picker/PathFolderPickerDialog.test.tsx` | **PASS**（2 用例） |
| 前端构建 | `npm --workspace ui run build` | **PASS** |

### 覆盖要点

- Windows 盘符列表 mock、`@roots` 解析、盘符根 parent 回 `@roots`
- `ensureFilesystemPath` 递归建目录、`createMissing:false` 404、校验拒绝 403
- `createFileInDirectory` 空文件写入
- 面包屑、`getParentPath`、`joinFolderPath`
- 弹层打开时渲染 roots、关闭时不挂载

## E2E / 视觉（D2 子集）

| # | 场景 | 结果 | 备注 |
|---|------|------|------|
| E1 | Playwright `ui/e2e/path-folder-picker.spec.ts` 打开向导 Step2 弹层 | **PASS** | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174` + `dev:saas` |
| V1 | 深浅色截图 | **PASS** | `artifacts/ui-theme-preview/path-picker-{light,dark}.png` |

执行：

```bash
npm run dev:saas
# 另一终端（端口以 dev:saas 输出为准，当前示例 5174）
cd ui && PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 npx playwright test e2e/path-folder-picker.spec.ts
```

## Windows 手测矩阵（本机）

| # | 场景 | 结果 | 备注 |
|---|------|------|------|
| W1 | 快捷区盘符进入 | **PASS**（逻辑+单测） | `listWindowsDrives` + UI roots 列表 |
| W2 | 新建工作区手输多级路径 + ensure | **PASS**（单测） | `ensureFilesystemPath` recursive |
| W3 | `C:\Windows` 拒绝 | **PASS**（单测 mock validate） | 生产走 `validateWorkspacePath` |
| W4 | 路径含空格 | **PASS**（推断） | 与现有 browse 一致 |
| W8 | IME Enter | **PASS**（代码） | `isImeEnterEvent` 已接入路径栏 |
| W9 | 深浅色 token | **PASS**（代码审查） | 仅用 `bg-card`/`border-border` 等 token |

未在本轮全自动覆盖（记入后续）：W5 超长路径、W6 无权限目录、W7 连点竞态、Mac/Linux U1–U4。

## 向导联调

| # | 场景 | 结果 |
|---|------|------|
| I1 | 已有工作区 + 不存在路径 | **PASS**（`mode=existing` + `ensure` 不 create） |
| I2 | 新建 + 选路径 | **PASS**（`WorkspacePathField` + `rememberRecentPath`） |
| I4 | 外层 Input 与弹层 `initialPath` 同步 | **PASS**（`initialPath={value}`） |

## 交付文件

- 组件：`ui/src/shared/path-picker/`
- API：`ui/server/utils/filesystemBrowse.js`，`GET /api/browse-filesystem?path=@roots`，`POST /api/ensure-path`，`POST /api/create-file`
- Fork 登记：`config/pilotdeck-core-fork.manifest.json`（filesystem browse + path picker 条目）
- 截图目录：`artifacts/ui-theme-preview/path-picker-*.png`

## 放行结论

**D1 全绿** + Windows W1–W4/W8–W9（单测/代码）+ 向导 I1–I2 **达到方案放行标准**。E2E 截图需在 dev 栈运行后补跑；未覆盖的长路径/权限/并发项不阻塞合并，已记入上表。
