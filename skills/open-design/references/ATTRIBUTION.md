# Attribution

本技能目录中的部分资源来自以下开源项目，按原许可与署名要求保留：

## Open Design

- Source: `https://github.com/nexu-io/open-design`
- License: Apache-2.0
- Reused in this migration:
  - 方法论与提示词思想（基于 `apps/daemon/src/prompts/*` 的蒸馏）
  - 共享设备框架（`assets/frames/*.html`）
  - 设计系统文档（`design-systems/*/DESIGN.md` 完整同步至 `references/design-systems/`，由 `scripts/sync-open-design-systems.mjs` 维护）
  - 部分技能模板与检查清单（`skills/*/assets/template.html` 与 `references/checklist.md`）
  - 2026-08-03 Batch B 精选场景：`design-templates/*` 与 `skills/deck-swiss-international`、`skills/card-twitter`、`skills/creative-director` 等意图摘要（Nova-fit 重写为 `skills/od-*`，STDA 落盘）
  - 模板影子目录：`config/open-design-template-registry.json`（仅元数据，Hub 不可见）

说明：

- 本仓库未直接搬运 Open Design 的 daemon/web/Electron 运行时实现。
- 本迁移仅将可复用的技能资源与方法论整合为 PilotDeck / Nova Ai-Studio 技能形态。
- **禁止**整包镜像官网模板市场；新增场景须走精选 Batch + `capabilities:gen`。

