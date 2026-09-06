# 企业合规 · 中央政策 MCP 安装说明

## 结论

| 对象 | 是否 MCP | 处理 |
|------|----------|------|
| **China-Central-Policy-MCP**（`guangxiangdebizi/China-Central-Policy-MCP`） | 是 | 首包装入示例模板；运行时经**后台 MCP 标准路径**配置 |
| Handaas Policy / Bidding MCP | 是（商用） | **首包不装** |
| 政府网 / 部委 / 31 省惠企 URL 表 | **否** | 用 `web_search` / `web_fetch` /（可选）Firecrawl；**不要**注册成 MCP |

## 标准安装（管理员）

1. 本地准备上游仓：
   ```bash
   git clone https://github.com/guangxiangdebizi/China-Central-Policy-MCP.git
   cd China-Central-Policy-MCP
   npm install && npm run build
   ```
2. 打开 **后台 → 平台设置 → MCP**（或编辑运行时 `~/.pilotdeck/mcp.json`，权限建议 `0o600`）。
3. 追加服务器键名 **`cn-central-policy`**，形态对齐 [`products/_example/config/mcp.json.example`](../products/_example/config/mcp.json.example)：
   - `command`: `node`
   - `args`: `[ "<绝对路径>/China-Central-Policy-MCP/build/index.js" ]`
4. **重启 Gateway** 后，对话侧应出现 `mcp__cn-central-policy__*` 工具（上游工具名以该仓 README 为准：`get_latest_policies` / `get_policy_fulltext`）。
5. Hub 卡：`mcp-cn-central-policy`、`comp-policy-search` 在未配置时标 `needs_config`；Agent 绑定允许降级联网检索公开 gov.cn，不阻断任务。

## 禁止

- 把「省惠企表」做成 31 个 MCP  
- 把政策 HTML 全文镜像进仓库  
- 用 Skill 目录假装 MCP  
- 提交本机 `~/.pilotdeck/mcp.json` 进 git  

## 验收

```bash
npm run smoke:mcp-p1
npm run capabilities:gen
npm run smoke:capability-hub
```

上游声明偏教学研究用途；生产启用前须自行完成合规审查与请求频率控制。
