# Gate-B 生产只读抽检 — 签收模板

> **触发**：每次 `pack:deploy` 上传 ECS 并完成项 1 后填写  
> **权威清单**：[next-pack-reminders.zh-CN.md](next-pack-reminders.zh-CN.md) 项 2

**执行日期**：  
**执行人**：  
**Git / tar 版本**：  
**PROD_BASE_URL**：https://www.novapage.online

---

## 检查项

| ☐ | ID | 操作 | 结果 | 备注 |
|---|-----|------|------|------|
| ☐ | Q-01 | `node scripts/check-white-screen.mjs https://www.novapage.online/p/general` | | |
| ☐ | Q-02 | `npm run test:cloud:chat-load` | | |
| ☐ | Q-03 | tail120 P50/P95 与 KB | | 目标 P95 <1.5s，KB <500KB |
| ☐ | Q-04 | HTTPS 443 | | |
| ☐ | Q-05 | admin 默认密码已修改 | | |

---

## 结论

☐ 具备生产运行态验收  
☐ 不具备（原因：）

---

## ECS 项 1、3（同次发版一并勾选）

| ☐ | verify-cloud-runtime.sh | |
| ☐ | verify-cloud-perf.sh | |
| ☐ | apply-cloud-perf R2 已开 | R3 CACHE：☐ 未开 ☐ 已观察后开启 |
