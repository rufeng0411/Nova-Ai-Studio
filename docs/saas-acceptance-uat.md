# SaaS 验收 UAT 清单



**产品:** Nova Ai-Studio SaaS (PilotDeck fork)  

**版本:** Phase 1–3 + 深度测试  

**日期:** 2026-06-06



## 前置



- [x] `npm run dev:saas` 可启动（Gateway + UI + SaaS 控制库）— 自动化验收已验证

- [ ] 平台管理员已改密（公网前必须）

- [x] `npm run check:saas-fork` 通过

- [x] `npm run brand:check` 通过



## §9.9 双模式不变量（自动化）



| ID | 说明 | 状态 |

|----|------|------|

| INV-OSS-01 | 无 SAAS_MODE 时非 SaaS 语义 | [x] `test-saas-invariants` |

| INV-OSS-02 | capabilities 目录规模 | [x] slug ≥ 80 |

| INV-OSS-03 | P1–P4 OSS 回归 | [x] `oss-regression` in acceptance |

| INV-OSS-04 | `npm test` + `test:ui:unit` | [x] acceptance |

| INV-SAAS-01 | SaaS 须真实登录语义 | [x] deep + phase1 PW |

| INV-SAAS-02 | 注册用户 A/B 项目隔离 | [x] `integration-saas-deep` |

| INV-SAAS-03 | Legacy Bridge skills 不丢 | [x] deep + invariants |

| INV-BRAND-01 | Nova 品牌 | [x] `brand:check` |

| INV-FORK-01 | fork manifest | [x] `check:saas-fork` |



## Phase 1 — 认证与后台



- [x] 登录/注册页符合 chosen v1 Native Slate 设计 — phase0/1 PW

- [x] JWT 登录；SaaS 模式无 fake local user — deep + phase1

- [x] `/admin/users` 仅管理员可完整使用 — deep-uat PW

- [x] 非管理员隐藏 Config 设置项 — deep-uat PW

- [x] `/admin/platform` 平台配置说明页 — phase1 PW



## Phase 2 — 订阅与积分



- [x] 开放注册需图形验证码 — deep API + phase2 PW

- [x] 计划列表、订阅、钱包余额 API — phase2 smoke + deep

- [x] 管理员手动充值 — deep（addCredit）

- [x] 积分耗尽 soft block (402) — phase2 smoke + deep



## Phase 3 — 运营仪表盘



- [x] 访问/用户/运营/订阅/AI 用量五类指标 — phase3 smoke

- [x] 仪表盘图表可渲染 — phase3 PW

- [ ] 与 PD 路由统计复用（有数据时）— 需生产数据人工看一眼



## LAN（自动化预检）

- [x] OSS LAN 欢迎页/断线 — `lan-oss-chat` in acceptance
- [x] SaaS LAN 登录后输入框 — `saas/lan-login-chat` in acceptance
- [ ] 他机真机 LAN 首字 — 须手测（见 `dev:saas` 输出的局域网 IP）



## 回归



- [x] `npm run test:saas:preflight` — **PASS**

- [x] `npm run test:saas:deep` — **PASS**

- [x] `npm run test:ui:unit` — **121/121**

- [x] `npm test` — **30/30**

- [x] `npm run test:saas:all` — **PASS**

- [x] `npm run test:saas:acceptance` — **OK**（含 chat-experience + saas deep-uat）

- [x] P1–P4 OSS 回归 — **PASS**



## 签核



见 `docs/saas-acceptance-signoff.md`  

深度测试明细：`docs/saas-deep-test-report.md`


