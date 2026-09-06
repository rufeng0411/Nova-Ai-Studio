# 全功能·全链路·全场景·多用户·超深度测试计划（Codex 级任务/对话稳定性）

- 版本：2026-06-26
- 适用范围：P0（fetch failed 隐形续跑 / 服务端冷恢复 / 多 owner 仲裁 / 退化熔断 / 空转预算 / 完成门）+ P1（计划账本 / 质量验收 / 工具看门狗 / 流式退化）+ P2（上下文压缩 / 校验子代理）全部稳定性能力。
- 设计原则：以 `TaskGoalContract` 与终验结果为唯一事实源；所有新行为均 **flag 默认 OFF**，开发栈注入 ON；测试既验证「开关 ON 的新行为」也验证「开关 OFF 回退旧行为」。
- 三大重点（按重要性排序）：① 任务交互正确性（最重要）② 对话稳定性 ③ 五入口一致性。

---

## 0. 目标与判据总览

| 维度 | 目标（预期效果） | 量化判据 |
| --- | --- | --- |
| 任务完成率 | 交付类任务一次走完不中断、不让用户帮排查 | `analyze:task-completion` 干预率不升、完成态不降；新增安全 fixture 全绿 |
| 对话稳定性 | 瞬态/断连自动续跑，用户零感知技术报错 | 可恢复轨 12 次/turn、硬失败 3 次快停；无英文报错气泡泄漏 |
| 五入口一致性 | 正文/成果面板/右栏/SuperPreview/前往文件夹 同一 `resolvedPath` | `test:four-line-audit --gate` 0 失配；`test:deliverable-paths` 全绿 |
| 多用户隔离 | 租户/用户/role 分组互不串台 | `projectsUpdateScopes`、catalog 跨 hub 解析单测全绿 |
| 安全回退 | 任一 flag=0 即回旧行为，部署零风险 | `stabilityFlags` 快照默认全 OFF；flag-off fixture 通过 |

---

## 1. 重点一：任务交互正确性（最重要）

任务交互正确性 = 「模型欲停时是否真的达成了用户目标；未达成时是否在三重封顶内自动补齐；达成后是否如实交付且路径正确」。

### 1.1 完成门 + 契约比对（H 闭环）

| 用例 | 输入 | 期望 | 验证 |
| --- | --- | --- | --- |
| 交付类·未达标欲停 | profile+goal 双命中、缺 1 文件即停 | 引擎接管补齐，不结束回合 | `completionGate.test.ts`、fixture `completion-gate-flag-off-and-triple-cap` |
| 闲聊·不被逼交付 | 脑爆/纯聊天 | 完成门不触发、不强产文件 | `completionGate.test.ts` 非交付分支 |
| 三重封顶 | 预算/空转/maxTurns 任一耗尽 | 停止修复、收尾，不重写风暴 | `completionGate.test.ts` cap 分支、`isCapExhaustionReason` |
| flag OFF 回退 | `PILOTDECK_COMPLETION_GATE=0` | 完全回旧行为 | `stabilityFlags.test.ts` + fixture |

### 1.2 计划账本（P1-A，有序步骤）

| 用例 | 期望 | 验证 |
| --- | --- | --- |
| 多文件全案派生有序步骤 | 按 `requiredFiles` 顺序，缺哪补哪 | `planLedger.test.ts` |
| 修复提示点名下一步 | 修复 prompt 追加「下一步：产出 X」 | `planLedger.test.ts` formatHint + fixture `plan-ledger-ordered-steps` |
| 计数类（8 屏+1 视频） | html=8 计数步独立于其他 kind | `planLedger.test.ts` count 步 |

### 1.3 空转预算（P0-5，内容指纹）

| 用例 | 期望 | 验证 |
| --- | --- | --- |
| 反复写同一文件同内容 | 指纹无变化→空转 nudge→terminal | `progressLedger.test.ts` + fixture `write-loop-progress-budget` |
| 正常迭代修订 | 内容变化算进展，不误杀 | `progressLedger.test.ts` |
| 重复同段思考 | 思考指纹重复计入空转 | `progressLedger.test.ts` |

### 1.4 终验质量（P0-4 退化熔断 + P1-D 质量验收）

| 用例 | 期望 | 验证 |
| --- | --- | --- |
| 表格行/段落复读上百次 | 判 `degenerate`→needs_repair | `degenerationGuard.test.ts` + fixture |
| 表格列数错乱 | 判 `low_quality`→needs_repair，软展示 | `qualityChecks.test.ts` + fixture |
| 结构齐全但正文空壳 | 判 `too_short`→needs_repair | `qualityChecks.test.ts` |
| 高阈值不误伤正常文档 | 正常表格/正文不触发 | `qualityChecks.test.ts`、`degenerationGuard.test.ts` |

### 1.5 校验子代理决策（P2）

| 用例 | 期望 | 验证 |
| --- | --- | --- |
| 终验通过+可核对契约+预算 | 决策一次独立复核 | `verificationPass.test.ts` + fixture |
| 终验未过 | 交给修复路径，不另开复核 | `verificationPass.test.ts` |
| 闲聊/无契约 | 不触发 | `verificationPass.test.ts` |

---

## 2. 重点二：对话稳定性

### 2.1 瞬态与断连（不报错、自动续跑）

| 用例 | 期望 | 验证 |
| --- | --- | --- |
| `fetch failed` 裸网络错 | 对用户隐形、引擎续跑 | `userActionBlocker.test.ts`、fixture `fetch-failed-invisible-autocontinue` |
| 鉴权/欠费 | 1 次即停、提示用户处理 | `userActionBlocker.test.ts` 硬失败分支 |
| 同类硬失败连发 | 3 次确认后快停 | `userActionBlockerStreakTracker` 单测 |
| 服务端冷恢复 | 幂等/预算/时效守卫，旧会话不自动续、崩溃不无限续 | `coldResumeGuard.test.ts`、fixture `cold-resume-idempotent-guard` |
| 流式复读 | 高阈值早停截断（flag OFF 不变行为） | `streamDegenerationGuard.test.ts` + fixture |

### 2.2 恢复预算双轨与防风暴

| 用例 | 期望 | 验证 |
| --- | --- | --- |
| 多 owner 仲裁 | 引擎为 owner，UI 去重，不叠乘重试 | `test:recovery:breakdown`、`taskResumeCoordinator.test.ts` |
| 可恢复轨 | 默认 12 次/turn 带退避 | `recoveryPolicy`/`RecoveryBudget` 单测 |
| 对抗场景 | 注入式异常不空转、直接文字兜底 | `test:dialogue-stability:adversarial` |

### 2.3 工具与上下文（P1-F / P2-E）

| 用例 | 期望 | 验证 |
| --- | --- | --- |
| 单工具挂起 | 按类别 deadline 产超时信号，不打断半写 | `toolWatchdog.test.ts` + fixture |
| 长任务上下文膨胀 | 折叠旧大 tool_result 省 token，可重读 | `toolResultCompaction.test.ts` + fixture |

---

## 3. 重点三：五入口一致性

五入口 = 正文可点链接、成果面板缩略/名称弹窗、右栏、SuperPreview、「前往任务所在文件夹」。

| 用例 | 期望 | 验证 |
| --- | --- | --- |
| 同一成果五处同 `resolvedPath` | 无裸名/无 GEO 扩写错位 | `test:four-line-audit --gate`、`test:deliverable-paths` |
| 多任务共用 hub | 不串台、`turnArtifactDir`/`hintDir` 锚定 | `test:display-engine-alignment` |
| 幻灯图集跨 deck | 独立 `slides-{deck_id}`、不 mtime 猜测 | fixture `nova-slides-cross-deck` |
| 成果分级软展示 | broken+resolvedPath 仍展示卡片 | `useValidatedDeliverables`/`reconcileTurnDeliverables` 单测 |
| 删除会话 | 行级删除、tombstone 不复活 | `integration-delete-resurrection-smoke` |

---

## 4. 多任务全链路流程测试（中途不暂停、不提问）

按「营销飞轮六阶段 + 办公 + 创作 + 开发 + 教育」串联，单会话连续多任务，验证项目连续记忆继承与成果不串台。

| 链路 | 任务序列 | 重点 |
| --- | --- | --- |
| 营销全案 | 调研→策划→创意→落地页→监测→汇总（六文件） | 第二轮只检查不重做、累计成果不丢、计划账本点名缺件 |
| GEO/AEO | 审计→优化稿→schema→可见性报告 | 多目录/裸名碰撞、四线对齐 |
| 幻灯交付 | 主题→PNG 图集+manifest→导出可编辑 PPTX | 画幅一致、不交 HTML/脚本充数 |
| 文档链 | 导入附件→OCR→导出 DOCX/PDF | 链路中断软续跑、二进制先 resolve |
| 视频模板 | 分镜三件套/Remotion | 过程脚本不进成果区、response 收敛 |
| 教育 | 学段子类任务 | 不被营销/办公门控误伤 |

全链路统一断言：`canAskUser=false`、`autoResume=true`、`repairOnlyMissing=true`、`emptySpin=false`、`sameResolvedPath=true`。覆盖矩阵由 `run-dialogue-stability-full-chain.mjs` 强校验（历史范例≥12、五大类、飞轮六阶段、流程模板、Skill 六类全覆盖）。

---

## 5. 多用户·并发·隔离测试

| 用例 | 期望 | 验证 |
| --- | --- | --- |
| 多租户文件根隔离 | 各租户 `cloud-storage/.../workspaces/{uuid}` 独立 | `test:saas:storage`（CLOUD-01~12）、`test:saas:folder`（FOLD-01~09） |
| `projects_updated` 分组广播 | 按 tenantId+userId+role 分组，不串台 | `projectsUpdateScopes` 单测 |
| 新建项目无感入栏 | 不需 F5、乐观插入+服务端失缓 | `test:saas:folder` 侧栏显示名 |
| catalog 跨 hub | orphan workspace 成果可解析 | `resolveDeliverableSearchRoots` 单测 |
| 普通用户 vs 管理员用量 | 普通仅本人、管理员可切全系统 | 用量路由单测 |

> 说明：CLOUD/FOLD 多用户云同步用例依赖 PG/SQLite 控制库与桥接服务。离线纯静态环境下取其离线断言子集；具备 dev:saas 时执行全量。

---

## 6. 执行分层与命令（L0→L4，由快到重）

| 层 | 目的 | 命令 | 阻断 |
| --- | --- | --- | --- |
| L0 | 类型与品牌/分叉门禁 | `tsc -p tsconfig.json --noEmit`、`brand:check`、`check:saas-fork` | 是 |
| L1 | 全部稳定性单测 | P0/P1/P2 模块 `vitest run` + `test:p0-p2:unit` | 是 |
| L2 | 五入口/显示引擎对齐 | `test:four-line-audit --gate`、`test:deliverable-paths`、`test:display-engine-alignment` | 是 |
| L3 | 全链路+对抗+恢复+KPI | `test:dialogue-stability:full-chain`、`test:dialogue-stability:adversarial`、`test:recovery:breakdown`、`analyze:task-completion`、`selfcheck:p0-p2` | 是 |
| L4 | 集成/多用户/能力中心 | `test:p0-p2:integration`、`smoke:capability-hub`、`test:saas:folder`、`test:saas:storage` | 环境具备时阻断 |

---

## 7. 失败处置与回归闭环（中途不暂停）

1. 任一层失败 → 定位根因（举一反三：路径规则/四线对齐/缓存失效/单测门禁系统性加固，禁止只修单点）。
2. 修复后 **从该层起回归**，向上重跑受影响层，直到该层全绿。
3. 全部层绿后跑一次 L0→L3 总回归，确认无横向回归。
4. 形成验收报告（表格对比 + 预期达成 + KPI），并登记 fork manifest / flag 快照。

## 8. 预期最终效果（达标定义）

- L0/L1/L2/L3 全绿；L4 在环境具备时全绿、否则离线子集全绿且环境依赖如实标注。
- 全链路矩阵 30+ 场景 100% 通过，覆盖矩阵校验通过。
- 任务完成率 KPI 不回退；五入口 0 失配；品牌/分叉门禁 0 失败。
- 所有新能力 flag=0 可瞬时回退旧行为，部署零风险。
