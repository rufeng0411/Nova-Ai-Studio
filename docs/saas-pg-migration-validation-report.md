# SaaS PostgreSQL 迁移后全链路验证报告

**生成时间:** 2026-06-24T09:00:44.342Z
**PostgreSQL 可达:** 是
**汇总:** 47 通过 / 0 失败 / 共 47 项

## 按后端统计

| 后端 | 通过 | 失败 |
|------|------|------|
| oss | 2 | 0 |
| sqlite | 21 | 0 |
| postgres | 24 | 0 |

## 明细

| ID | 分组 | 场景 | 后端 | 结果 | 说明 |
|----|------|------|------|------|------|
| OSS-01 | oss | 单机模式 isSaasMode=false | oss | PASS | no SAAS_MODE |
| OSS-02 | oss | 能力目录规模 | oss | PASS | slugs=1233 |
| INF-01 | infra | 控制库后端匹配 | sqlite | PASS | sqlite |
| INF-02 | infra | DB ping 成功 | sqlite | PASS | ping ok |
| ADM-01 | admin | 平台管理员 seed | sqlite | PASS | role=super-admin |
| ADM-02 | admin | auth/status SaaS 语义 | sqlite | PASS | saasMode=true |
| ADM-03 | admin | 管理员登录 | sqlite | PASS | JWT issued |
| ADM-04 | admin | 计划列表 | sqlite | PASS | count=3 |
| ADM-05 | admin | 管理员订阅 pro | sqlite | PASS | balance=5000 |
| ADM-06 | admin | 运营大盘聚合 | sqlite | PASS | users=1 |
| ADM-07 | admin | 用户列表含 admin | sqlite | PASS | rows=1 |
| MEM-01-alice | member | alice 注册+试用 | sqlite | PASS | tenant=tenant-alice |
| MEM-01-bob | member | bob 注册+试用 | sqlite | PASS | tenant=tenant-bob |
| MEM-02 | member | 重复注册拒绝 | sqlite | PASS | 409 |
| MEM-03 | member | 租户隔离（表级） | sqlite | PASS | tenant-alice != tenant-bob |
| MEM-04 | member | 项目目录隔离 | sqlite | PASS | alice=1 bob=0 |
| MEM-05 | member | 成员禁止写全局配置 | sqlite | PASS | 403 |
| MEM-06 | member | 积分耗尽 402 | sqlite | PASS | quota_exhausted |
| MEM-07 | member | 管理员充值后可消费 | sqlite | PASS | consume ok |
| MEM-08 | member | 用户偏好读写 | sqlite | PASS | projectContinuity=false |
| MEM-09 | member | 路由用量归属 | sqlite | PASS | tokens=120 |
| AUTH-01 | auth | JWT userId 可解析 | sqlite | PASS | id=2 |
| BRG-01 | bridge | Legacy skills 目录存在 | sqlite | PASS | C:\Users\rufen\.pilotdeck\skills |
| INF-01 | infra | 控制库后端匹配 | postgres | PASS | postgres |
| INF-02 | infra | DB ping 成功 | postgres | PASS | ping ok |
| ADM-01 | admin | 平台管理员 seed | postgres | PASS | role=super-admin |
| ADM-02 | admin | auth/status SaaS 语义 | postgres | PASS | saasMode=true |
| ADM-03 | admin | 管理员登录 | postgres | PASS | JWT issued |
| ADM-04 | admin | 计划列表 | postgres | PASS | count=3 |
| ADM-05 | admin | 管理员订阅 pro | postgres | PASS | balance=5000 |
| ADM-06 | admin | 运营大盘聚合 | postgres | PASS | users=1 |
| ADM-07 | admin | 用户列表含 admin | postgres | PASS | rows=1 |
| MEM-01-alice | member | alice 注册+试用 | postgres | PASS | tenant=tenant-alice |
| MEM-01-bob | member | bob 注册+试用 | postgres | PASS | tenant=tenant-bob |
| MEM-02 | member | 重复注册拒绝 | postgres | PASS | 409 |
| MEM-03 | member | 租户隔离（表级） | postgres | PASS | tenant-alice != tenant-bob |
| MEM-04 | member | 项目目录隔离 | postgres | PASS | alice=1 bob=0 |
| MEM-05 | member | 成员禁止写全局配置 | postgres | PASS | 403 |
| MEM-06 | member | 积分耗尽 402 | postgres | PASS | quota_exhausted |
| MEM-07 | member | 管理员充值后可消费 | postgres | PASS | consume ok |
| MEM-08 | member | 用户偏好读写 | postgres | PASS | projectContinuity=false |
| MEM-09 | member | 路由用量归属 | postgres | PASS | tokens=120 |
| AUTH-01 | auth | JWT userId 可解析 | postgres | PASS | id=2 |
| BRG-01 | bridge | Legacy skills 目录存在 | postgres | PASS | C:\Users\rufen\.pilotdeck\skills |
| MIG-01 | migration | SQLite→PG 迁移 | postgres | PASS | {"tenants":1,"users":1,"plans":3,"sessions":0,"subscriptions":1,"credit_wallet":1,"credit_ledger":1,"analytics_events":1,"usage_session_owner":0} |
| MIG-02 | migration | 迁移后 admin id/积分一致 | postgres | PASS | id=1 balance=100 |
| MIG-03 | migration | verify-only 二次校验 | postgres | PASS | verify-only |
