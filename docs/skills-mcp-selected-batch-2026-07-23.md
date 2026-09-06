# Skills 精选批次 Runbook（2026-07-23）

> **前置**：[`skills-mcp-hot-recommendations-2026-07-23.md`](./skills-mcp-hot-recommendations-2026-07-23.md)  
> **硬门禁**：P0-A overlay 绿 → 本文档存在 → `audit:skill-duplicates` → 用户明示后才 vendor  
> **禁止**：未经用户命令自动执行下列 `vendor:*`（AGENTS 硬规则）

---

## 1. 执行 Phase（依赖拓扑）

```
P0-A overlay → P0-B docs+dedupe → P0-C batch_upgrade_only → P0-D gate
  → P1-A 8 Tab taxonomy → P1-B 小批 vendor → P1-C 其余批次
```

| Phase | 状态（2026-07-23） | 出口门禁 |
|-------|-------------------|----------|
| P0-A `skillVendorOverlays` + `audit:skill-overlays` | ✅ 已落地 | overlay 0 missing |
| P0-B 两份 docs + dedupe | ✅ 本文档 + 推荐表 | docs 存在 |
| P0-C upgrade_only | ⏸ 待用户下令 vendor | 每包 bump 后立即 overlay |
| P0-D | ⏸ | `capabilities:gen` + hyperframes gate |
| P1-A 8 Tab media | ✅ taxonomy + UI | `smoke:capability-hub` 绿 |
| P1-B 三小批 | ⏸ 脚本已就绪 | 各批 smoke 绿 |
| P1-C 其余 | ⏸ 脚本已就绪 | 分批 smoke |

**回滚键**：`VITE_HUB_MEDIA_TAB=0` · overlay manifest git 还原 · vendor 目录按 `skills/vendor/*/ATTRIBUTION.md` 上一 commit

---

## 2. 批次一览（§18.4）

| 批次 | npm 命令 | 上游源 | 状态 |
|------|----------|--------|------|
| batch_upgrade_only ✓ | 见 §3 | 计划 §五 | 已有脚本 |
| batch_copy_rewrite_distill ✓ | `npm run vendor:copy-rewrite` | quill · avoid-ai-writing · anthropics/skill-creator | **脚本已建** |
| batch_paid_media_ops ✓ | `npm run vendor:paid-media` | claude-ads · cn-ads-skills | **脚本已建** |
| batch_media_planning ✓ | `npm run vendor:ooh-media` | tribo OOH · produce-ooh | **脚本已建** |
| batch_dev_quality ✓ | `vendor:superpowers` · `vendor:mattpocock` | obra · mattpocock | **脚本已建** |
| batch_browser ✓ | `npm run vendor:browser-agent` | agent-browser 等 | **脚本已建** |
| batch_frontend ✓ | `npm run vendor:frontend-skills` | shadcn 等 | **脚本已建** |
| batch_chinese_social ✓ | `npm run vendor:skill-hub-cn` | skill-hub | **脚本已建** |
| batch_content ✓ | `npm run vendor:baoyu` | baoyu-skills | **脚本已建** |
| batch_marketing_audit ✓ | `npm run vendor:marketing-audit` | squirrelscan 等 | **脚本已建** |
| batch_office_legal ✓ | `npm run vendor:office-legal` | lawvable · openai/plugins | **脚本已建** |
| batch_devops_security ✓ | `npm run vendor:devops-security` | trailofbits 等 | **脚本已建** |
| batch_video ✓ | `npm run vendor:video-coding` | remotion | 已有 |
| batch_video_shotcraft ✓ | `npm run vendor:video-shotcraft` | video-shotcraft | **脚本已建** |
| batch_crawl_stack ✓ | `npm run vendor:crawl-stack` | Scrapling | **脚本已建** |
| batch_knowledge_graph ✓ | `npm run vendor:graphify` | graphify | **脚本已建** |
| batch_superpowers_zh ✓ | `npm run vendor:superpowers-zh` | superpowers-zh | **脚本已建** |
| batch_immersive_web ✓ | `npm run vendor:scroll-world` | scroll-world | **脚本已建** |
| batch_research_studio ✓ | `npm run vendor:research-studio` | ResearchStudio | **脚本已建** |
| batch_design_stitch | — | Google stitch-skills | **待定 ⏸** |
| media Tab taxonomy | — | 无 vendor | ✅ 已落地 |

---

## 3. batch_upgrade_only（P0-C）

```bash
npm run vendor:skills-ecosystem
npm run vendor:firecrawl
npm run vendor:marketing
npm run vendor:html-ppt
npm run vendor:video-coding
node scripts/vendor-anthropics-docx.mjs
npm run audit:skill-overlays
npm run capabilities:gen
npm run smoke:skills-batch
```

---

## 4. HyperFrames bump 专项

1. overlay manifest 已含 hf NOVA-EXEC  
2. `vendor:video-coding` 末尾自动 `applySkillOverlays(['hf-*'])`  
3. 回归：

```bash
npm run test:hyperframes:unit          # ✅ 2026-07-23 10/10
npm run test:hyperframes:gate
npm run test:hyperframes:official:verify
```

---

## 5. P1-B 小批（用户下令后）

### batch_copy_rewrite_distill ✓

`npm run vendor:copy-rewrite` → `capabilities:gen` → `smoke:skills-batch`

### batch_paid_media_ops ✓

`npm run vendor:paid-media` — 扩展 `mkt-ads`，媒体 Tab 数字步骤 3/6

### batch_media_planning ✓

`npm run vendor:ooh-media` — 仅户外；produce-ooh 须 SPDX 审查

---

## 6. openai/skills → plugins（office_legal）

- **openai/skills 整包 deprecated** → 仅 cherry-pick **openai/plugins**  
- 弃 **playwright-interactive** → **microsoft/playwright-cli**  
- lawvable 大包 hidden + 免责声明代表卡

---

## 7. batch_design_stitch — **待定**

Google stitch-skills + MCP：**不纳入默认 vendor**；用户确认后再建脚本。

---

## 8. 每批 post-vendor 检查

1. `audit:skill-overlays`  
2. `capabilities:gen`  
3. `check:capabilities-i18n-zh`  
4. `smoke:skills-batch`  
5. taxonomy + try-prompt 门禁
