# 媒体相关 MCP 接入指南（P1）

按业务优先级逐个落地：**Firecrawl** → **Postiz** → **Figma**。

## 通用步骤

1. 设置 → **MCP 服务器** → 添加 HTTP/SSE 或 stdio 服务器
2. 填写对应 API Key / Token（见下表）
3. 保存并重启 Gateway
4. 运行 `npm run smoke:mcp-p1` 检查配置模板与 catalog 条目

## Firecrawl

| 项目 | 值 |
|------|-----|
| 用途 | 网页抓取、调研、GEO |
| 环境变量 | `FIRECRAWL_API_KEY` |
| Hub 能力 | `fc-firecrawl-*`、`mcp-firecrawl` |
| MCP 类型 | 官方 HTTP MCP（见 Firecrawl 文档） |

示例 MCP 配置（JSON，按 Cursor/PilotDeck MCP 面板格式调整）：

```json
{
  "firecrawl": {
    "url": "https://mcp.firecrawl.dev/{FIRECRAWL_API_KEY}/v2/mcp"
  }
}
```

## Postiz

| 项目 | 值 |
|------|-----|
| 用途 | 海外社媒发布 |
| 认证 | Bearer Token |
| Hub 能力 | `mcp-postiz` |
| 备注 | P0 外部整合项，需 Postiz 实例 URL |

## Figma

| 项目 | 值 |
|------|-----|
| 用途 | 设计协作、读稿 |
| 环境变量 | `FIGMA_TOKEN` |
| Hub 能力 | `mcp-figma` |
| 工具前缀 | `mcp__figma__*` |

本地 smoke（可选）：`MEDIA_SMOKE_SKIP_FIGMA=0 node scripts/integration-media-smoke.mjs`

## 故障排查

- MCP 工具未出现在 Agent：检查 Gateway 日志、MCP 服务器 `enabled: true`
- 401：Key/Token 未注入 `buildRuntimeEnv` → 用能力接入中心或 `customEnv` 写入
- Firecrawl 限流：降级为 `web_fetch` + 说明
