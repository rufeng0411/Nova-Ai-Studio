# P0-6 官方素材预算、FSM 与工具硬约束实施报告

## 结论

**DONE**

P0-6 已完成。官方素材任务现在由同一套跨 turn、跨子代理共享的 FSM 管理发现、本地化和占位预算；`goalToolPolicy` 在权限钩子前拦截 shell、MCP、`generate_image` 与未绑定子代理逃逸，并在权限/生命周期改写输入后再次执行路径校验。

## 已实现

- `officialMediaFallbackStateMachine.ts`
  - 固定 `official_discovery → official_localize → official_ready` 顺序。
  - 官方素材失败后仅按合同进入 `placeholder_required` 或 `blocked`。
  - 预算按租户、用户、工作区、会话、任务目录和 `goalVersion` 绑定，跨 turn 复用。
  - 同阶段只允许一个 in-flight 尝试，避免并发结果互相覆盖状态。
- `goalToolPolicy.ts` + `ToolRuntime.ts`
  - enforce 模式仅开放受控工具集合。
  - 权限前拒绝 shell、MCP、`generate_image` 和未继承策略的子代理。
  - 权限/生命周期改写输入后重新执行策略、schema 和工具校验。
  - FSM permit 覆盖成功、失败、软失败与中断路径。
- `policyAwarePathGuard.ts`
  - `write_file`、`edit_file`、本地渲染、文档导出和图片合成全部锚定当前 task root。
  - 拒绝跨任务目录、远程图片热链、data URI 和未到 fallback 阶段的占位图。
- `officialMediaPlaceholder.ts`
  - 生成带机器标记的确定性本地 SVG。
  - 预算耗尽时仅注入一次模型侧恢复指令，并提供原样 SVG 内容。
- 策略与提示词
  - `mediaStrategyResolver.ts` 识别官方来源约束，不把“官方摄影风格”误判为官方来源。
  - `capabilityBindingPrompt.ts` 固定 `fetch_page_images → fetch_media_asset → write_file → render/export`。
  - enforce 的 official-only 任务关闭旧 `visualMediaDegradePolicy`，包括由恢复后的质量合同而非用户原句触发的场景。
- 继承与灰度
  - 子代理继承同一个 policy、scope、budget 对象，并用同一 allowlist 过滤 registry。
  - 单一开关 `PILOTDECK_OFFICIAL_MEDIA_V2=off|shadow|enforce`。
  - 本地开发默认 `shadow`；生产打包与云端套用默认 `off`。
- Fork 纪律
  - 所有核心改动保留 `PD-SAAS-FORK` 标记。
  - `config/pilotdeck-core-fork.manifest.json` 已登记 P0-6 条目。

## TDD 证据

新增测试先覆盖缺失模块与策略，再实现最小闭环；实施中又以失败用例捕获并修复：

1. ToolRuntime 未在权限前执行 goal policy。
2. 同阶段并发官方素材调用可同时取得 FSM permit。
3. 权限钩子可在首轮策略检查后把安全路径改写到其他任务目录。
4. official-only 约束来自恢复后的质量合同时，旧视觉降级仍可能介入。

上述用例均完成 RED → GREEN。

## 验收

- `npm run test:official-media:acceptance`
  - Node 测试：79 项通过，0 失败，2 项真实公网 smoke 按设计跳过。
  - 相对 P0-6 开始前的 62 项通过，新增 17 项通过。
  - TurnRunner 质量合同 Vitest：3 项通过。
  - 官方来源根配置校验通过。
- `npx tsc -p tsconfig.json --noEmit`：通过。
- AgentLoop/视觉降级回归：3 个文件、15 项通过。
- `npm run check:saas-fork`：629 条 manifest 记录通过。
- `git diff --check`：通过，仅有 Windows 工作区既有 LF/CRLF 提示。

## 约束遵守

- 未提交代码。
- 未启动或重启开发服务。
- 未修改 P0-6 brief/计划文件。
- 未执行上游拉取、合并或推送。

## 已知说明

完整验收中的两项真实公网 smoke 按测试设计保持 `SKIP`；其余本地、模拟网络、类型和 fork 门禁均执行，不构成实现阻塞。
