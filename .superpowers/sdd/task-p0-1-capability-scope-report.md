# P0-1 能力范围收口实施报告

## 结论

状态：`DONE_WITH_CONCERNS`

已在既有 `TaskGoalContract + SDM + GT + 四线` 内核内完成两个 exact capability 的范围收口，没有新增第二套成果合同、GT、验收或 repair owner。未提交代码、未重启开发服务、未修改计划文件或 `ui/src/generated/`。

## 实现结果

### 1. `mkt-last30days`

- `src/saas/deliverableCapabilityProfiles.ts`
  - 新增优先于 broad `mkt-*` 的 `last30days` exact profile。
  - enforce 下默认只有 `marketing-deliverable.md` 一个槽。
  - `须交付：xxx.html/md` 仍由现有编号清单/须交付解析优先，未创建新合同源。
  - 明示 `content-flywheel` 时保留 `01-topics.md`、`02-longform.md`、`03-social-slices.md` 三成果合同。
  - 仅明示其中一个旧 basename 时只编译该文件，不扩成三件套。
- `src/saas/taskState/taskGoalContract.ts`
  - 移除 enforce 路径中 `last30days` 自动固化三文件的行为。
  - `off` 时保留旧三文件合同，满足分钟级回滚。
- `ui/src/shared/collectFinalDeliverables.ts`
  - frozen SDM 存在时，slug、turn directory、历史 turn 扫描均不得增加显示行。
  - 目录数据仍由现有 unified view/folder enrich 管线补充已有槽，不新增槽。
- 四个调用入口传入完整 session 上下文：
  - `deriveDeliverablesDockState.ts`
  - `selectLatestDeliverableSummaryTurn.ts`
  - `exportSessionInlineDeliverables.ts`
  - `collectSessionFolderItems.ts`

### 2. `ala-strategy-advisor`

- 新增 `src/saas/intent/capabilityCompletionMode.ts`：
  - exact slug + 当前真实用户输入解析 `consultation | report`。
  - 输入附件 basename（如“分析附件 input.pdf”）不会误判成报告输出。
  - consultation 保留检索、读取、分析工具，屏蔽写入、生成、导出、脚本执行及交互式变更工具。
- `src/agent/turn/TurnRunner.ts`
  - 直接从当前 `AgentInput` 解析 completion mode，不依赖 `resolveCurrentIntent`。
  - mode 传入 SDM bootstrap、STDA bootstrap 和 `AgentLoop`。
- consultation：
  - 不编译/复用 SDM。
  - 不分配/复用 task directory。
  - `validateEngineDeliverables` 返回 `null`。
  - `resolveContinuationAction` 返回 `none`，不产生 repair 或 `<task-resume>`。
  - 主 Agent 和子代理均只暴露只读/分析工具。
- report：
  - 用户指定输出 basename 时仅编译该文件。
  - 只提及输入附件时不把附件当输出。
  - 未指定输出 basename 时单槽 fallback `strategy-report.md`。
  - SDM 与 STDA 绑定后，slot path 固定在当前 `taskArtifactDir`。
- `SubAgentSession` 继承 exact context 与 completion mode；consultation 子代理强制只读。consultation 不执行主会话成果验收，因此 sidechain 文件不会进入主会话 `verifiedPaths`。

### 3. Prompt、灰度与验收矩阵

- `capabilityBindingPrompt.ts`
  - 只增加两个 exact slug 的运行时约束。
  - 文件合同继续引用会话 SDM，不猜第二套文件清单。
- `promptTemplateStrategy.mjs`
  - `mkt-last30days` Hub 默认明确为 `marketing-deliverable.md`。
  - `ala-strategy-advisor` Hub 默认 prompt 保持无文件、无 task directory。
- 单一开关：
  - `PILOTDECK_CAPABILITY_SCOPE_V2=off|shadow|enforce`
  - `PILOTDECK_QUALITY_CANARY_SLUGS` 使用标准化后的 exact slug 匹配，不做前缀/包含匹配。
- 接线：
  - dev 默认 `enforce`，两个 exact slug 为 canary。
  - pack/cloud 默认 `shadow`，可通过同一开关切换或回滚。
  - 未新增 last30days/strategy 专用 binary flag。
- Korea live fixture：
  - K3 默认严格校验一个去重后的权威路径 `marketing-deliverable.md`。
  - K3L 为 required case，显式校验三文件 content-flywheel。
  - harness 真实传递 `capabilityContext`，不再只把 slug 写在 fixture 元数据中。

## TDD 记录

### RED

先写测试后修改实现，主要失败证据：

1. 后端目标测试：
   - 命令：`npx vitest run tests/saas/capability-scope-v2.test.ts tests/agent/validate-deliverables-capability-scope.test.ts src/agent/turn/TurnRunner.capabilityScope.test.ts`
   - 初次结果：9 个预期行为失败。
   - 证据包括：
     - completion mode 模块不存在。
     - 三态开关 API 不存在。
     - `mkt-last30days` 实际命中 `content` profile。
     - strategy report 无 SDM。
     - consultation 返回 `auto_continue_engine`。
     - consultation 仍产生 validation result。
   - TurnRunner 测试夹具最初构造参数错误；修正夹具后重跑，得到预期产品失败：两案的 `capabilityCompletionMode` 均为 `undefined`。
2. UI frozen SDM：
   - 命令：`npm --workspace ui run test -- src/shared/collectFinalDeliverables.capabilityScope.test.ts`
   - 初次结果：期望 `userVisibleArtifacts=1`，实际为 `4`。
3. 配置/Korea：
   - 命令：`node --test scripts/lib/capability-scope-config.test.mjs`
   - 初次结果：3/3 失败；缺 exact Hub 合同、K3 仍为 3 行、三态配置未接线。
4. 回滚键：
   - `off` 专项测试初次返回无 manifest，而不是旧三文件合同。
5. 输入附件边界：
   - “请分析附件 input.pdf”初次被误判为 `report`，而不是 `consultation`。

以上失败均在对应最小实现前取得；测试夹具错误不计作产品 RED。

### GREEN

最终逐项重跑：

- `npm run test:sdm:unit`：53/53 通过。
- `npm run test:task-continuation-policy`：42/42 通过。
- `npm --workspace ui run test -- src/shared/collectFinalDeliverables.test.ts`：18/18 通过。
- `npm run test:export-four-line-parity`：46/46 通过。
- P0-1 后端目标测试（completion/profile/SDM/validation/TurnRunner/flag）：22/22 通过。
- P0-1 配置、Hub、Korea fixture：3/3 通过。
- frozen SDM 的 collector/Dock/summary/export 目标测试：16/16 通过。
- 上述最终验收共 200 个测试通过。

额外检查：

- `npx tsc -p tsconfig.json --noEmit`：通过。
- 编辑文件 IDE lint：无新增诊断。
- `node --check`：Korea、Gateway harness、prompt strategy、dev launcher、pack 全通过。
- `bash -n scripts/release/apply-cloud-perf-env.sh`：通过。
- 发布 shell 保持 LF：通过。
- `git diff --check`：通过，仅有 Git 的预期 CRLF 转换提示。
- `npm run check:saas-fork`：558 条 manifest 登记全部通过。
- `pilotdeck-core-fork.manifest.json` JSON 解析：通过。

## 自审

- 完整性：两个 exact capability、TurnRunner、SDM/STDA、prompt、validation、continuation、子代理、UI frozen SDM、Korea 与三态发布配置均已覆盖。
- 范围：只改任务相关实现/测试/配置与 fork manifest；未改计划、生成目录或无关业务；未清理、回退现有工作树。
- 类型：后端完整 TypeScript 检查通过；目标 UI 测试与 lint 通过。
- 测试噪声：全量 `npx tsc -p ui/tsconfig.json --noEmit` 仍报告当前工作树已有的多项跨模块诊断，未指向本次编辑的 P0-1 UI 文件；未在本任务中越界修复。
- 现有改动保护：开始时工作树已有大量 modified/untracked 内容，且部分目标文件已有未提交改动。本次仅做增量 patch，没有覆盖、清理或还原。

## Concerns

1. 按要求未重启 dev 服务，因此没有在重新加载本次代码后的真实 Gateway 上执行耗时 Korea live K3/K3L；已完成真实 `TurnRunner` 路径的确定性测试、Gateway harness capability context 接线和 live fixture 静态门禁。
2. 全量 UI TypeScript 基线当前不干净；目标文件测试、IDE lint、后端 typecheck 均通过，但无法把全局 UI typecheck 声明为绿色。
3. 未提交任何改动。

## 独立审阅修复补充（2026-07-19）

### 状态

`DONE_WITH_CONCERNS`

3 个 Important 与 Minor-1 已在原 `TaskGoalContract + SDM + stability telemetry` 管线内收口；未新增成果合同、SDM、GT、repair owner 或额外 binary flag。`PILOTDECK_CAPABILITY_SCOPE_V2` 仍只接受 `off|shadow|enforce`。

### 本轮修复

1. shadow 观测
   - 新增 `src/saas/intent/capabilityScopeShadowTelemetry.ts`，复用 `recordStabilityEvent` 写入 `capability_scope_shadow`。
   - 每个 shadow turn 最多记录一条固定字段事件；仅 exact canary slug 生效。
   - 字段包含 exact slug、legacy/proposed completion mode、profile id、slot count 及三项 changed 布尔值。
   - 不记录用户原文、文件名、路径或正文；token 最长 64 字符，slot count 最大记录 100。
   - shadow 实际执行仍保持 legacy：测试确认 `mkt-last30days` 的 applied completion mode 为 unset、profile=`content`、slot=3；观测中的 proposed 为 report/`last30days`/1。
2. strategy report 误判
   - “我需要了解竞品文件里的策略”“给我看看竞品文件里的策略”“分析附件 input.pdf”均保持 `consultation`。
   - 只有明确生成/写入/导出/交付报告，或明确输出 basename，才进入 `report`。
   - `<task-resume>` envelope 不再把内嵌旧目标当作当前真实用户输出意图。
3. continuation-only 恢复
   - `SessionDeliverableManifest` 持久化 `completionMode`。
   - SDM bootstrap 先读取本 session 既有 manifest，再决定是否恢复 mode。
   - 仅同一 exact slug、裸继续/续跑 envelope、且存在未完成 required report slot 时沿用 `report`。
   - 普通新咨询不会继承旧 report；无 session SDM 的 `<task-resume>` 不会创建 report 合同；既有 `sessionGoalAnchor` 不被“继续”或 `<task-resume>` 改写。
4. 裸 basename
   - 整条消息仅为 `competitor.md` 时，`TaskGoalContract` 直接提取该 basename，SDM 单槽为 `competitor.md`，不再 fallback `strategy-report.md`。

### 本轮 TDD RED

1. 意图误判与裸 basename
   - 命令：`npx vitest run "tests/saas/capability-scope-v2.test.ts"`
   - 结果：2 failed / 7 passed。
   - 失败原因：
     - “我需要了解竞品文件里的策略”实际为 `report`，期望 `consultation`。
     - `competitor.md` 实际编译为 `strategy-report.md`。
2. continuation-only report 回退
   - 命令：`npx vitest run "src/agent/turn/TurnRunner.capabilityScope.test.ts"`
   - 隔离夹具后的结果：1 failed / 3 passed。
   - 失败原因：已有未完成 report SDM 时发送“继续”，真实 TurnRunner 路径得到 `consultation`，期望 `report`。
3. shadow 缺少观测
   - 命令：`npx vitest run "src/agent/turn/TurnRunner.capabilityScope.test.ts"`
   - 结果：1 failed / 4 passed。
   - 失败原因：legacy 行为仍正确，但 `capability_scope_shadow` 事件数为 0，期望 1。
4. `<task-resume>` 污染
   - 命令：
     - `npx vitest run "tests/saas/capability-scope-v2.test.ts"`
     - `npx vitest run "src/agent/turn/TurnRunner.capabilityScope.test.ts"`
   - 结果分别为 1 failed / 8 passed、1 failed / 5 passed。
   - 失败原因：无既有 SDM 时，内嵌“生成战略报告”的 `<task-resume>` 被当作当前 report 意图并创建合同。

以上均为对应生产代码修改前取得的产品 RED；其中 continuation 测试第一次使用了带“不要生成文件”的新咨询文案，该文案本身命中了旧输出正则，随后改为无输出词的纯咨询文案以隔离“是否继承旧会话状态”这一单一变量，该次夹具噪声不计作产品 RED。

### 本轮 GREEN 与最终验收

- `npx vitest run "tests/saas/capability-scope-v2.test.ts" "src/agent/turn/TurnRunner.capabilityScope.test.ts" "tests/agent/validate-deliverables-capability-scope.test.ts" "src/telemetry/stabilityEvents.test.ts" "src/saas/resilience/stabilityFlags.test.ts"`：30/30 通过。
- `node --test "scripts/lib/capability-scope-config.test.mjs"`：3/3 通过。
- `npm run test:sdm:unit`：53/53 通过。
- `npm run test:task-continuation-policy`：42/42 通过。
- `npm --workspace ui run test -- "src/shared/collectFinalDeliverables.test.ts" "src/shared/collectFinalDeliverables.capabilityScope.test.ts"`：19/19 通过。
- `npm run test:export-four-line-parity`：46/46 通过。
- 本轮最终批次合计 193/193 通过，0 failed。
- `npx tsc -p "tsconfig.json" --noEmit`：通过。
- 编辑文件 IDE lint：无诊断。
- `npm run check:saas-fork`：559/559 manifest 条目通过。
- `git diff --check`：exit 0；仅输出工作树既有 LF/CRLF 转换提示。

### 本轮文件清单

新增：

- `src/saas/intent/capabilityScopeShadowTelemetry.ts`
- `src/agent/turn/TurnRunner.capabilityScope.test.ts`（本任务此前新建，本轮继续补测）
- `tests/saas/capability-scope-v2.test.ts`（本任务此前新建，本轮继续补测）

修改：

- `src/saas/intent/capabilityCompletionMode.ts`
- `src/saas/taskState/taskGoalContract.ts`
- `src/saas/taskState/sessionDeliverableManifest.ts`
- `src/session/transcript/bootstrapSessionDeliverableManifest.ts`
- `src/agent/turn/TurnRunner.ts`
- `src/saas/deliverableCapabilityProfiles.ts`
- `src/saas/resilience/stabilityFlags.ts`
- `src/telemetry/stabilityEvents.ts`
- `config/pilotdeck-core-fork.manifest.json`
- `.superpowers/sdd/task-p0-1-capability-scope-report.md`

### 本轮 Concerns

1. 按用户约束未重启 dev 服务，因此未在重新加载本轮代码后的真实 Gateway 上执行 Korea K3/K3L live；确定性 TurnRunner、SDM、配置与 Korea fixture 门禁均已通过。
2. 全量 UI TypeScript 基线噪声仍沿用原报告结论；本轮未修改该范围，目标 UI 测试与 IDE lint 均通过。
3. 未提交、未清理/回退工作区、未修改计划或 `ui/src/generated/`。

## 复审 Important 补充：明确产出动词（2026-07-19）

### 状态

`DONE_WITH_CONCERNS`

已最小补齐 `ala-strategy-advisor` 的“产出/导出/交付”明确输出语义；未改变 consultation 负向边界、裸 basename 单槽规则、三态开关或 frozen SDM guard。

### TDD RED

1. completion mode 参数化 RED
   - 命令：`npx vitest run "tests/saas/capability-scope-v2.test.ts"`
   - 结果：4 failed / 9 passed（共 13）。
   - 四个预期失败：
     - `产出一份战略报告`：实际 `consultation`，期望 `report`。
     - `产出 competitor.md`：实际 `consultation`，期望 `report`。
     - `导出 competitor.md`：实际 `consultation`，期望 `report`。
     - `交付 competitor.md`：实际 `consultation`，期望 `report`。
2. SDM basename 参数化 RED
   - 在生产代码修改前补充三种 basename 合同断言后，重跑同一命令。
   - 结果：7 failed / 9 passed（共 16）。
   - 新增三个预期失败：`产出/导出/交付 competitor.md` 均实际 fallback `strategy-report.md`，期望单槽 `competitor.md`。

### 最小实现

- `src/saas/intent/capabilityCompletionMode.ts`
  - 报告/文件输出动词补入“产出”。
  - 明确 basename 输出动词补入“产出/导出/交付”。
- `src/saas/taskState/taskGoalContract.ts`
  - 同步扩展既有 `extractExplicitBasenames` 动词集合，继续由原 TaskGoalContract → SDM 管线生成单槽，不新增合同源。
- `tests/saas/capability-scope-v2.test.ts`
  - 新增四类 mode 参数化测试及三类 basename 参数化测试。
  - 原有“需要了解竞品文件”“给我看看竞品文件”“分析附件 input.pdf”负向 consultation、裸 `competitor.md` 单槽测试继续同批执行。

### GREEN 与回归

- `npx vitest run "tests/saas/capability-scope-v2.test.ts"`：16/16 通过。
- `npx vitest run "src/agent/turn/TurnRunner.capabilityScope.test.ts" "tests/agent/validate-deliverables-capability-scope.test.ts"`：7/7 通过。
- `npm run test:sdm:unit`：53/53 通过。
- `npm run test:task-continuation-policy`：42/42 通过。
- `node --test "scripts/lib/capability-scope-config.test.mjs"`：3/3 通过。
- `npm --workspace ui run test -- "src/shared/collectFinalDeliverables.capabilityScope.test.ts"`：1/1 通过。
- `npm --workspace ui run test -- "src/shared/collectFinalDeliverables.test.ts"`：18/18 通过。
- `npm run test:export-four-line-parity`：46/46 通过。
- 本轮 fresh test 合计：186/186 通过，0 failed。
- `npx tsc -p "tsconfig.json" --noEmit`：通过。
- 编辑文件 IDE lint：无诊断。
- `npm run check:saas-fork`：559/559 条通过。
- `git diff --check`：exit 0，仅有工作树既有 LF/CRLF 转换提示。

### 文件清单

- `src/saas/intent/capabilityCompletionMode.ts`
- `src/saas/taskState/taskGoalContract.ts`
- `tests/saas/capability-scope-v2.test.ts`
- `.superpowers/sdd/task-p0-1-capability-scope-report.md`

### Concerns

1. 按约束未重启 dev 服务，未执行真实 Gateway live。
2. 未提交、未修改计划、未清理/回退既有工作区。
