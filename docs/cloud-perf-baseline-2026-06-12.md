# 云端首访性能基线（2026-06-12）

单机 ECS（Nginx → Express :3001 → Gateway :18789）本地构建产物测量，供提速改造前后对比。

## 静态资源（`ui/dist` 构建后）

| 资源 | 体积 | 说明 |
|------|------|------|
| `assets/index-*.js` | **~5.31 MB** → **~3.03 MB**（改造后） | catalog/i18n 已拆至独立 chunk |
| `assets/capabilities-catalog-*.js` | **~1.14 MB** | 与主包并行加载 |
| `assets/capabilities-i18n-*.js` | **~0.77 MB** | Hub i18n 独立 chunk |
| `assets/AuthHeroShowcase-*.js` | **~2.3 KB** | 登录 Hero 路由级 lazy |
| `assets/vendor-codemirror-*.js` | ~0.64 MB | 按需路由，非首屏必载 |
| `assets/vendor-react-*.js` | ~0.03 MB | 已拆 chunk |
| `assets/index-*.css` | ~0.23 MB | 主样式 |

## 瓶颈归纳

1. **Nginx**：全量 `proxy_pass`，无 `gzip`、无 `proxy_cache` → 每次静态经 Node 转发。
2. **首屏 API**：`auth` → `projects`（Gateway listProjects + 会话聚合）→ `capabilities/welcome`（Gateway skillsList，**无服务端缓存**）。
3. **容器冷启动**：`docker-entrypoint.sh` 等 Gateway health 最长 **120s**；验证码等为进程内存 Map。
4. **前端**：`i18n/config.js` 首屏即 `GET/PUT /api/config`；`PluginsContext` 挂载即扫 `/api/plugins`。

## 改造后验收指标（目标）

| 指标 | 基线 | 目标 |
|------|------|------|
| `/assets/*` 二次 TTFB | Node 全链路 | Nginx `X-Cache-Status: HIT` 或浏览器 disk cache |
| 首访 JS 传输 | ~5.3 MB 明文 | gzip 后 ~1.2–1.8 MB |
| `/api/capabilities/welcome` 二次 | 每次 Gateway | Redis HIT &lt;200ms |
| 容器 restart 后 captcha | 最长 120s 风险 | warmup 后 &lt;15s |

## 测量命令（现网复用）

```bash
# 静态 TTFB + 体积
curl -sI -w "ttfb=%{time_starttransfer} size=%{size_download}\n" -o /dev/null \
  "https://YOUR_DOMAIN/assets/index-XXXX.js"

# 二次请求看缓存
curl -sI "https://YOUR_DOMAIN/assets/index-XXXX.js" | grep -iE 'cache|encoding'

# 冷启动
docker compose restart nova
time curl -sf "http://127.0.0.1:3001/api/saas/captcha"
```
