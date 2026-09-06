# 技能生态升级 — 测试报告（2026-06）

> 执行时间：2026-06-10

## 一、自动化验收汇总

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 能力目录生成 | `npm run capabilities:gen` | **通过** — 967 项，missing=0 |
| 能力 smoke | `npm run smoke:capabilities` | **通过** — runtime 951 / catalog 967 |
| 分类审计 | `npm run smoke:capability-hub` | **通过** — flywheelEmpty=0，hub-filter failures=0 |
| 流程模板 | `npm run smoke:templates` | **通过** — 28 条（轻 8 / 标 13 / 全 7） |
| Fork 标记 | `npm run check:saas-fork` | **6 条缺注释**（已补 vendor/taxonomy/Card 注释，可重跑） |
| Nova 品牌 | `npm run brand:check` | **通过** |
| P2 UI 回归 | `ui-regression-check.mjs` | **通过** — 欢迎态、能力中心、ProviderHub |
| P3 成果预览 | `ui-artifact-preview-check.mjs` | **通过** |
| P1 白屏 | `check-white-screen.mjs` | **部分** — 5180 端口未监听（5173 主路径正常） |

报告产物：

- `artifacts/capabilities-smoke/report.json`
- `artifacts/capabilities-smoke/taxonomy-audit.json`
- `artifacts/capabilities-smoke/hub-filter-check.json`

## 二、新装技能冒烟（抽样）

| 类别 | 代表 slug | SKILL.md | Hub 子类 | 状态 |
|------|-----------|----------|----------|------|
| 润色 | humanizer, unslop | ✓ | 创作·润色 | 可用 |
| 办公官方 | anth-pptx, anth-xlsx | ✓ | 办公·幻灯/表格 | 可用 |
| 脑爆方法论 | pmd-swot-analysis, brainstorm-structured | ✓ | 脑爆·方法论 | 可用 |
| 营销 | mkt-claude-seo, mkt-aso-keyword-research | ✓ | 飞轮对应 Pill | 可用 |
| B 档 | fal-marketing, mkt-typefully-typefully | ✓ | needs_config | 需配置 |
| NanoBanana | create-nanobanana-ppt | ✓ | 可用（继承 Google Key） | 模型池有 Key 即亮 |
| 教育 | edu-sci-literature-review | ✓ | hidden（学术包） | 目录有、Hub 隐藏 |
| Stub | mkt-screenshots, dev-sentry-sdk-setup | ✓ stub | 按分类展示 | 可选 |

全量 967 项经 `smoke:capabilities` 校验：无 catalog 缺失、无空 stage/task_group。

## 三、B 档 Key 管理验证

| 步骤 | 预期 | 结果 |
|------|------|------|
| 未配 Key | 卡片 `needs_config` | 分类与 `availability` 字段已写入 catalog |
| ProviderHub「技能服务」分组 | fal/Typefully/VideoDB 等 7 项 | UI 已落地 `SkillServicesHubSection` |
| 保存配置 | `tools.skillServices.*.apiKey` 写入 yaml | 与 documentOcr 同路径 |
| 运行时 | `applySkillServicesRuntimeEnv` | 注入 FAL_KEY 等 |
| NanoBanana | 继承 Google 模型池 | `PILOTDECK_NANOBANANA_GOOGLE_KEY` 逻辑已加 |

**未做端到端实跑**（需用户填入真实 Key 后重启 Gateway 验证点亮）。

## 四、九条模板链路（结构 + 关联技能）

| 模板 | relatedSkills 在校验 | 结构 smoke | 实跑「试一下」 |
|------|---------------------|------------|----------------|
| T1 outline-ppt-video | ✓ | ✓ | 待人工（依赖 HyperFrames/ffmpeg） |
| T2 website-promo-video | ✓ | ✓ | 待人工 |
| T3 research-podcast | ✓ | ✓ | 待人工（播客 TTS） |
| T4 one-article-matrix | ✓ | ✓ | 待人工 |
| T5 data-story-video | ✓ | ✓ | 待人工（render_html_video） |
| T6 xhs-hit-factory | ✓ | ✓ | 待人工 |
| T7 meeting-to-deck | ✓ | ✓ | 待人工 |
| T8 doc-to-course | ✓ | ✓ | 待人工 |
| T9 persona-debate-article | ✓ | ✓ | 待人工（persona slug 已修正） |

`integration-process-templates-smoke.mjs` 全部通过；端到端产出需对话实跑（计划 10.2）。

## 五、删除/隐藏回归

| 检查 | 结果 |
|------|------|
| 已删 16 目录不再出现在 catalog | ✓ |
| `react-next-best-practices` hidden | ✓ |
| `mkt-competitors` 等 3 项 hidden | ✓ |
| `mkt-aso` hidden，`mkt-aso-*` 可见 | ✓ |
| `edu-sci-*` Hub 不展示 | ✓ hidden_in_hub 全局生效 |

## 六、星级 UI

| 位置 | 实现 | 自动化 |
|------|------|--------|
| 能力卡片 | `CapabilityCard` rating prop | 需 UI 目视 / embedded 弹层 |
| 模板卡片 | `ProcessTemplateGallery` | API `processTemplates.js` 透传 rating |

## 七、已知缺口与修复记录

1. **Vendor 7 项失败**：网络 SSL / 仓库 404 — 见修改报告表，stub 或保留历史目录。
2. **中文 i18n 覆盖**：389/967 有中文 display_name，其余仍显示 SKILL 英文名 — 建议下一批补 `capability-hub-zh.json`。
3. **phuryn pms-***：本次 clone 失败；若历史目录完整则脑爆方法论 Pill 仍有计数。
4. **P1 5180**：并发 dev 未起 5180，不影响 5173 主验收。

## 八、结论

- **结构验收：通过**（catalog、taxonomy、templates、capabilities smoke）。
- **B 档 Key：配置链路已通**，待真实 Key 点亮实跑。
- **九条模板：落库与校验通过**，端到端产出建议按 T1/T3/T5/T9 优先人工「试一下」各跑一轮。
