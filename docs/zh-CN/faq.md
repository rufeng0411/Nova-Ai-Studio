# 常见问题

## 为什么还要登录？

社区版保留 SaaS 内核。免登录的 `dev:standalone` 不会注入成果相关 flag，跟商用同步会分叉。

## 为什么没有注册？

个人版只有一个 `admin`。注册接口返回 403。

## 健康检查是哪个？

Bridge：`/api/saas/health` 与 `/api/saas/health/ready`。不是 `:8000/healthz`。

## 为什么是 AGPL？

通过网络提供服务时需要开放对应源码。见 LICENSE。
