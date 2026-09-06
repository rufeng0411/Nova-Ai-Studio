# P0-3 公网媒体网络安全实施报告

## 结论

状态：**DONE**

P0-3 已按 brief 完成。实现覆盖公网 URL、DNS 固定解析、重定向、响应体上限、官方来源分级、短驻留候选注册表、`fetch_page_images` / official `web_fetch` 接入，以及所有相关持久化入口的 URL 去敏。未提交代码、未重启服务、未修改计划文件，也未回退工作区其他改动。

## 实现范围

1. 公网 HTTP 安全内核
   - 新增 `src/tool/builtin/web/publicHttpUrlPolicy.ts`。
   - 通过 `tldts` 的 PSL 数据统一计算 registrable domain / eTLD+1。
   - HTTP 先规范化为 HTTPS；拒绝凭据、非 443 端口、localhost、单标签域名、云 metadata、IPv4/IPv6 私网、回环、链路本地和保留地址。
   - 请求前解析并校验全部 A/AAAA；把已验证结果注入受控 `lookup`，阻断二次解析导致的 DNS rebinding。
   - 所有重定向均手动处理并重新执行公网校验；最多 5 跳，默认仅允许同 host 与 `www` 别名。
   - HTML、图片和其他响应均先检查 `Content-Length`，再按实际流式字节执行硬上限；HTML 默认 5 MiB，图片默认 20 MiB。
   - 非有限或异常的重定向/字节配置不能关闭安全上限。

2. `fetch_page_images` 安全集成
   - 统一经过 `publicHttpUrlPolicy` 与 `OutboundGate`。
   - 不再使用自动重定向或无界 `response.text()`。
   - official enforce 模式只向模型暴露 `candidateId`、去 query 的 canonical URL、尺寸/类型线索和 canonical 来源页。
   - 完整 URL 仅保存在 session-scoped 内存注册表；默认最多 400 项、TTL 10 分钟，异常数值配置会回落到安全边界。
   - 普通模式继续返回既有 `images[]`，但网络入口同样受公网策略保护。

3. 页面图片候选提取
   - 扩展 `src/tool/builtin/web/pageImageUrls.ts`。
   - 覆盖 `img`、`srcset`、`picture/source`、Open Graph、Twitter、image preload、JSON-LD、inline CSS `background-image` 与通用图片 URL。
   - 过滤 `default-zhanwei`、`loading`、`error`、`icon`、`logo-sprite` 等占位/装饰资源。
   - 去重、排序并强制最多 40 项。

4. 官方来源分级与注册表
   - 新增 `officialSourceClassifier.ts`、`officialSourceRoots.ts`、JSON Schema、默认空注册表和校验/原子导入脚本。
   - L0 仅能由当前用户显式 URL、平台注册根或已验证 L0 根的直接反链建立。
   - 页面自报 Organization 不会提升等级。
   - CDN 素材只继承来源页面等级，不根据自身域名擅自升级。
   - 配置及测试不包含 G700、鸣镝或特定业务域名硬编码。

5. official `web_fetch`
   - `urlFetcher.ts` 增加 `publicOnly` 路径。
   - 仅在 `qualityContractMode=enforce` 且 `officialMediaPolicy` 非 `none` 时强制走公网安全内核。
   - 普通 `web_fetch` 保留既有 W7 重定向与缓存语义。

6. URL 去敏
   - 新增统一 `urlRedaction.ts`，移除 URL 内嵌凭据与 AWS、Google、OSS、CloudFront、SAS、token/signature 等签名 query。
   - JSONL durable tool-call/result、turn error 在写盘前去敏。
   - 超大工具结果由 `ToolResultBudget` 外置写盘前去敏。
   - stability/recovery/turn telemetry 与通用 telemetry queue 在写盘前去敏；通用遥测上传前再做防御性去敏。
   - official 候选对模型只输出完全去 query 的 canonical URL。

7. 信任上下文传递
   - `TurnRunner` 只从当前 accepted user input 提取最多 16 个公网 URL。
   - `AgentLoop`、工具上下文与 `SubAgentSession` 只继承这组已认证 URL，不从历史助手文本或子代理提示重新推导 L0。

8. 工程接入
   - `package.json` 与 `pnpm-lock.yaml` 已加入 `tldts@^7.4.9`。
   - 已注册 `test:official-media:acceptance`，聚合 P0-3 单元、集成、TurnRunner 传递与注册表校验。
   - 核心改动均有 `PD-SAAS-FORK` 标记，并已登记 `config/pilotdeck-core-fork.manifest.json`。

## 严格 TDD 记录

以下循环均先观察 RED，再写最小实现转为 GREEN：

1. 公网 URL/DNS/重定向/响应体策略
   - RED：`public-http-url-policy.test.ts` 首次运行报 `ERR_MODULE_NOT_FOUND`；随后超大 `Content-Length`、重定向上限等断言先失败。
   - GREEN：完成 URL/IP/PSL/DNS pinning/manual redirect/stream byte limit 后测试通过。

2. 页面语义图片提取
   - RED：新增语义 HTML、JSON-LD、CSS、占位过滤和 40 项上限断言时，旧实现缺少候选 API 与对应结果。
   - GREEN：实现统一候选提取、去重、评分和硬限制后通过。

3. 官方来源分级
   - RED：首次运行报 `officialSourceClassifier.js` 不存在；注册表规范化断言随后暴露 `includeSubdomains=false` 丢失。
   - GREEN：实现 L0 证据链、PSL 子域匹配、CDN 继承与完整布尔字段保留后通过。

4. URL 去敏
   - RED：首次运行报 `urlRedaction.js` 不存在。
   - GREEN：实现字符串、嵌套对象、durable message、turn error 与 stability telemetry 去敏后通过。

5. bounded candidate registry
   - RED：首次运行报 `officialMediaCandidateRegistry.js` 不存在。
   - GREEN：实现 session 隔离、TTL、容量淘汰和 canonical public view 后通过。
   - 补充 RED：`maxEntries=NaN` 时实测为 `401 !== 400`。
   - 补充 GREEN：异常容量/TTL 配置回落到默认安全边界，400 项与 10 分钟上限均通过。

6. official `fetch_page_images` / `web_fetch`
   - RED：新增测试先暴露未经过 OutboundGate、official 候选元数据缺失、私网 URL 未走新策略，以及 official `web_fetch` 未强制 `publicOnly`。
   - GREEN：完成上下文路由、公网 fetch、来源分级和候选注册后通过；普通 W7 回归保持通过。

7. 注册表配置与导入
   - RED：首次运行报 `import-official-source-roots.js` 不存在。
   - GREEN：实现 schema、运行时校验和临时文件原子替换后通过。

8. 所有持久化入口去敏
   - RED：新增测试实测超大 tool-result spill 与通用 telemetry queue 仍包含 `user:password`、`X-Amz-Credential`、`X-Amz-Signature`。
   - GREEN：在两个实际写盘边界接入统一去敏，5/5 持久化测试通过。

9. 安全上限不可绕过
   - RED：`maxRedirects=NaN` 与 `maxHtmlBytes=NaN` 均出现 `Missing expected rejection`。
   - GREEN：统一有限数值钳制后，五跳与 HTML 硬上限无法被异常参数关闭，12/12 策略测试通过。

## 最终验证

- `npm run test:official-media:acceptance`
  - Node TAP：47 项，45 passed，0 failed，2 skipped（仅环境门控的真实外网 smoke）。
  - Vitest：1 个文件、3 项 passed。
  - `check:official-source-roots`：version=1，roots=0，校验通过。
- `npx tsc -p "tsconfig.json" --noEmit`
  - 通过，0 错误。
- `npm run check:saas-fork`
  - 通过。
- P0-3 JSON 语法校验
  - `package.json`、fork manifest、schema、默认 registry 全部通过。
- IDE lints
  - 所有 P0-3 新增/修改 TypeScript 文件无诊断。
- `git diff --check`（P0-3 路径）
  - 通过；仅显示工作区既有的 Windows 行尾转换提示，无补丁空白错误。

## 非阻塞说明

- 默认 `official-source-roots.json` 有意保持空列表，避免把具体品牌或业务域名写死在代码库；生产启用平台根信任前，应通过导入脚本注入经审核的注册表。用户当前消息中显式提供的公网 URL 仍可建立 L0。
- 验收中的两个真实外网 smoke 按既有环境开关跳过；所有安全边界均由无网络依赖的确定性 DNS/fetch mock 覆盖。
