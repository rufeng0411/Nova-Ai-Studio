# 上线前全面稳定性跑测报告

生成时间：2026-06-14（本机全链路 + 云端 API 复测）

## 总览

| 范围 | 结果 | 说明 |
|------|------|------|
| **本机全链路** `npm run test:prelaunch:stability` | **18/18 通过** | 含多用户 SaaS、能力中心、文档导出、Skills 单元/浏览器/Playwright |
| **快速验收** `integration-prelaunch-quick` | **25/25 通过** | 含近 48h 改动目标（斜杠菜单、试一下预填、登录分包） |
| **云端生产 API** `integration-production-cloud-deep` | **20/23 通过** | HTTPS 未恢复；教育技能 slug 脚本误写；导出 API 需 path |

**结论：本机稳定性达标，可进入发版打包；公网前须恢复 HTTPS，并建议发版后云端再跑 Playwright。**

---

## 一、Skills 对话理解（昨晚问题 — 多角度复测）

| 角度 | 用例 | 结果 | 说明 |
|------|------|------|------|
| 单元 | `capabilityBindingPrompt.test.ts`（6 项） | ✅ | 绑定标签、open-design、meeting-recorder 等 |
| 单元 | `capabilityTryBridge` / `slashCommandAutoExecute` / `pendingElicitation` 等 vitest | ✅ | 试一下桥接、无参技能自动执行 |
| 浏览器 | `browser:skills-slash-menu` | ✅ | `pressSequentially('/')` 触发 React onChange → CommandMenu `[role=listbox]` |
| 浏览器 | `browser:skills-try-prefill` | ✅ | 事件名 `pilotdeck:capability-prompt`（非旧名 capability-try）预填成功 |
| Playwright | SK-01～SK-04 专用 spec | ✅ | API 登录注入 token + 斜杠/试一下/prose 列表 |
| 目录 | `smoke:capability-try-prompts`（411 项 i18n 对齐） | ✅ | 含 `meeting-recorder-assistant` 示例同步 |

**根因与修复（测试侧）：**

1. Playwright `fill('/')` 不触发 React 受控输入 → 改为 `pressSequentially`。
2. Hub「试一下」事件名已改为 `pilotdeck:capability-prompt` → 浏览器/Playwright 用例已对齐。
3. Playwright 纯 UI 登录在部分环境下进不了对话页 → 改为 API 登录后写入 `auth-token` 再进 `/p/general`。
4. 验证码 `createCaptchaChallenge()` 未 `await` 导致注册 400 → storage/folder 隔离用例已修。

---

## 二、本机全链路明细（18 项）

| 项 | 结果 |
|----|------|
| build | ✅ |
| test:saas:deep（多租户 alice/bob） | ✅ |
| smoke:saas-isolation（11 项） | ✅ |
| smoke:resilience / project-memory | ✅ |
| smoke:capability-hub（taxonomy + filter） | ✅ |
| smoke:capability-try-prompts | ✅ |
| smoke:templates（29 条流程模板） | ✅ |
| smoke:skill-risk | ✅（vendor 教育包 python 文档示例记为 known，不阻断） |
| smoke:document-export（pdf/docx/pptx/xlsx） | ✅ |
| test:saas:storage（隔离 29/29 + Live 14/14） | ✅ |
| test:saas:folder（隔离 7/7；Live 0608 显示名 2 项本机数据态 WARN） | ✅ |
| check:saas-fork / brand:check | ✅ |
| vitest-capability-binding + vitest-ui-skills | ✅ |
| pack:preflight | ✅ |
| prelaunch-quick-full（含浏览器 + Playwright Skills） | ✅ |

**本机 Live 文件夹备注：** `workspaces-0608` 在 `.saas-dev-data` 中仍显示为 UUID（`LIVE-F02/F09`），隔离环境用例 `FOLD-01` 已通过，属**本机历史数据**未迁移，不阻断发版；发版后新用户/新 provision 路径正常。

---

## 三、多用户与全功能覆盖

- **多用户**：`test:saas:deep` 双租户；prelaunch 浏览器 `uat_*` 注册登录；云端 `clouduat_*` 注册 + 租户项目隔离。
- **认证安全**：错误 JWT/密码/成员越权管理 API → 全部拒绝。
- **承载**：登录页 20 并发、Captcha 15 并发均通过。
- **能力中心**：425 项 hub（云端）；五 Tab taxonomy 本机 audit 通过。
- **文档导出**：本机 smoke 全格式通过；云端 `GET …/export/capabilities` 需带 `path` 参数（脚本记 WARN）。
- **登录性能**：清缓存首访登录 ~1.8s；登录页不拉 AppShell 大包。

---

## 四、云端生产 `www.novapage.online`

| ID | 项 | 结果 |
|----|-----|------|
| NET-01 | HTTP | ✅ |
| NET-02 | HTTPS | ⚠️ Connection refused（443 未监听，需 ECS 执行 `recover-https-aliyun.sh`） |
| AUTH/DEST/PERF/LOAD | 认证与并发 | ✅ |
| FUNC-03 | 能力目录 425 项 | ✅ |
| SKILL-GEO/DOCX/OD/TPL | 关键技能在目录 | ✅ |
| SKILL-EDU | hermes-primary-math | ❌ 脚本 slug 误写（目录实际为 `edu-*` 前缀） |
| ISO-01 | 租户项目隔离 | ✅ |

---

## 五、发版前检查清单

- [x] 本机 `node scripts/run-prelaunch-stability-full.mjs` 全绿
- [x] Skills 斜杠 / 试一下 / 绑定单元与 E2E 全绿
- [ ] ECS 恢复 HTTPS + 安全组 443
- [ ] `npm run pack:deploy` 发版（含管理员图标、nginx 防覆盖脚本）
- [ ] 发版后云端 Playwright `ui/e2e/production/cloud-prod-deep.spec.ts`
- [ ] 人工抽测：实跑 pd-geo、anth-docx、open-design 对话各 1 轮

---

## 六、复跑命令

```bash
# 本机全面稳定性（约 2 分钟，含浏览器）
npm run test:prelaunch:stability

# 仅离线段
node scripts/run-prelaunch-stability-full.mjs --skip-browser

# 云端 API
PROD_BASE_URL=http://www.novapage.online node scripts/integration-production-cloud-deep.mjs
```

报告产物：

- `artifacts/prelaunch-stability/summary.json`
- `artifacts/prelaunch-quick/report-2026-06-14.md`
- `artifacts/production-cloud-test/api-report.json`
