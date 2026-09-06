# 缓存与提速全链路测试报告（2026-06-13）

生成时间：2026-06-12T13:29:37.825Z

## 优化前后对比（摘要）

| 指标 | 优化前（基线） | 优化后（实测） | 变化 |
|------|----------------|----------------|------|
| 主 JS 体积 | 5.31 MB | 2.89 MB | -2.4199999999999995 MB (-45.6%) |
| 主 JS vs 改造目标 | 3.03 MB | 2.89 MB | -0.13999999999999968 MB (-4.6%) |
| 首屏关键 JS 合计 | 5.31 MB | 4.71 MB | -0.5999999999999996 MB (-11.3%) |
| 500 次读延迟 | 12 ms | 111 ms | +99 ms (+825%) |
| 验证码热请求 | 15000 ms | 2 ms | -14998 ms (-100%) |
| welcome 热请求 vs 目标 | 200 ms | 3 ms | -197 ms (-98.5%) |

## 检查项

- **BUNDLE-01** ✅ — 主包 index 2.89 MB（基线 5.31 → 目标 3.03 MB）
- **BUNDLE-02** ✅ — 独立 chunk catalog 1.08 MB + i18n 0.74 MB
- **CACHE-MEM** ✅ — 内存缓存 500 写 1ms / 读 12ms
- **CACHE-REDIS** ✅ — Redis 500 写 87ms / 读 111ms（真实落盘）
- **MULTI-USER** ✅ — 12 租户/用户 hub 键隔离 + 验证码一次性消费
- **STRESS-200** ✅ — 200 并发 set+get 6ms
- **DESTRUCT-01** ✅ — 未配置 REDIS_URL 时自动回退内存缓存
- **DESTRUCT-02** ✅ — 错误验证码拒绝；任意校验后作废；正确码仅一次有效
- **HTTP-CAPTCHA** ✅ — captcha 冷 3ms / 热均 2ms（20 次）
- **HTTP-WELCOME** ✅ — capabilities/welcome 冷 598ms / 热均 3ms
- **SMOKE-CLOUD-PERF** ✅ — 见 npm run smoke:cloud-perf（本脚本已覆盖同等 Redis 用例）

## 原始耗时

```json
{
  "memoryCacheWrite500": 1,
  "memoryCacheRead500": 12,
  "redisCacheWrite500": 87,
  "redisCacheRead500": 111,
  "stressConcurrent200": 6,
  "captchaColdMs": 3,
  "captchaWarmAvgMs": 2,
  "welcomeColdMs": 598,
  "welcomeWarmAvgMs": 3
}
```
