# 爆款长文 Skill 全 A 复盘评分（2026-08-01）

对照源材料（Downloads 合辑 DOCX + 截图）与仓库「全 A」三原则复盘后补强。

## 审计缺口 → 已补

| 缺口 | 处置 |
|------|------|
| 缺 `style-registry` 索引 | 新增 `references/style-registry.md`（短索引，防连环读盘） |
| T1-1 缺结构模板 / 11 修辞 / 禁「这意味着什么」 | 写入 `style-t1-1.md`；L2 实机稿曾踩禁句，已入红线 |
| T1-2 缺结构模板 / 六讽刺 / 数据瀑布 | 写入 `style-t1-2.md` |
| brief/channel 无硬模板；channel 过长致 max_turns | SKILL + `channel-matrix`：≤800 字 + 停写铁律 |
| 源材料「请选择风格」违反禁问卷 | NOVA-EXEC 明示禁止；推荐模式直接开写 |
| 指定 full＜30/禁区原「硬拒」与全 A 交稿冲突 | 修订为 **软切换**仍交四文件 |
| 刘润误映射 T2-1 | `viralArticleStyleRouting` 改为 T1-6；吴晓波→T1-4 |
| 交付 5 项 vs SDM 四槽 | 结构说明+2 变体并入 `article-brief.md` |
| binding 未锁停写 | `capabilityBindingPrompt` 补同 turn 停写 / 禁句 |

## 评分表（Skills 全方位）

| 维 | 分 | 说明 |
|----|----|------|
| 质量·契约 | **A** | SDM `viral-article-pack` 四槽；不绑 matrix/flywheel |
| 质量·风格规范 | **A** | T1-1/T1-2 参数级齐全（生态位/结构/武器/红线/证据） |
| 质量·承诺诚实 | **A** | 禁 95%–99%/14 均可写；Hub 降承诺 |
| 速度·读盘 | **A** | 迷你红线内嵌；最多 +1 细则 |
| 速度·停写 | **A** | 四文件即停；channel≤800 |
| 体验·选风 | **A** | stub 软切换；混搭硬拒；禁问卷 |
| 兼容·蓝字/vendor | **A** | 加粗=蓝字；禁 vendor 权威 |
| 验收·L0/L1/L2 | **A** | 单测+Hub smoke+Gateway 四文件实机 |

**总评：全 A（方案 A 边界内）**  
未纳入：12 stub 升 full、作者独立 Skill、系列模式（计划明确不做）。

## 回归命令

```bash
npx vitest run src/saas/viralArticleStyleRouting.test.ts
npx vitest run src/saas/deliverables/deliverableChecklistAuthority.test.ts -t viral-article-pack
npx vitest run src/saas/taskState/sessionDeliverableManifest.test.ts -t viral-article-generator
npx vitest run src/saas/capabilityBindingPrompt.test.ts -t viral-article
npm run smoke:capability-hub
```
