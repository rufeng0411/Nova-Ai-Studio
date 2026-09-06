# 全链路混合测试报告（SaaS + 单机）2026-06-08

测试目标：以多租户、管理员、单机模式三类角色，做多场景混合、多角度全链路回归；覆盖
已发生过的问题（数据串台、白屏、能力中心分类、fork 守卫）与预判风险（跨租户越权、
权限收敛、计费/用量隔离、改密），发现问题即修复并回归。

结论：**全部通过**。期间发现并修复 1 个历史遗留问题（能力目录 `hidden_in_hub` 计数 +
fork marker 丢失），其余均为预期行为。SaaS 与单机两条路径互不影响。

---

## 一、自动化回归套件

| 套件 | 命令 | 结果 |
| --- | --- | --- |
| SaaS 静态不变量 | `npm run test:saas:invariants` | PASS（4/4，能力 slug=362、legacy skills=341） |
| SaaS server 单测（vitest） | `npx vitest run server/saas`（ui 工作区） | PASS（12 tests，mode/paths/projectsIsolation 等） |
| SaaS node 原生单测 | `node --test usage/billing/analytics` | PASS（4/4，含按用户归属路由用量） |
| 深度隔离单测 | `node --import tsx --test tests/saas/deep-isolation-pilothome.test.ts` | PASS（2/2，同绝对路径不同租户互不可见） |
| Fork 守卫 | `npm run check:saas-fork` | PASS（修复后 47/47 全部验证） |
| 品牌守卫 | `npm run brand:check` | PASS（15 资产 + 25 文本守卫 + i18n 干净） |
| 能力中心分类 | `npm run smoke:capability-hub` | PASS（taxonomy ok、hub-filter failures=0） |

## 二、多租户 / 管理员 全链路 live（31/31 PASS）

针对运行中的 `dev:saas` 实例（admin + tenanttest + 新注册 tenantb，验证码自动求解）：

- **认证与角色**：admin=super-admin、tenanttest/tenantb=member、两者 tenant 不同、非法 token→403。
- **跨租户项目边界（Layer 1）**：
  - 读自己 general home → 200；空 projectPath 锚定 general → 200。
  - 读单机安装仓库根 `F:\Ai-pilotdeck` → **403**（不泄露单机数据）。
  - 租户 A 读租户 B 的 home → **403**（跨租户隔离）。
- **管理员接口保护**：member 访问 `usage/admin`、`billing/credit`、`billing/admin/wallet` 全部 → 403；admin → 200。
- **计费余额调整 + 钱包隔离**：admin 给 A 加 500/扣 200 余额正确；B 余额不受影响；admin 视图与 A 自查余额一致、含流水；用例结束自动还原 A 余额。
- **路由用量自隔离**：A/B 各自 `usage/me` → 200，且不泄露多用户维度（`/me` 仅自身）。
- **改密正负用例**：旧密码错→401、有效修改→200、新密码可登录、用例后还原。

## 三、浏览器多角度（重现“串台”场景）

- **跨租户刷新隔离**：admin 登录可见若干项目/会话；切换 tenantb 后列表为空，**连续 3 次刷新**始终只显示 tenantb 自身（空）数据，从未闪现 admin 数据。原“刷新串台”症状已消除。PASS。
- **成员设置收敛**（前序任务复核）：成员看不到服务配置/MCP、关于仅简介+版本号、个人信息+改密可用。
- **管理员设置**：服务配置/MCP/完整版本更新/个人信息齐全。

## 四、单机模式回归（单机不变）

临时切到单机栈（`npm --workspace ui run dev:concurrent`，默认端口）：

- `/health` → 200；`/api/auth/status` → `authDisabled=true`（单机鉴权关闭，行为未变）。
- `/api/capabilities/` → 200，能力数 **355**（非空，无空白能力中心）。
- `/api/auth/change-password`（单机）→ **400**（明确“单机模式不支持”，未引入新能力）。
- 白屏检查：`ROOT_LEN=21255`、正文非空、渲染出真实项目/会话（无白屏；仅 1 条良性 ERR_ABORTED 取消请求）。
- 浏览器设置：服务配置/MCP/完整版本更新 **均在**，**无**“个人信息”入口 —— 与改动前一致。

测试完成后已停止单机栈并恢复 `dev:saas`。

---

## 五、发现并修复的问题

### P1 能力目录 `hidden_in_hub` 计数不一致 + fork marker 丢失（已修复）

- **现象**：`npm run check:saas-fork` 长期报 `missing PD-SAAS-FORK in ui/src/shared/capabilitiesBundled.ts`，
  此前多次被当作“已知忽略”。
- **根因**：`capabilitiesBundled.ts`（离线兜底数据源）丢失了 fork 标记与对应逻辑：
  1. `BundledCapabilityItem`/`CatalogSkill` 类型未携带 `hidden_in_hub`，导致离线兜底路径下
     营销/教育 Tab 无法过滤隐藏项；
  2. 阶段（飞轮）与教育学段的计数把 `hidden_in_hub` 也计入，与 `CapabilityHub` 渲染时
     过滤隐藏项（marketing/education）的列表数量不一致（Pill 数字 > 实际条目）。
- **修复**：在类型中补 `hidden_in_hub`，item 映射透传该字段，并在 `stageCounter`/
  `educationBandCounter` 计数时跳过 `hidden_in_hub`，使离线计数与渲染列表一致；重新加上
  `PD-SAAS-FORK` 标记注释说明意图。
- **回归**：`check:saas-fork` → 47/47 全过；`smoke:capability-hub` → ok/failures=0；
  该文件 lint/typecheck 干净。

> 其它在测试中“看似失败”的项均为预期行为（如 member→admin 接口 403、单机改密 400、
> 跨租户/越界 403），非缺陷。

---

## 六、命令速查（复跑）

```bash
# 自动化
npm run test:saas:invariants
cd ui && npx vitest run server/saas && node --test server/saas/usage/usage.test.js server/saas/billing/billing.test.js server/saas/analytics/analytics.test.js && cd ..
node --import tsx --test tests/saas/deep-isolation-pilothome.test.ts
npm run check:saas-fork && npm run brand:check && npm run smoke:capability-hub

# 单机回归（临时切换，测后恢复 dev:saas）
npm --workspace ui run dev:concurrent
node scripts/check-white-screen.mjs "http://localhost:5173/p/general"
```
