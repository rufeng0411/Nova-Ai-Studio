---
name: od-login-flow
description: 设计登录注册与验证流程界面方案。当用户提出相关页面或原型设计需求时使用本技能。先读取 open-design 总控流程，再按本技能模板与清单执行。
---

# od-login-flow

这是 Open Design 迁移后的瘦表面技能。

## 使用方式

1. 先 `read_skill` 读取 `open-design`，遵循总控流程（问卷、方向、品牌、五维自评）。
2. 若 `assets/template.html` 存在，先复制到工作文件再填充内容。
3. 交付前用 `read_skill` skillName=`od-login-flow` relativePath=`references/checklist.md` 读清单并逐条自检（勿 `read_file`）。

## 资源来源

- 上游技能：OpenDesign/skills/login-flow
- 本技能仅保留可复用模板与清单，风格决策由 open-design 总控技能统一。
