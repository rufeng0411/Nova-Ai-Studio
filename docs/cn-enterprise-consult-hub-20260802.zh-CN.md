# 脑爆「企业咨询」六顾问说明（2026-08-02）

## 定位

- 能力中心 **脑爆 → 企业咨询**：口语顾问（财务/税务/人力/法律/合同/政策）。
- 正式检查清单/审查意见：能力中心 **企业** Tab（内部 id 仍为 `enterprise_compliance`）或 **全案模板 → 企业**。
- slug：`consult-*`（勿用 `comp-*` / `persona-*`）。

## Binding / 试一下

- Hub 试一下为一句开场（如「我是你的企业财务顾问，有什么可以帮您？」），勿填表问卷。
- `consult-*` 与脑爆一致：**须快速回复**；默认可短暂思考、**零工具**；正式落盘引导「企业」Tab。
- 背书原子列表：`ENTERPRISE_CONSULT_BINDS`（移交参考，口语回合不强制 `read_skill`）。

## 验收

```bash
npm run capabilities:gen
npm run check:cn-enterprise-consult:hub
```
