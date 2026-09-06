# 对话稳定性与五入口交付统一全链路验收

- 时间：2026-06-25T23:58:28.746Z
- Suite：all
- 矩阵：通过
- 结果：24/24 场景通过

## 覆盖率矩阵

- 历史事故范例：19/12
- 能力中心大类：creative、development、education、marketing、office
- 营销飞轮阶段：creative、monitoring、outreach、planning、publishing、research
- 流程模板：ad-storyboard-seedance、content-flywheel、geo-aeo-audit、geo-content-optimizer、legal-risk-quick、research-report、saas-demo-remotion-full、sales-battlecard-full、short-drama-seedance-pack
- Skill 类型：attachment_required、binary、external_key、local_no_key、multi_file、process_script

## 执行场景

| 场景 | 结果 | 命令 |
| --- | --- | --- |
| 吴裕泰 Campaign 全案累计成果丢失 | 通过 | `npx vitest run src/saas/taskState/taskDeliverableLedger.test.ts src/session/transcript/JsonlTranscriptWriter.ledger.test.ts`<br>`npx tsx --test tests/web/server/readSessionMessages.pagination.test.ts` |
| 雷蛇 GEO/AEO 多目录和裸名碰撞 | 通过 | `npm run test:display-engine-alignment` |
| PPT 能力只交 HTML 或脚本 | 通过 | `npx vitest run src/saas/taskState/taskGoalContract.test.ts tests/saas/final-acceptance.test.ts`<br>`node --import tsx --test tests/agent/validate-deliverables-engine.test.ts` |
| Nova 幻灯图集跨 deck 串台 | 通过 | `node --test ui/shared/deliverableLinkContract.test.mjs` |
| 北京 AI 调研报告长任务 recovery | 通过 | `npx vitest run tests/saas/task-continuation-policy.test.ts tests/saas/final-acceptance.test.ts` |
| 视频分镜包缺三件套或 response 不收敛 | 通过 | `npx vitest run src/saas/taskState/taskGoalContract.test.ts` |
| React/Remotion 视频模板把过程脚本当成果 | 通过 | `npm --workspace ui run test -- src/shared/validateDeliverables.test.ts src/shared/deliverableDisplayPolicy.test.ts` |
| Open Design / 设计 HTML 多页面成果 | 通过 | `npm --workspace ui run test -- src/shared/collectFinalDeliverables.test.ts` |
| 文档导入、OCR、导出链路中断 | 通过 | `npx vitest run tests/saas/task-continuation-policy.test.ts` |
| 能力中心试一下错误引用历史成果 | 通过 | `npm --workspace ui run test -- src/shared/capabilityTryReferences.test.ts src/shared/capabilityTryBridge.test.ts src/shared/capabilityTryPrompt.test.ts` |
| 流程模板分阶段 write_file 约束失效 | 通过 | `npm run smoke:templates` |
| 第三方 skill 缺配置 | 通过 | `npx vitest run tests/saas/task-continuation-policy.test.ts src/saas/taskState/taskExecutionStateMachine.test.ts` |
| 教育学习入口不被营销/办公门控误伤 | 通过 | `node --test scripts/lib/dialogueStabilityScenarioRunner.test.mjs` |
| 法务合规模板成果合同 | 通过 | `npm run smoke:templates` |
| GEO 内容优化模板成果合同 | 通过 | `npm run test:display-engine-alignment` |
| 短剧分镜流程模板多文件交付 | 通过 | `npx vitest run src/saas/taskState/taskGoalContract.test.ts` |
| 跨 turn 同类硬失败连续 3 次快停 | 通过 | `npx vitest run tests/saas/user-action-blocker-streak.test.ts tests/saas/clarification-gate.test.ts` |
| 工具写盘成功但正文未报路径 | 通过 | `npx vitest run ui/src/shared/reconcileTurnDeliverables.test.ts` |
| 多 kind 任务单一 kind 数量不足 | 通过 | `npx vitest run src/saas/taskState/taskGoalContract.test.ts tests/saas/final-acceptance.test.ts` |
| P0-1 fetch failed 对用户隐形并自动续跑 | 通过 | `npx vitest run src/saas/userActionBlocker.test.ts src/saas/resilience/stabilityFlags.test.ts` |
| P0-2 冷重连幂等/崩溃循环不无限续/旧会话不自动跑 | 通过 | `npx vitest run src/session/resume/coldResumeGuard.test.ts src/session/resume/buildTaskResumeContext.test.ts`<br>`npm --workspace ui run test -- src/components/chat-v2/hooks/useColdResumeInitiator.test.ts src/components/chat-v2/hooks/taskResumeCoordinator.test.ts` |
| P0-4 生成退化熔断（表格/段落复读） | 通过 | `npx vitest run src/saas/final-acceptance/degenerationGuard.test.ts` |
| P0-5 写循环空转预算（内容指纹判进展） | 通过 | `npx vitest run src/agent/loop/progressLedger.test.ts` |
| P0-6 完成门 profile+goal 双命中、三重封顶、flag 关闭回旧行为 | 通过 | `npx vitest run src/agent/loop/completionGate.test.ts src/telemetry/stabilityEvents.test.ts` |

