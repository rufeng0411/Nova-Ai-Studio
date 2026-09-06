# discover_visual_assets / DiscoveryPipeline 规格

## 目标

确定性多源搜图（无 LLM）：官网 URL → 权威站模板 →（可选）搜索图，本地化到 `assets/raw/`。

## DNS

`createOfficialMediaDnsResolver`：系统 DNS 优先，失败/非公网地址时 Cloudflare/Google DoH。

## 权威站

`config/visual-authority-sources.json`（`{subject}` 占位）。低质量源（book118 等）禁入。

## Soft-fail

单页失败记入 manifest.errors，不抛死；Agent 读 hint 继续。

## 验收

`tests/tool/discover-visual-assets.test.ts` + `npm run test:vap:unit`
