# P0-3：公网 URL、DNS、重定向、响应体与来源分级安全内核

## 目标

在官方素材链路启用前，建立统一的公网 HTTP 安全策略与来源分级内核。不得复用现有 `validateURL()` 作为公网安全校验。

## 必须实现

### 1. publicHttpUrlPolicy.ts

新建 `src/tool/builtin/web/publicHttpUrlPolicy.ts`：

- 通过 npm 添加 `tldts`，所有 registrable-domain/eTLD+1 比较统一使用 PSL
- 仅允许 `https`（`http` 先升级），拒绝凭据、非标准端口、localhost、单标签域名、私网/回环/链路本地/保留网段和云 metadata
- 请求前解析 A/AAAA 并校验全部地址，连接时使用受控 lookup 防 DNS rebinding；每次重定向重新校验
- 手动重定向，最多 5 跳；默认只允许同 host/www，跨 host CDN 必须来自已验证来源页中提取的直接 URL
- HTML 与图片均流式读取，先检查 Content-Length，再执行实际字节硬上限；HTML 默认 5 MiB

### 2. fetchPageImages 集成

修改 `src/tool/builtin/fetchPageImages.ts`：

- 复用 publicHttpUrlPolicy 与 `src/saas/resilience/outboundGate.ts`
- 禁止 `redirect:"follow"` 和无限 `response.text()`
- official 模式只向模型返回 candidateId、去 query 的 canonical URL、尺寸/类型线索和来源页；完整 URL 只在 bounded candidate registry 短驻留

### 3. pageImageUrls 扩展

扩展 `src/tool/builtin/web/pageImageUrls.ts`：提取 img/srcset/picture/og:image/twitter:image/link preload/application/ld+json 与 inline CSS background-image；过滤 default-zhanwei/loading/error/icon/logo-sprite；最多 40 候选

### 4. officialSourceClassifier

新建 `officialSourceClassifier.ts`（放在 `src/saas/media/` 或 `src/tool/builtin/web/`）：

- L0 来自用户显式 URL、平台 `official-source-roots` 注册表、或可信根反链
- 页面自报 Organization 不能单独升 L0
- CDN 素材只继承来源页等级

### 5. 注册表与 urlFetcher

- `config/official-source-roots.schema.json` + 校验/导入脚本（不写 G700 硬编码）
- `urlFetcher.ts`：official 媒体上下文强制 publicOnly；普通 web_fetch 保持 W7 语义

### 6. URL 去敏

新建统一 URL 去敏函数，durable tool-call/result、错误、telemetry 写盘前移除签名 query/凭据

### 7. 测试与 npm script

- 注册 `test:official-media:acceptance`（P0-3 起用，后续 P0-4~6 追加用例）
- 验收含：IPv4/IPv6 私网、metadata、DNS rebinding、302→内网、跨端口、凭据 URL、超跳、超大 HTML、gzip/内容长度欺骗

## 全局约束

- 不硬编码 G700 URL/域名
- 核心改动 PD-SAAS-FORK + fork manifest
- 严格 TDD；不提交、不重启、不改计划
- 保护既有工作树改动

## 必跑

- `npm run test:official-media:acceptance`
- 相关 unit tests
- `npm run check:saas-fork`

报告：`F:\Ai-pilotdeck\.superpowers\sdd\task-p0-3-media-network-security-report.md`
