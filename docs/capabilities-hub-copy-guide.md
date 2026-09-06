# 能力中心中文文案规范（管理员）

面向维护者与运营：能力卡片在 UI 上展示的中文名与说明须**直白、简短**，用户无需懂内部术语即可选型。

## 字段规则

| 字段 | 规则 | 正例 | 反例 |
|------|------|------|------|
| `display_name` | 2–8 字，说「做什么」 | 客户调研 | mkt-customer-research |
| `task_summary` | 一行 ≤30 字 | 搞清楚目标客户是谁、要什么 | ICP synthesis workflow |
| `description` | 1–2 句，场景+产出 | 根据访谈和公开信息，输出人群画像与痛点清单。 | 英文 trigger 长段 |
| `examples` | 可复制；句末可加「直接开始做，做完告诉我文件在哪」 | 帮我做竞品调研… | read_skill xxx |
| `setup_hint` | 需配置时一行提示 | 先在设置里填写 Firecrawl 密钥，保存后重启。 | FIRECRAWL_API_KEY |

## 配置位置

- 营销飞轮与虚拟卡：`config/capability-hub-zh.json`
- 合并进 API：`config/capabilities.i18n.json`（`npm run capabilities:gen` 同步）
- 覆盖规则：`config/capabilities.overrides.json`

## 校验

```bash
node scripts/check-capabilities-i18n-zh.mjs
```
