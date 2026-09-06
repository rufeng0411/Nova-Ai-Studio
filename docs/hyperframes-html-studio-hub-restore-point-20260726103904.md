# HyperFrames · HTML Studio · Hub 批次 — 代码还原点

> HyperFrames 视频渲染引擎接入、SuperPreview HTML Studio 可视化编辑、Skills 批次 vendor 与能力 Hub 分类扩展；含 ES9 四线/成果 SDM/续跑加固与全链路提速文档。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-hyperframes-html-studio-hub-20260726103904` |
| **提交** | `e828565e` |
| **时间** | 2026-07-26 10:39:04 +0800 |
| **说明** | HyperFrames 视频引擎、HTML Studio 与能力 Hub 批次扩展 |

```bash
git show restore-point/post-hyperframes-html-studio-hub-20260726103904 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

### HyperFrames 视频引擎

- Gateway 内置 `render_hyperframes` 工具（`src/tool/builtin/renderHyperframes.ts`）
- 19 项 HyperFrames skill vendor + NOVA-EXEC 置顶（`skills/vendor/hyperframes/`）
- 媒体策略反 `generate_video` 劫持、验收链（`hyperframesAcceptance.ts`、`hyperframesRenderGate.ts`）
- 验收脚本：`smoke-hyperframes.mjs`、`run-hyperframes-*`、`test:hyperframes:unit`
- Docker ffmpeg + hyperframes CLI 门禁（`Dockerfile.prod`、`verify-cloud-runtime.sh`）

### HTML Studio（SuperPreview）

- 右栏 Dock 可视化 HTML 编辑（`ui/src/components/super-preview/adapters/htmlStudio/`）
- 门控与写盘策略（`htmlStudioGate.ts`、`htmlStudioWritePolicy.js`）
- 设置页开关（`HtmlStudioSettingsRow.tsx`）
- 规范与验收：`docs/html-studio-spec.zh-CN.md`、acceptance 报告

### 能力 Hub 与 Skills 批次

- 能力 catalog / i18n / taxonomy 大规模扩展（400+ 展示口径）
- 批次 vendor 脚本（baoyu、superpowers、crawl-stack、office-legal 等）
- Hub 导航与主题 token 更新（`CapabilityHubCategoryNav.tsx`、`capabilityHubTheme.ts`）

### 成果 / 稳定性 / 提速

- SDM 槽位匹配、目标追加、Dock 累加、验收 scope 过滤
- ES9 四线修复验证与全链路提速分析文档（20260725）
- Turn Queue pump、cold-resume、sessionAutoContinueGate 加固
- PPT 导出默认策略（`pptExportDefaultPolicy.ts`）

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-hyperframes-html-studio-hub-20260726103904
```

### 从还原点开实验分支

```bash
git checkout -b experiment/hyperframes-html-studio restore-point/post-hyperframes-html-studio-hub-20260726103904
```

### 只还原某个文件

```bash
git checkout restore-point/post-hyperframes-html-studio-hub-20260726103904 -- path/to/file
```

## 关联文档

- [`hyperframes-hardening-acceptance-20260725.zh-CN.md`](./hyperframes-hardening-acceptance-20260725.zh-CN.md)
- [`html-studio-spec.zh-CN.md`](./html-studio-spec.zh-CN.md)
- [`full-chain-speed-optimization-20260725.zh-CN.md`](./full-chain-speed-optimization-20260725.zh-CN.md)
- [`es9-four-line-fix-validation-20260725.zh-CN.md`](./es9-four-line-fix-validation-20260725.zh-CN.md)
- [`sdm-goal-add-dock-export-restore-point-20260724155156.md`](./sdm-goal-add-dock-export-restore-point-20260724155156.md)（上一还原点）
