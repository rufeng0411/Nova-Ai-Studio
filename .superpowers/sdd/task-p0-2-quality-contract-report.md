# P0-2 SessionGoalQualityContract 实施报告

## 状态

`IMPLEMENTED_WITH_BASELINE_TYPECHECK_CONCERN`

P0-2 已按简报实现：质量合同独立于 SDM，使用单独的
`qualityContractHashVersion=1`，可从 JSONL 幂等恢复，并在选中灰度时通过
联合 bootstrap barrier 于模型/工具执行前完成持久化和重读核对。

未提交、未重启、未修改计划、未触碰生成文件，也未清理或回退工作树中的
既有未提交改动。

## 实现结果

### 1. 独立质量合同

- 新增 `src/saas/constraints/goalQualityContract.ts`：
  - `subjectAnchor`、aliases；
  - 精确页数、内容数量、章节数、时长断言；
  - 官方素材策略、允许来源级别、占位策略；
  - `forbidGenerateImage` 与工具 allow/deny；
  - 用户明确约束 > launch context > exact capability policy >
    profile fallback；
  - canonical SHA-256 hash，排除 turnId、compiledAt 等非语义字段；
  - bounded contract 最大 4096 bytes。
- 新增 `officialMediaRequirement.ts`，覆盖 11 条鸣镝 fixture 中的官方来源
  语义，并明确排除“官方摄影风”误判。
- 新增 `capabilityScopeContract.ts` 和 `qualityCanaryPolicy.ts`，统一可信作用域、
  exact slug/tenant canary、off/shadow/enforce 与工具限制判定。
- 未向 `SessionDeliverableManifest` 增加任何质量字段；未修改
  `computeStableContractHashV2`。

### 2. JSONL 与联合 bootstrap

- 新增 `session_goal_quality_contract` transcript 行，包含：
  `goalVersion`、合同版本、hash 版本、canonical hash、bounded contract、
  `compiledAtTurnId`、`userGoalHash`。
- 正常写入顺序为：SDM append → quality append → transcript 重读 →
  goalVersion/hash/userGoalHash 核对。
- 支持仅 SDM 已写、仅 quality 已写、两条之间崩溃、重复启动和质量-only
  版本提升恢复。
- append、重读或版本核对失败时抛入 `TurnRunner` 既有
  `agent_transcript_error` 停止路径；测试确认模型循环未启动。
- 同一 `goalVersion` 已冻结后，即使 fallback policy 发生变化，非目标文本
  也不会改写合同或追加同版本新行。

### 3. 质量-only 版本和兼容性

- `detectGoalMutation` 仅对受限的质量 add/replace 提升共享 `goalVersion`。
- SDM 重发时 slot id、label、kind、count、pathHints 完全沿用冻结值。
- “继续”、`<task-resume>`、Recovery 文案、项目记忆不会生成新版本。
- 未增加 continuation/repair owner，未改变 `resolveContinuationAction`、
  0717 SDM/GT/repair 仲裁或 legacy complete。

### 4. Meta、灰度与可信 scope

- `turn_acceptance_meta` 的质量扩展仅包含 hash、effective mode 和无正文的
  bounded shadow diff。
- Bridge 仅从认证 ALS 上下文生成 tenant/principal；忽略客户端同名顶层字段。
- Gateway 用可信 `pilotHome` 验证 tenant；SessionRouter 固化 scope 并拒绝
  跨 tenant/principal 复用。
- scope 已透传至 TurnRunner、AgentLoop、ToolRuntime 和 subagent。
- standalone 固定为 `local/local`。
- dev 默认 shadow、pack 默认 shadow、cloud 默认 off；slug/tenant allowlist
  默认均为空，因此默认无人被选中，未默认开启 official media enforce。

### 5. 敏感信息与边界

- bounded contract 清理 HTTP(S) URL、Windows 路径、UNC 路径、POSIX 绝对路径、
  Authorization、Bearer/Basic、Cookie、Token、API key、secret 和 password。
- aliases、数量断言、工具名称数量和单项长度均受限。
- shadow diff 不含主体文本、完整目标、路径或合同正文。
- Jsonl 和 InMemory writer 均重新 bound 并计算 canonical hash；Jsonl writer
  拒绝调用方提供的错误 hash。

## TDD RED / GREEN 记录

1. 合同模型与 11 条 fixture
   - RED：`goalQualityContract.test.ts` 首跑报
     `Cannot find module './goalQualityContract.js'`。
   - GREEN：最小实现模型、官方素材识别、精确数量、canonical hash 和 bounded
     contract 后通过。

2. 质量-only goalVersion
   - RED：新增断言得到 `{ mutated: false }`，版本仍为 `undefined`。
   - GREEN：受限扩展 `detectGoalMutation`，SDM 仅提升版本并复制冻结 slots。

3. JSONL 联合 bootstrap
   - RED：首跑报
     `Cannot find module './bootstrapSessionGoalQualityContract.js'`。
   - GREEN：实现独立 transcript 行、正常顺序、两种 half-write 恢复、混合版本
     拒绝、append/reread fail-closed 和重复启动幂等。

4. TurnRunner 与可信作用域
   - RED：集成测试捕获到的 `trustedExecutionScope` 和
     `qualityContractMode` 为 `undefined`。
   - GREEN：完成 Bridge → Gateway → SessionRouter → AgentSession →
     TurnRunner → AgentLoop 的透传与 exact tenant canary。

5. bounded prompt、shadow diff 与 acceptance meta
   - RED：依次暴露
     `buildGoalQualityContractPrompt/buildBoundedQualityShadowDiff/`
     `buildQualityAcceptanceMeta is not a function`。
   - GREEN：实现 enforce-only bounded prompt、无正文 shadow diff 和最小 meta。

6. 灰度配置
   - RED：配置测试缺少质量合同三态开关和两个 exact allowlist。
   - GREEN：同步 dev、pack、cloud 脚本及配置测试。

7. 敏感绝对路径加固
   - RED：bounded 测试仍保留 `/srv/private`。
   - GREEN：补齐通用 POSIX 和 UNC 路径清理；23 项合同测试通过。

8. 同版本冻结
   - RED：状态询问加 fallback policy 变化导致同一 goalVersion hash 改变。
   - GREEN：无 SDM 版本变化时复用已持久化质量合同；恢复测试 8/8 通过。

9. 编译优先级补强
   - RED：结构化 launch context 被 exact policy 覆盖；用户显式 opt-out
     仍继承旧 aliases/source tiers。
   - GREEN：解析结构化质量字段，显式空数组覆盖低优先级值，并统一工具策略
     优先级。

## 最终验证

- `npx vitest run src/saas/constraints/goalQualityContract.test.ts src/session/transcript/bootstrapSessionGoalQualityContract.test.ts src/saas/taskState/detectGoalMutation.test.ts`
  - PASS：3 files，48 tests。
- `npm run test:sdm:unit`
  - PASS：7 files，60 tests。
- `npm run test:task-continuation-policy`
  - PASS：1 file，42 tests。
- `npx vitest run src/agent/turn/TurnRunner.goalQualityContract.test.ts`
  - PASS：1 file，3 tests；包含模型前 fail-closed 断言。
- `node --test scripts/lib/capability-scope-config.test.mjs`
  - PASS：3 tests。
- `npm run check:saas-fork`
  - PASS：575 个 manifest 条目全部验证。
- IDE diagnostics
  - PASS：P0-2 相关文件无诊断。
- `git diff --check`（相关路径）
  - PASS；仅输出仓库既有 LF/CRLF 转换提示，无 whitespace error。
- `npx tsc -p tsconfig.json --noEmit`
  - BLOCKED BY OUT-OF-SCOPE BASELINE：只报告
    `tests/tool/public-http-url-policy.test.ts:30` 与 `:91` 两个既有类型错误；
    全部位于本任务未修改文件，输出未包含任何 P0-2 文件错误。

## 自审

- 类型：质量合同、transcript、scope、mode 和 runtime context 使用显式类型；
  P0-2 文件无 IDE/tsc 报错。
- 持久化顺序：正常路径 SDM 先写、quality 后写、最后重读；任一步失败均在
  AgentLoop 前停止。
- 恢复幂等：重复启动不追加；两种 half-write 均补齐；同版本 fallback 漂移
  不改 hash。
- 敏感信息：持久层、prompt 和 meta 均经过 bounded/redaction；meta 不含正文。
- 既有兼容：P0-1 completion mode、exact capability canary 和 frozen SDM
  均保留；SDM/GT/repair 与 continuation owner 未改。

## Concerns

1. 全库 TypeScript 门禁仍被任务范围外的
   `tests/tool/public-http-url-policy.test.ts` 两个既有错误阻断；为保护用户
   工作树，本任务未擅自修改该文件。
2. 按“不重启”约束未启动 dev/Gateway 做运行态实机；模型前 barrier、租户
   canary 和 JSONL 恢复已由真实文件 I/O 与 TurnRunner 集成测试覆盖。
3. `enforce` 未默认开启；应先用空 allowlist 或精确 canary 观察 shadow
   metadata，再显式启用。
