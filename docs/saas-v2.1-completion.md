# SaaS 升级 v2.1 完成说明

**检查点标签:** `checkpoint/post-saas-v2.1`  
**还原点前:** `restore-point/pre-saas-2026-06-06` @ `3ca4dea`  
**完成日期:** 2026-06-06

## 已交付范围（Phase -1 ～ 3 + L5）

| 阶段 | 内容 | 验收 |
|------|------|------|
| Phase -1 | vitest 基线、LAN 端口、还原点 | `test:saas:preflight` |
| 阶段 0 | 三版 Sketch + chosen v1-native-slate | `test:saas:phase0` |
| 阶段 1 | 多用户 JWT、`/admin`、平台页占位、config 403 | `test:saas:phase1` |
| 阶段 2 | 验证码注册、订阅/积分、402 配额 | `test:saas:phase2` |
| 阶段 3 | 运营五大盘 + recharts | `test:saas:phase3` |
| 深度 | INV-* 不变量、租户隔离、deep-uat | `test:saas:deep` |
| L5 | 全量单测 + fork/brand + OSS P1–P4 + PW | `test:saas:acceptance` |

## 三层架构（已落地）

| 层 | 路径/机制 | 说明 |
|----|-----------|------|
| **平台共享** | `~/.pilotdeck`（Legacy Bridge） | skills、MCP、模型池、`pilotdeck.yaml` 全员共享 |
| **SaaS 壳** | `control.db` + `ui/server/saas/` | 登录、订阅、运营、租户表 |
| **租户私有** | `DATA_ROOT/tenants/{id}/projects/` | 项目与产物隔离；注册用户 `tenant-{username}` |

Gateway 进程仍为**单实例**；会话 transcript 等仍走全局 `~/.pilotdeck`（已知限制，见下文）。

## 本地命令

```bash
npm run dev:saas              # admin / admin123
npm run test:saas:deep        # 快速深度回归
npm run test:saas:acceptance  # 全量 L5
```

## 关键文档

- 验收清单：`docs/saas-acceptance-uat.md`
- 深度测试：`docs/saas-deep-test-report.md`
- 签核模板：`docs/saas-acceptance-signoff.md`
- 还原点：`docs/saas-restore-point.md`

## 已知限制与下一阶段

| 项 | 状态 | 说明 |
|----|------|------|
| Gateway `pilotHome` 按租户 | 未做 | 对话 transcript 未按租户分目录 |
| `feature_matrix` 套餐裁剪 | 未做 | 能力中心/流程模板尚未按套餐过滤 |
| `/admin/platform` YAML 编辑 | 占位 | 仅说明页，无可视化编辑 |
| 他机真机 LAN 首字 | 半自动 | PW `lan-login-chat` 覆盖本机 LAN URL；真机须手测 |
| 公网改密 | 人工 | 部署前修改 `admin` 默认密码 |
| AGPL / 定价 | 文档 | `docs/saas-feasibility-report.md` |

## 提交主线（SaaS）

```
checkpoint/post-saas-v2.1  ← 本检查点
c74f7b7 feat(saas): 深度测试与注册用户独立租户隔离
2c3b476 feat(saas): 平台配置页与非管理员 config 写入拦截
c32a489 feat(saas): 补齐租户隔离、对话配额与 OSS P1-P4 回归
8ec30f1 feat(saas): 落地 v2.1 Phase -1~3 与 L5 自动化验收
```
