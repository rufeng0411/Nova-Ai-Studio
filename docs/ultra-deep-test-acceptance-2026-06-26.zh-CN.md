# 超深度全链路验收报告（2026-06-26）

> 配套计划：[`docs/ultra-deep-test-plan-2026-06-26.zh-CN.md`](./ultra-deep-test-plan-2026-06-26.zh-CN.md)
> 执行环境：本机 `dev:saas`（server 7990 / gateway 18789 / vite 8081），全部稳定性 flag 在 dev 注入开启。

## 一、结论

- **计划全部完成**：P0（6 项）+ P1（4 项）+ P2（2 项）模块、单测、全链路 fixture、fork manifest、超深度测试计划文档均已落地。
- **深度套件全绿**：19 个门禁/套件执行通过；唯一非绿项 `LIVE-F09` 为本机缺 `0608` 演示数据（脚本自身标注「live-only 不阻断」），非代码缺陷。
- **测试中发现并修复 2 个真实缺陷**（详见第三节），均已加回归护栏，举一反三排查同类无第二处。
- 三大重点（对话稳定性 / 五入口一致性 / 任务交互正确性）均有专项门禁覆盖且通过。

## 二、深度套件执行结果

| # | 套件 / 门禁 | 命令 | 结果 | 关键指标 |
|---|---|---|---|---|
| 1 | 新增稳定性单测（P0/P1/P2 模块） | vitest（13 文件） | ✅ | 113 用例全过 |
| 2 | P0–P2 单元门禁 | `test:p0-p2:unit` | ✅ | 17 文件 / 133 用例 |
| 3 | P0–P2 集成编排 | `test:p0-p2:integration` | ✅ | 6 子脚本全 PASS（含 22 韧性用例） |
| 4 | 路线图自检 | `selfcheck:p0-p2` | ✅ | 全项达成 |
| 5 | 展示↔引擎对齐 | `test:display-engine-alignment` | ✅ | 通过 |
| 6 | 过程 UX | `test:process-ux` | ✅ | 8 + 14 用例 |
| 7 | 交付路径/五线 | `test:deliverable-paths` | ✅ | 6 碰撞 + 41 UI 用例 |
| 8 | 全链路对话稳定性矩阵 | `test:dialogue-stability:full-chain` | ✅ | 30 场景（含 6 新 P1/P2 安全场景） |
| 9 | 恢复来源拆解 | `test:recovery:breakdown` | ✅ | 报告生成 |
| 10 | 四线对齐审计（门禁） | `test:four-line-audit` | ✅ | 140 会话 / 430 turn，aligned 78.4% 过闸 |
| 11 | 能力中心分类 | `smoke:capability-hub` | ✅ | taxonomy ok / 0 failures |
| 12 | SaaS 云端存储（多租户隔离） | `test:saas:storage` | ✅ | 17/17（CLOUD-01~12 + 跨租户隔离） |
| 13 | SaaS 文件夹/侧栏/路径 | `test:saas:folder` | ⚠️ | 19/20（LIVE-F09 缺本机演示数据，非阻断） |
| 14 | 实时对抗 Playwright（活体 UI） | `test:dialogue-stability:adversarial` | ✅ | 修复后 passed（rootLen 23060 / composer 1） |
| 15 | 白屏门禁（活体 UI） | `check-white-screen.mjs /p/general` | ✅ | ROOT_LEN 8646，无 ErrorBoundary |
| 16 | barrel 漂移护栏（新增） | vitest | ✅ | 防再生白屏 |
| 17 | Fork manifest | `check:saas-fork` | ✅ | 402 条全验证 |
| 18 | Nova 品牌守卫 | `brand:check` | ✅ | 24 资产 / 28 文本守卫 |
| 19 | **GEO 全案实跑 KPI（活体引擎）** | `test:geo-replay:kpi` | ✅ | **9/9 交付，recovery=0，passed=true** |

## 三、测试中发现并修复的缺陷（举一反三）

### 缺陷 A（P0 · 严重）：UI 桶文件漏导出 → 全站白屏

- **现象**：活体对抗测试首跑 `passed:false`，`composerCount=0`、`rootLen` 仅 3002（ErrorBoundary 兜底页）。控制台报 `The requested module '/src/shared/userFacingErrors.ts' does not provide an export named 'isInfrastructureDisconnectMessage'`。
- **根因**：`ui/src/shared/userFacingErrors.ts` 是从引擎 `src/agent/errors/userFacingErrors.ts` **手工维护**的再导出桶；引擎已定义 `isInfrastructureDisconnectMessage` 且 `MessageRowV2.tsx` 已引用，但桶的再导出清单漏了它。这是**只在浏览器运行时**才暴露的 ESM 失败，引擎 `tsc` 与 Node fixtures 都抓不到。
- **修复**：在桶清单补回 `isInfrastructureDisconnectMessage` 一行（不切 `export *`，避免误扩 UI 暴露面——桶刻意省略了若干引擎内部导出）。
- **回归护栏**：新增 `ui/src/shared/userFacingErrors.barrel.test.ts`——静态扫描所有 UI 模块从该桶的具名导入，断言桶已全部再导出；任何未来漂移在 CI 即红。已核对：8 个引用文件的全部具名导入此前仅此 1 处缺失，其余均命中。
- **复跑验证**：活体对抗 `passed:true`，白屏门禁 `ROOT_LEN 8646` 正常挂载。

### 缺陷 B（中 · 门禁假阴/假阳）：GEO KPI 子进程丢失 tsx loader

- **现象**：`test:geo-replay:kpi` 报 `passed:false`，但交付明明 9/9、recovery=0；`durationMs` 还停留在上次的 520s。
- **根因**：`geo-replay-kpi-run.mjs` 用 `process.execPath`（裸 `node`）派生 `integration-geo-full-case-run.mjs`，而后者 `import ... .ts`，裸 node 抛 `ERR_UNKNOWN_FILE_EXTENSION` **在实跑前即崩**；KPI 于是读到**上一轮的陈旧报告**，造成「交付齐全却判失败」的误导。
- **修复**：派生改为 `node --import tsx ...`（与 `test:geo-full-case:run` 一致）。举一反三核查 `integration-storyboard-pack-run.mjs` 同样含 `.ts` 导入，但其活体校验脚本不经裸 node 派生，无此问题。
- **复跑验证**：实跑 14.75 分钟，`geoRunExitCode:0`、**9/9 交付、recovery=0、passed:true**。

## 四、三大重点覆盖映射

| 重点 | 覆盖门禁 | 状态 |
|---|---|---|
| **对话稳定性** | 全链路矩阵(30) · 活体对抗 · 白屏门禁 · 恢复拆解 · P0–P2 韧性 · GEO 实跑 recovery=0 | ✅ |
| **五入口一致性** | `test:deliverable-paths`(47) · 四线对齐审计 · saas:folder · saas:storage · barrel 护栏 | ✅ |
| **任务交互正确性** | P0–P2 单元(133)+集成(6) · completionGate/planLedger/verificationPass 单测 · task-continuation/clarification-gate/user-action-blocker · resume-context · GEO 9/9 | ✅ |

## 五、任务完成率 KPI（历史 JSONL 扫描基线）

- 扫描会话：153；交付型会话：51
- 总体干预率：**13.7%**；交付型干预率：19.6%
- 恢复空转率：**0.0%**（无空转恢复循环）
- 平均每会话用户干预：**0.25** 次

> 注：该 KPI 含修复前的历史会话，作为持续观测基线；生产侧 P1/P2 flag 默认 OFF，影响面受控。

## 六、残留与非阻断项

- `LIVE-F09`：本机 `general` 缺 `0608` 演示文件夹；隔离用例 FOLD-01~09 全过，脚本自身标注 live-only 不阻断。建议上线前在目标环境补种或忽略。
- `test:four-line-audit` 78.4% 为历史会话对齐度（过闸），非本次回归引入；属长期治理观测项。
- 临时日志 `dev-saas-deeptest.out.txt`、`geo-replay-kpi.out.txt` 为本轮抓取证据，未纳入交付。
