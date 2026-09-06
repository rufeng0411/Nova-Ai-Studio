# 对话稳定性与五入口交付统一全链路验收

- 时间：2026-07-09T07:10:19.400Z
- Suite：historical
- 矩阵：通过
- 结果：14/15 场景通过

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
| PPT 能力只交 HTML 或脚本 | 失败 | `npx vitest run src/saas/taskState/taskGoalContract.test.ts tests/saas/final-acceptance.test.ts`<br>`node --import tsx --test tests/agent/validate-deliverables-engine.test.ts` |
| Nova 幻灯图集跨 deck 串台 | 通过 | `node --test ui/shared/deliverableLinkContract.test.mjs` |
| 北京 AI 调研报告长任务 recovery | 通过 | `npx vitest run tests/saas/task-continuation-policy.test.ts tests/saas/final-acceptance.test.ts` |
| 视频分镜包缺三件套或 response 不收敛 | 通过 | `npx vitest run src/saas/taskState/taskGoalContract.test.ts` |
| React/Remotion 视频模板把过程脚本当成果 | 通过 | `npm --workspace ui run test -- src/shared/validateDeliverables.test.ts src/shared/deliverableDisplayPolicy.test.ts` |
| Open Design / 设计 HTML 多页面成果 | 通过 | `npm --workspace ui run test -- src/shared/collectFinalDeliverables.test.ts` |
| 文档导入、OCR、导出链路中断 | 通过 | `npx vitest run tests/saas/task-continuation-policy.test.ts` |
| 能力中心试一下错误引用历史成果 | 通过 | `npm --workspace ui run test -- src/shared/capabilityTryReferences.test.ts src/shared/capabilityTryBridge.test.ts src/shared/capabilityTryPrompt.test.ts` |
| 流程模板分阶段 write_file 约束失效 | 通过 | `npm run smoke:templates` |
| 第三方 skill 缺配置 | 通过 | `npx vitest run tests/saas/task-continuation-policy.test.ts src/saas/taskState/taskExecutionStateMachine.test.ts` |
| 跨 turn 同类硬失败连续 3 次快停 | 通过 | `npx vitest run tests/saas/user-action-blocker-streak.test.ts tests/saas/clarification-gate.test.ts` |
| 工具写盘成功但正文未报路径 | 通过 | `npx vitest run ui/src/shared/reconcileTurnDeliverables.test.ts` |
| 多 kind 任务单一 kind 数量不足 | 通过 | `npx vitest run src/saas/taskState/taskGoalContract.test.ts tests/saas/final-acceptance.test.ts` |

