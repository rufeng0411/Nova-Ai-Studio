# P0-7 单一终验收证书与质量仲裁实施报告

## 状态

**DONE**

## 已完成

- 新增 `deliverableQualityChecks.ts` 与 `deliverableQualityPipeline.ts`：
  - 校验冻结主题、精确数量、既有软内容质量、组合槽位与工具策略。
  - 对已验证文件内容生成独立 `qev1:` 证据哈希。
  - 校验官方素材账本的本地文件哈希、任务目录边界与来源等级；证书摘要不保存来源 URL。
  - 内容质量与官方素材分别服从 `PILOTDECK_CONTENT_QUALITY_V2`、`PILOTDECK_OFFICIAL_MEDIA_V2`，互不错误联动。
- `validateDeliverablesEngine` 已改为 draft-only：
  - 顺序固定为 SDM/严格槽位 veto → Ground Truth → composite/content/provenance quality。
  - 不再构建、复制或修改 `acceptanceCertificate`。
  - 用户接受部分成果、质量 verdict、证据哈希和来源摘要作为 draft facts 返回。
- 新增唯一终结器 `finalizeDeliverableAcceptance`：
  - 统一映射 `complete / accepted_partial / incomplete / blocked`。
  - `AgentLoop` 在 verification、repair circuit 和 recovery budget 均结算后调用。
  - 熔断或预算耗尽不再被改写为 `passed`；最终映射为 `blocked + failed + system_exhausted`。
  - 显式接受部分成果映射为 `accepted_partial`；允许的官方素材占位降级映射为 `accepted_partial`。
  - 最终证书仅由终结器构建一次，保留 engine quality insight。
- certificate v2 已增加独立质量命名空间：
  - `qualityContractHash`
  - `qualityEvidenceHash`
  - `qualityCompletion`
  - `partialReason`
  - `blockedReasonType`
  - `qualityFailures`
  - `assetProvenanceSummary`
- 新增 `deliverableCompletionState.ts`：
  - `isAcceptanceSatisfied`
  - `shouldStopAutomaticContinuation`
  - `taskContinuationPolicy` 对 `accepted_partial`、`blocked` 直接停止自动续跑；无路径的质量失败仍进入 engine repair。
- 新增 `PILOTDECK_CONTENT_QUALITY_V2=off|shadow|enforce`：
  - 本地开发默认 `shadow`。
  - 打包与云端应用脚本默认 `off`，可独立分钟级回滚。
  - `shadow` 写质量观察结果但不 veto 结构验收；`enforce` 才参与最终状态。
- 扩展 transcript acceptance meta，持久化有界质量字段和最终完成态。
- 已登记 `config/pilotdeck-core-fork.manifest.json`，保留 `PD-SAAS-FORK` 标记。

## TDD 与验收

先新增测试并确认红灯（3 个缺失模块 suite 失败），再实现至绿灯。

最终结果：

- Vitest P0-7、AgentLoop、证书、续跑策略、0717 invariant：**12 files / 144 tests passed**
- 验收引擎 Node 回归：**24 tests passed**
- 三端开关配置回归：**3 tests passed**
- 合计：**171 tests passed，0 failed**
- `npx tsc -p tsconfig.json --noEmit`：通过
- `npm run check:saas-fork`：**639 entries verified**
- `devLauncherCore.mjs`、`pack.mjs`、`apply-cloud-perf-env.sh` 语法检查：通过
- IDE lint：0 errors

0717 两组 shadow invariant fixture 均通过，fixture 文件未修改。

## 约束遵守

- 未提交代码。
- 未重启开发服务。
- 未修改实施计划或 brief。
