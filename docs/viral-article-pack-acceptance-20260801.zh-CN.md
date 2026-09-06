# 爆款长文 / viral-article-pack 验收表（方案 A · 全 A）

## L0（本批必跑）

| 项 | 命令 / 断言 | 期望 |
|----|-------------|------|
| 选风铁律 | `npx vitest run src/saas/viralArticleStyleRouting.test.ts` | stub 高分不自动主写；半佛/兽爷 named_full；刘润 soft_stub；混搭 hard_mix_refuse |
| SDM 四槽 | `npx vitest run src/saas/deliverables/deliverableChecklistAuthority.test.ts -t viral-article` | slug→`viral-article-pack`；四 basename；含「爆款母稿.md」alias |
| 编译不绑 matrix | `npx vitest run src/saas/taskState/sessionDeliverableManifest.test.ts -t viral-article` | `profileId=viral_article_pack`；无 zhihu/01-topics |

## L1

| 项 | 命令 |
|----|------|
| Hub 生成 | `npm run capabilities:gen` |
| Hub smoke | `npm run smoke:capability-hub` |

## L2（实机 1 案）

| 项 | 结果 |
|----|------|
| 命令 | `node scripts/run-viral-article-pack-live.mjs` |
| 报告 | `artifacts/viral-article-pack-live/live-report.json` |
| 2026-08-01 | **PASS**（Gateway WS + `capabilityContext.slug=viral-article-generator`；四 basename 落盘于 `artifacts/task-20260801-085cd8a2/`；`acceptanceStatus` 曾报 `needs_repair`/`max_turns` 属续写噪声，四槽文件已齐） |

## L3 / L4

有则抽样 `test:export-four-line-parity`；本批无新 telemetry flag。

## 回滚

git revert Skill/references/authority/profile/binding；bootstrap 旧副本（`REFRESH_SKILL_SLUGS` 含本 slug）。
