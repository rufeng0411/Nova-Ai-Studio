# HF Studio · P0′ 提速 · 四线 — 代码还原点

> HyperFrames Studio 右栏编辑与 Bridge 渲染链；交付 subagent 门控与 orchestration bypass；三案/四案实机门禁、HTML 导出加速；模型池冗余 Key 与 SDM 文件名策略。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-hf-studio-p0prime-speed-20260727104347` |
| **提交** | `ff0769c1` |
| **时间** | 2026-07-27 10:43:47 +0800 |
| **说明** | HF Studio SuperPreview、P0′ 提速与成果四线/模型池加固 |

```bash
git show restore-point/post-hf-studio-p0prime-speed-20260727104347 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

### HyperFrames Studio（SuperPreview）

- 右栏 `@hyperframes/studio` 懒加载编辑（`ui/src/components/super-preview/adapters/hyperframesStudio/`）
- Bridge `POST …/hyperframes/render`、写白名单与 `promo.mp4` 原子渲染（`hfStudioWritePolicy.js`）
- 四线刷新：`hfStudioDeliverableSync.ts` → Dock/footer/export/文件夹 Tab 同源
- 规范与验收：`docs/hf-studio-superpreview-spec.zh-CN.md`、`run-hf-studio-acceptance.mjs`

### P0′ 提速与稳定度

- `shouldBlockDeliverableSubagent.ts` 禁交付类 subagent 空转
- `shouldBypassOrchestration` GEO/matrix 绕过矩阵
- 三案速度 RCA 实机（`run-three-case-speed-rca-live.mjs`、黑袍 39min→56s）
- ES9 五案 / 四案 novapage / HTML 导出门禁脚本
- 全链路提速落地文档：`docs/full-chain-speed-implementation.zh-CN.md`

### 成果 SDM / 四线

- `deliverableFilenamePolicy.ts`、`officeExtensionStrict.ts`
- `sequentialDeliverableGate.ts` 成果线性 write_file
- `sessionDeliverableManifest.ts` 编号清单与 pathHints 加固
- `filterProcessArtifactsFromFileTree.ts` 文件树隐藏过程产物

### 模型池与工具链

- `providerApiKeys.ts` 冗余 Key 继承与设置页编辑（`modelPoolRedundancyEditors.tsx`）
- Turn Queue pump/manager 背压与 acceptance 同步
- PPT skill vendor：cyber-ppt、gorden-ppt、taste-skill 全量

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-hf-studio-p0prime-speed-20260727104347
```

### 从还原点开实验分支

```bash
git checkout -b experiment/hf-studio-p0prime restore-point/post-hf-studio-p0prime-speed-20260727104347
```

### 只还原某个文件

```bash
git checkout restore-point/post-hf-studio-p0prime-speed-20260727104347 -- path/to/file
```

## 关联文档

- [`hf-studio-superpreview-spec.zh-CN.md`](./hf-studio-superpreview-spec.zh-CN.md)
- [`three-case-speed-rca-live-report-20260726.zh-CN.md`](./three-case-speed-rca-live-report-20260726.zh-CN.md)
- [`full-chain-speed-implementation.zh-CN.md`](./full-chain-speed-implementation.zh-CN.md)
- [`hyperframes-html-studio-hub-restore-point-20260726103904.md`](./hyperframes-html-studio-hub-restore-point-20260726103904.md)（上一还原点）
